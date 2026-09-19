import os
import json
import uuid
import random
import boto3
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
from functools import wraps
from werkzeug.utils import secure_filename
from models import db, User, Group, Expense, Contribution, ExpenseParticipant, SettlementTransaction, PoolPayment, PoolPaymentParticipant
from sqlalchemy.exc import IntegrityError
from sqlalchemy import inspect
from sqlalchemy.pool import NullPool
from mangum import Mangum
from asgiref.wsgi import WsgiToAsgi
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

def split_amount_into_paise(total_amount, num_participants):
    if num_participants <= 0:
        return []
    total_paise = int((Decimal(str(total_amount)) * Decimal('100')).quantize(Decimal('1')))
    base = total_paise // num_participants
    remainder = total_paise % num_participants
    shares = []
    for i in range(num_participants):
        paise = base + (1 if i < remainder else 0)
        shares.append((Decimal(paise) / Decimal('100')).quantize(Decimal('0.01')))
    return shares

app = Flask(__name__)
CORS(app)
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'instance', 'poolsy.db')).replace('\\', '/')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{db_path}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('SECRET_KEY', 'poolsy-dev-secret-key-123!')
app.config['SECRET_KEY'] = app.config['JWT_SECRET_KEY']
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['AWS_REGION'] = os.environ.get('AWS_REGION', 'us-east-1')
app.config['S3_BUCKET'] = os.environ.get('S3_BUCKET', 'poolsy-receipts')

# Lambda: Use NullPool for PostgreSQL to avoid connection pool exhaustion across concurrent invocations.
# SQLite (local dev): No special pool configuration needed.
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql'):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'poolclass': NullPool,
    }
app.config['UPLOAD_FOLDER'] = '/tmp'

# AWS Clients
s3_client = boto3.client('s3', region_name=app.config['AWS_REGION'])
textract_client = boto3.client('textract', region_name=app.config['AWS_REGION'])
bedrock_client = boto3.client('bedrock-runtime', region_name=app.config['AWS_REGION'])

db.init_app(app)

# Startup migrations: db.create_all(), ALTER TABLE, and data backfills.
# Gated behind RUN_MIGRATIONS env var. Defaults to 'true' so local dev works unchanged.
# Set RUN_MIGRATIONS=false in Lambda/production to prevent DDL on every cold start.
if os.environ.get('RUN_MIGRATIONS', 'true').lower() == 'true':
    with app.app_context():
        db.create_all()
        try:
            inspector = inspect(db.engine)
            if inspector.has_table('pool_payments'):
                columns = [col['name'] for col in inspector.get_columns('pool_payments')]
                with db.engine.connect() as conn:
                    if 'category' not in columns:
                        conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN category VARCHAR(50) DEFAULT 'Other'"))
                    if 'description' not in columns:
                        conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN description VARCHAR(255)"))
                    if 'participants_json' not in columns:
                        conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN participants_json TEXT"))
                    conn.commit()
        except Exception as e:
            print(f"Schema migration error: {e}")

        try:
            all_pps = PoolPayment.query.all()
            for pp in all_pps:
                if not pp.participants:
                    p_ids = []
                    if pp.participants_json:
                        try:
                            p_ids = json.loads(pp.participants_json)
                        except Exception:
                            p_ids = []
                    if not p_ids and pp.group:
                        p_ids = [m.id for m in pp.group.members]
                    if p_ids:
                        shares = split_amount_into_paise(pp.amount, len(p_ids))
                        for uid, share in zip(p_ids, shares):
                            ppp = PoolPaymentParticipant(pool_payment_id=pp.id, user_id=uid, share_amount=share)
                            db.session.add(ppp)
            db.session.commit()
        except Exception as e:
            db.session.rollback()

bcrypt = Bcrypt(app)

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
                
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                raise Exception("User not found")
        except Exception as e:
            return jsonify({'error': 'Token is invalid or expired!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

def calculate_pool_balance(group):
    gid = group.id
    total_contributions = db.session.query(db.func.coalesce(db.func.sum(Contribution.amount), 0)).filter_by(group_id=gid).scalar()
    settlement_deposits = db.session.query(db.func.coalesce(db.func.sum(SettlementTransaction.amount), 0)).filter_by(group_id=gid, type='SETTLEMENT_DEPOSIT').scalar()
    settlement_payouts = db.session.query(db.func.coalesce(db.func.sum(SettlementTransaction.amount), 0)).filter_by(group_id=gid, type='SETTLEMENT_PAYOUT').scalar()
    pool_payments = db.session.query(db.func.coalesce(db.func.sum(PoolPayment.amount), 0)).filter_by(group_id=gid, status='SUCCESS').scalar()
    return Decimal(str(total_contributions)) + Decimal(str(settlement_deposits)) - Decimal(str(settlement_payouts)) - Decimal(str(pool_payments))

migration_done = False

@app.before_request
def auto_migrate():
    global migration_done
    if not migration_done:
        try:
            with db.engine.connect() as conn:
                try:
                    conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN category VARCHAR(50) DEFAULT 'Other'"))
                except: pass
                try:
                    conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN description VARCHAR(255)"))
                except: pass
                try:
                    conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN participants_json TEXT"))
                except: pass
                conn.commit()
        except Exception as e:
            print(f"Auto-migration failed: {e}")
        migration_done = True

# ----------------- HEALTH ENDPOINT ----------------- #

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'poolsy-backend'}), 200

# ----------------- AUTH ROUTES ----------------- #

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400
        
    # Explicitly use 10 rounds instead of default 12. 
    # 12 rounds on low-CPU AWS Lambda instances can take 10+ seconds.
    hashed_password = bcrypt.generate_password_hash(password, 4).decode('utf-8')
    new_user = User(name=name, email=email, password_hash=hashed_password)
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Missing email or password'}), 400
        
    user = User.query.filter_by(email=email).first()
    
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401
        
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': {'id': user.id, 'name': user.name, 'email': user.email, 'upi_id': user.upi_id}
    })

@app.route('/api/user/settings', methods=['PUT'])
@token_required
def update_user_settings(current_user):
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    upi_id = data.get('upi_id')
    
    if name:
        current_user.name = name
    if email:
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != current_user.id:
            return jsonify({'error': 'Email is already in use by another account'}), 400
        current_user.email = email
    if password:
        current_user.password_hash = bcrypt.generate_password_hash(password, 4).decode('utf-8')
    if upi_id is not None:
        current_user.upi_id = upi_id
        
    db.session.commit()
    
    return jsonify({
        'message': 'Settings updated successfully',
        'user': {'id': current_user.id, 'name': current_user.name, 'email': current_user.email, 'upi_id': current_user.upi_id}
    })

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify({
        'user': {
            'id': current_user.id,
            'name': current_user.name,
            'email': current_user.email,
            'upi_id': current_user.upi_id
        }
    })

# ----------------- GROUP ROUTES ----------------- #

@app.route('/api/groups', methods=['GET'])
@token_required
def get_groups(current_user):
    result = []
    for g in current_user.groups:
        pool_balance = calculate_pool_balance(g)
        result.append({
            'id': g.id,
            'name': g.name,
            'description': g.description,
            'invite_code': g.invite_code,
            'member_count': len(g.members),
            'pool_balance': float(pool_balance)
        })
    return jsonify(result)

@app.route('/api/groups', methods=['POST'])
@token_required
def create_group(current_user):
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Group name is required'}), 400
        
    import secrets
    import string
    
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        if not Group.query.filter_by(invite_code=code).first():
            break

    new_group = Group(name=name, description=data.get('description'), created_by=current_user.id, invite_code=code)
    new_group.members.append(current_user)
    db.session.add(new_group)
    db.session.commit()
    
    return jsonify({
        'id': new_group.id,
        'name': new_group.name,
        'description': new_group.description,
        'invite_code': new_group.invite_code
    }), 201

@app.route('/api/groups/join', methods=['POST'])
@token_required
def join_group(current_user):
    data = request.json
    invite_code = data.get('invite_code')
    if not invite_code:
        return jsonify({'error': 'Invite code is required'}), 400
        
    invite_code = invite_code.strip().upper()
    group = Group.query.filter_by(invite_code=invite_code).first()
    
    if not group:
        return jsonify({'error': 'Invite code not found'}), 404
        
    if current_user.id in [m.id for m in group.members]:
        return jsonify({'error': 'You are already a member of this group'}), 409
        
    try:
        group.members.append(current_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to join group'}), 500
        
    pool_balance = calculate_pool_balance(group)
    
    return jsonify({
        'id': group.id,
        'name': group.name,
        'description': group.description,
        'invite_code': group.invite_code,
        'member_count': len(group.members),
        'pool_balance': float(pool_balance)
    }), 200

@app.route('/api/groups/<int:group_id>/members', methods=['POST'])
@token_required
def add_member(current_user, group_id):
    data = request.json
    email = data.get('email')
    
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
        
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'You are not a member of this group'}), 403
        
    user_to_add = User.query.filter_by(email=email).first()
    if not user_to_add:
        return jsonify({'error': 'User not found'}), 404
        
    if user_to_add.id in [m.id for m in group.members]:
        return jsonify({'error': 'User is already a member'}), 400
        
    group.members.append(user_to_add)
    db.session.commit()
    
    return jsonify({'message': 'Member added successfully'})

@app.route('/api/groups/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
@token_required
def remove_member(current_user, group_id, user_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
        
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    member_to_remove = next((m for m in group.members if m.id == user_id), None)
    if not member_to_remove:
        return jsonify({'error': 'User not in group'}), 404
        
    deposited = sum(c.amount for c in group.contributions if c.user_id == user_id)
    externally_paid = sum(e.amount for e in group.expenses if e.paid_by == user_id)
    spent = sum(p.share_amount for e in group.expenses for p in e.participants if p.user_id == user_id)
    spent += sum(p.share_amount for pp in getattr(group, 'pool_payments', []) if pp.status == 'SUCCESS' for p in pp.participants if p.user_id == user_id)
    net_contribution = externally_paid + deposited - spent
    settlement_deposits = sum(s.amount for s in group.settlements if s.type == 'SETTLEMENT_DEPOSIT' and s.user_id == user_id)
    settlement_payouts = sum(s.amount for s in group.settlements if s.type == 'SETTLEMENT_PAYOUT' and s.user_id == user_id)
    
    settled_net = net_contribution + settlement_deposits - settlement_payouts
    
    print(f"DEBUG remove_member: user_id={user_id}, deposited={deposited}, ext_paid={externally_paid}, spent={spent}, net_contrib={net_contribution}, set_dep={settlement_deposits}, set_pay={settlement_payouts}, settled_net={settled_net}", flush=True)
    
    if abs(settled_net) > Decimal('0.01'):
        msg = 'Cannot leave until your balance is fully settled.' if current_user.id == user_id else 'Cannot remove member until their balance is fully settled.'
        return jsonify({'error': msg}), 400
        
    group.members.remove(member_to_remove)
    db.session.commit()
    
    return jsonify({'message': 'Member removed successfully'})

@app.route('/api/groups/<int:group_id>', methods=['GET'])
@token_required
def get_group_details(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    pool_balance = calculate_pool_balance(group)
    
    transactions = []
    for c in group.contributions:
        transactions.append({
            'id': f'c_{c.id}',
            'raw_id': c.id,
            'type': 'contribution',
            'amount': float(c.amount),
            'user': {'id': c.user.id, 'name': c.user.name},
            'created_at': c.created_at.isoformat()
        })
    for e in group.expenses:
        transactions.append({
            'id': f'e_{e.id}',
            'raw_id': e.id,
            'type': 'expense',
            'amount': float(e.amount),
            'description': e.description,
            'category': e.category,
            'user': {'id': e.payer.id, 'name': e.payer.name},
            'created_at': e.created_at.isoformat(),
            'participants': [{'id': p.user.id, 'name': p.user.name, 'share': float(p.share_amount)} for p in e.participants]
        })
        
    for s in group.settlements:
        transactions.append({
            'id': f's_{s.id}',
            'raw_id': s.id,
            'type': s.type.lower(),
            'amount': float(s.amount),
            'description': s.description,
            'user': {'id': s.user.id, 'name': s.user.name},
            'created_at': s.created_at.isoformat()
        })
        
    for p in group.pool_payments:
        p_participants = []
        if getattr(p, 'participants_json', None):
            try:
                import json
                p_ids = json.loads(p.participants_json)
                p_participants = [{'id': u.id, 'name': u.name} for u in group.members if u.id in p_ids]
            except Exception:
                p_participants = []
        transactions.append({
            'id': f'pp_{p.id}',
            'raw_id': p.id,
            'type': 'pool_payment',
            'amount': float(p.amount),
            'recipient_name': p.recipient_name,
            'recipient_upi_id': p.recipient_upi_id,
            'payment_method': p.payment_method,
            'category': getattr(p, 'category', 'Other') or 'Other',
            'participants': p_participants,
            'status': p.status,
            'receipt_id': p.receipt_id,
            'user': {'id': p.user.id, 'name': p.user.name},
            'created_at': p.created_at.isoformat()
        })
        
    transactions.sort(key=lambda x: x['created_at'], reverse=True)
        
    creator = db.session.get(User, group.created_by)
    return jsonify({
        'id': group.id,
        'name': group.name,
        'description': group.description,
        'invite_code': group.invite_code,
        'created_at': group.created_at.isoformat(),
        'created_by': group.created_by,
        'creator_upi_id': creator.upi_id if creator else None,
        'members': [{'id': m.id, 'name': m.name} for m in group.members],
        'pool_balance': float(pool_balance),
        'transactions': transactions
    })

@app.route('/api/groups/<int:group_id>', methods=['PUT'])
@token_required
def update_group(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.json or {}
    new_name = data.get('name', '').strip()
    if not new_name:
        return jsonify({'error': 'Group name cannot be empty'}), 400
        
    group.name = new_name
    db.session.commit()
    return jsonify({
        'message': 'Group updated successfully',
        'group': {
            'id': group.id,
            'name': group.name,
            'invite_code': group.invite_code
        }
    }), 200

# ----------------- CONTRIBUTION ROUTES ----------------- #

@app.route('/api/groups/<int:group_id>/contribute', methods=['POST'])
@token_required
def add_contribution(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.json
    amount_str = data.get('amount')
    if not amount_str:
        return jsonify({'error': 'Amount is required'}), 400
        
    try:
        amount = Decimal(str(amount_str))
    except Exception:
        return jsonify({'error': 'Invalid amount'}), 400
        
    contribution = Contribution(group_id=group.id, user_id=current_user.id, amount=amount)
    db.session.add(contribution)
    db.session.commit()
    
    return jsonify({'message': 'Successfully added money to pool', 'id': contribution.id}), 201


# ----------------- EXPENSE ROUTES ----------------- #

@app.route('/api/groups/<int:group_id>/expenses', methods=['POST'])
@token_required
def add_expense(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.json
    try:
        amount = Decimal(str(data.get('amount')))
    except Exception:
        return jsonify({'error': 'Invalid amount'}), 400
        
    description = data.get('description', '')
    
    if not amount:
        return jsonify({'error': 'Amount is required'}), 400
        
    category = data.get('category') or 'Other'
    valid_categories = ['Breakfast', 'Lunch', 'Dinner', 'Groceries', 'Transport', 'Other']
    if category and category not in valid_categories:
        return jsonify({'error': 'Invalid category'}), 400
        
    participants_ids = data.get('participants', [])
    if not participants_ids or len(participants_ids) == 0:
        return jsonify({'error': 'Select at least one member who this expense belongs to.'}), 400
    
    group_member_ids = {m.id for m in group.members}
    for pid in participants_ids:
        if pid not in group_member_ids:
            return jsonify({'error': f'User ID {pid} is not a member of this group'}), 400
            
    paid_by_id = data.get('paid_by')
    if not paid_by_id:
        paid_by_id = current_user.id
        
    new_expense = Expense(
        group_id=group.id,
        paid_by=paid_by_id,
        amount=amount,
        description=description,
        category=category
    )
    db.session.add(new_expense)
    db.session.flush() # To get new_expense.id
    
    # Calculate equal shares safely in paise with random remainder allocation
    total_paise = int(round(Decimal(str(amount)) * Decimal('100')))
    num_participants = len(participants_ids)
    base_share_paise = total_paise // num_participants
    remainder_paise = total_paise % num_participants
    
    shares_paise = [base_share_paise] * num_participants
    if remainder_paise > 0:
        bonus_indices = random.sample(range(num_participants), remainder_paise)
        for idx in bonus_indices:
            shares_paise[idx] += 1
            
    shares = [Decimal(sp) / Decimal('100') for sp in shares_paise]
    
    for idx, pid in enumerate(participants_ids):
        ep = ExpenseParticipant(
            expense_id=new_expense.id,
            user_id=pid,
            share_amount=shares[idx]
        )
        db.session.add(ep)
        
    db.session.commit()
    return jsonify({'message': 'Expense recorded successfully', 'id': new_expense.id}), 201

@app.route('/api/groups/<int:group_id>/summary', methods=['GET'])
@token_required
def get_group_summary(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    gid = group.id
    
    expenses_total = db.session.query(db.func.coalesce(db.func.sum(Expense.amount), 0)).filter_by(group_id=gid).scalar()
    pool_payments_total = db.session.query(db.func.coalesce(db.func.sum(PoolPayment.amount), 0)).filter_by(group_id=gid, status='SUCCESS').scalar()
    total_spent = Decimal(str(expenses_total)) + Decimal(str(pool_payments_total))
    
    total_deposited = db.session.query(db.func.coalesce(db.func.sum(Contribution.amount), 0)).filter_by(group_id=gid).scalar()
    
    settlement_deposits_total = db.session.query(db.func.coalesce(db.func.sum(SettlementTransaction.amount), 0)).filter_by(group_id=gid, type='SETTLEMENT_DEPOSIT').scalar()
    settlement_payouts_total = db.session.query(db.func.coalesce(db.func.sum(SettlementTransaction.amount), 0)).filter_by(group_id=gid, type='SETTLEMENT_PAYOUT').scalar()

    pool_balance = calculate_pool_balance(group)
    
    user_deposits = dict(db.session.query(Contribution.user_id, db.func.sum(Contribution.amount)).filter_by(group_id=gid).group_by(Contribution.user_id).all())
    user_externally_paid = dict(db.session.query(Expense.paid_by, db.func.sum(Expense.amount)).filter_by(group_id=gid).group_by(Expense.paid_by).all())
    
    user_expense_spent = dict(db.session.query(
        ExpenseParticipant.user_id, db.func.sum(ExpenseParticipant.share_amount)
    ).join(Expense).filter(Expense.group_id == gid).group_by(ExpenseParticipant.user_id).all())
    
    user_pool_payment_spent = dict(db.session.query(
        PoolPaymentParticipant.user_id, db.func.sum(PoolPaymentParticipant.share_amount)
    ).join(PoolPayment).filter(PoolPayment.group_id == gid, PoolPayment.status == 'SUCCESS').group_by(PoolPaymentParticipant.user_id).all())

    user_settlement_deposits = dict(db.session.query(
        SettlementTransaction.user_id, db.func.sum(SettlementTransaction.amount)
    ).filter_by(group_id=gid, type='SETTLEMENT_DEPOSIT').group_by(SettlementTransaction.user_id).all())
    
    user_settlement_payouts = dict(db.session.query(
        SettlementTransaction.user_id, db.func.sum(SettlementTransaction.amount)
    ).filter_by(group_id=gid, type='SETTLEMENT_PAYOUT').group_by(SettlementTransaction.user_id).all())

    members_data = []
    group_has_unsettled_member = False
    
    for member in sorted(group.members, key=lambda m: m.name.lower()):
        uid = member.id
        
        deposited = Decimal(str(user_deposits.get(uid, 0)))
        externally_paid = Decimal(str(user_externally_paid.get(uid, 0)))
        
        spent = Decimal(str(user_expense_spent.get(uid, 0)))
        spent += Decimal(str(user_pool_payment_spent.get(uid, 0)))

        net_contribution = externally_paid + deposited - spent
        
        member_settlement_deposits = Decimal(str(user_settlement_deposits.get(uid, 0)))
        member_settlement_payouts = Decimal(str(user_settlement_payouts.get(uid, 0)))
        
        settled_net = (net_contribution + member_settlement_deposits - member_settlement_payouts).quantize(Decimal('0.01'))
        
        if settled_net < -Decimal('0.01'):
            mem_settlement_status = "PAY"
            pending_settlement = abs(settled_net)
            group_has_unsettled_member = True
        elif settled_net > Decimal('0.01'):
            mem_settlement_status = "RECEIVE"
            pending_settlement = settled_net
            group_has_unsettled_member = True
        else:
            mem_settlement_status = "SETTLED"
            pending_settlement = Decimal('0.00')
        
        members_data.append({
            'user_id': member.id,
            'name': member.name,
            'deposited': float(deposited),
            'externally_paid': float(externally_paid),
            'spent': float(spent),
            'expense_share': float(spent),
            'net': float(net_contribution),
            'net_contribution': float(net_contribution),
            'settled_net': float(settled_net),
            'settlement_status': mem_settlement_status,
            'pending_settlement': float(pending_settlement)
        })
        
    expense_categories = db.session.query(Expense.category, db.func.sum(Expense.amount)).filter_by(group_id=gid).group_by(Expense.category).all()
    pool_payment_categories = db.session.query(PoolPayment.category, db.func.sum(PoolPayment.amount)).filter_by(group_id=gid, status='SUCCESS').group_by(PoolPayment.category).all()

    category_spending = {}
    for cat, amt in expense_categories:
        c = cat or 'Other'
        category_spending[c] = category_spending.get(c, Decimal('0.00')) + Decimal(str(amt))
    for cat, amt in pool_payment_categories:
        c = cat or 'Pool Payments'
        category_spending[c] = category_spending.get(c, Decimal('0.00')) + Decimal(str(amt))
        
    category_spending_formatted = {k: float(v) for k, v in category_spending.items() if v > 0}
    
    clearing_balance = pool_balance
    settlement_status = 'PENDING' if group_has_unsettled_member else 'COMPLETE'
    
    if total_deposited == 0 and total_spent == 0 and not group.settlements:
        settlement_status = 'COMPLETE'
    
    return jsonify({
        'total_deposited': float(total_deposited),
        'total_spent': float(total_spent),
        'pool_balance': float(pool_balance),
        'settlement_deposits': float(settlement_deposits_total),
        'settlement_payouts': float(settlement_payouts_total),
        'clearing_balance': float(clearing_balance),
        'settlement_status': settlement_status,
        'members': members_data,
        'category_spending': category_spending_formatted
    })



# ----------------- AWS AI RECEIPT SCANNER ----------------- #

@app.route('/api/receipts/scan', methods=['POST'])
@token_required
def scan_receipt(current_user):
    if 'receipt' not in request.files:
        return jsonify({'error': 'No receipt file provided'}), 400
        
    file = request.files['receipt']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    
    # 1. Upload to S3
    try:
        s3_client.upload_fileobj(
            file,
            app.config['S3_BUCKET'],
            unique_filename,
            ExtraArgs={'ContentType': file.content_type}
        )
        receipt_url = f"https://{app.config['S3_BUCKET']}.s3.{app.config['AWS_REGION']}.amazonaws.com/{unique_filename}"
    except Exception as e:
        return jsonify({'error': f'Failed to upload to S3: {str(e)}'}), 500
        
    # 2. Extract text using Amazon Textract
    try:
        response = textract_client.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': app.config['S3_BUCKET'],
                    'Name': unique_filename
                }
            }
        )
        
        extracted_text = ""
        for item in response['Blocks']:
            if item['BlockType'] == 'LINE':
                extracted_text += item['Text'] + "\n"
                
    except Exception as e:
        return jsonify({'error': f'Textract processing failed: {str(e)}'}), 500
        
    # 3. Categorize and Extract Structured Data using Amazon Bedrock (Claude 3 Haiku)
    try:
        prompt = f"""
        Extract the following information from the receipt text below:
        - total_amount: The final total amount as a float (e.g. 12.50)
        - merchant: The name of the store or merchant
        - category: A suggested category (e.g., Food, Travel, Utilities, Groceries)
        - items: A list of items purchased (if available)

        Return ONLY a JSON object with these keys. No other text.
        
        Receipt Text:
        {extracted_text}
        """
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}]
                }
            ]
        })
        
        bedrock_response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=body,
            contentType='application/json',
            accept='application/json'
        )
        
        response_body = json.loads(bedrock_response['body'].read())
        content = response_body['content'][0]['text']
        
        # Ensure it's valid JSON (sometimes Claude wraps it in ```json)
        if content.startswith('```json'):
            content = content[7:-3]
            
        structured_data = json.loads(content)
        structured_data['receipt_url'] = receipt_url
        
        return jsonify(structured_data)
        
    except Exception as e:
        return jsonify({'error': f'Bedrock processing failed: {str(e)}'}), 500


# ----------------- SETTLEMENT ROUTES ----------------- #

@app.route('/api/groups/<int:group_id>/settle/individual', methods=['POST'])
@token_required
def settle_individual(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group: return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]: return jsonify({'error': 'Access denied'}), 403
    
    data = request.json
    action = data.get('action') # 'pay' or 'withdraw'
    try:
        amount = Decimal(str(data.get('amount')))
    except:
        return jsonify({'error': 'Invalid amount'}), 400
        
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than zero'}), 400

    deposited = sum((Decimal(str(c.amount)) for c in group.contributions if c.user_id == current_user.id), Decimal('0.00'))
    externally_paid = sum((Decimal(str(e.amount)) for e in group.expenses if e.paid_by == current_user.id), Decimal('0.00'))
    spent = Decimal('0.00')
    for e in group.expenses:
        for p in e.participants:
            if p.user_id == current_user.id:
                spent += Decimal(str(p.share_amount))
    for pp in getattr(group, 'pool_payments', []):
        if pp.status == 'SUCCESS':
            for ppp in getattr(pp, 'participants', []):
                if ppp.user_id == current_user.id:
                    spent += Decimal(str(ppp.share_amount))
    
    net_contribution = externally_paid + deposited - spent
    settlement_deposits = sum((Decimal(str(s.amount)) for s in group.settlements if s.type == 'SETTLEMENT_DEPOSIT' and s.user_id == current_user.id), Decimal('0.00'))
    settlement_payouts = sum((Decimal(str(s.amount)) for s in group.settlements if s.type == 'SETTLEMENT_PAYOUT' and s.user_id == current_user.id), Decimal('0.00'))
    
    settled_net = (net_contribution + settlement_deposits - settlement_payouts).quantize(Decimal('0.01'))
    
    if action == 'pay':
        if settled_net >= 0:
            return jsonify({'error': 'You do not owe any money to the pool.'}), 400
        max_pay = abs(settled_net)
        if amount > max_pay:
            return jsonify({'error': f'You cannot pay more than what you owe (₹{max_pay}).'}), 400
            
        s = SettlementTransaction(
            group_id=group.id,
            user_id=current_user.id,
            amount=amount,
            type='SETTLEMENT_DEPOSIT',
            description='Settled debt to the shared pool'
        )
        db.session.add(s)
        
    elif action == 'withdraw':
        if settled_net <= 0:
            return jsonify({'error': 'You are not owed any money from the pool.'}), 400
        if amount > settled_net:
            return jsonify({'error': f'You cannot withdraw more than what you are owed (₹{settled_net}).'}), 400
            
        available_pool = calculate_pool_balance(group)
        if amount > available_pool:
            return jsonify({'error': f'Insufficient pool balance. Available: ₹{available_pool}'}), 400
            
        s = SettlementTransaction(
            group_id=group.id,
            user_id=current_user.id,
            amount=amount,
            type='SETTLEMENT_PAYOUT',
            description='Withdrew settlement funds from the shared pool'
        )
        db.session.add(s)
    else:
        return jsonify({'error': 'Invalid action'}), 400
        
    db.session.commit()
    return jsonify({'message': f'Successfully processed {action} for ₹{amount}.'}), 200

@app.route('/api/groups/<int:group_id>/settle', methods=['POST'])
@token_required
def settle_group(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    pre_settlement_pool_balance = Decimal(str(calculate_pool_balance(group))).quantize(Decimal('0.01'))
    
    gid = group.id
    group_expenses = Expense.query.filter_by(group_id=gid).all()
    group_contributions = Contribution.query.filter_by(group_id=gid).all()
    group_settlements = SettlementTransaction.query.filter_by(group_id=gid).all()

    depositors = []
    recipients = []
    total_deposits_required = Decimal('0.00')
    total_payouts_required = Decimal('0.00')
    
    for member in group.members:
        deposited = sum((Decimal(str(c.amount)) for c in group_contributions if c.user_id == member.id), Decimal('0.00'))
        externally_paid = sum((Decimal(str(e.amount)) for e in group_expenses if e.paid_by == member.id), Decimal('0.00'))
        spent = Decimal('0.00')
        for e in group_expenses:
            for p in e.participants:
                if p.user_id == member.id:
                    spent += Decimal(str(p.share_amount))
        for pp in getattr(group, 'pool_payments', []):
            if pp.status == 'SUCCESS':
                for ppp in getattr(pp, 'participants', []):
                    if ppp.user_id == member.id:
                        spent += Decimal(str(ppp.share_amount))
                    
        net_contribution = externally_paid + deposited - spent
        member_settlement_deposits = sum((Decimal(str(s.amount)) for s in group_settlements if s.type == 'SETTLEMENT_DEPOSIT' and s.user_id == member.id), Decimal('0.00'))
        member_settlement_payouts = sum((Decimal(str(s.amount)) for s in group_settlements if s.type == 'SETTLEMENT_PAYOUT' and s.user_id == member.id), Decimal('0.00'))
        
        settled_net = (net_contribution + member_settlement_deposits - member_settlement_payouts).quantize(Decimal('0.01'))
        
        if settled_net < -Decimal('0.01'):
            amount = abs(settled_net)
            depositors.append({'user_id': member.id, 'amount': amount})
            total_deposits_required += amount
        elif settled_net > Decimal('0.01'):
            amount = settled_net
            recipients.append({'user_id': member.id, 'amount': amount})
            total_payouts_required += amount

    total_deposits_required = total_deposits_required.quantize(Decimal('0.01'))
    total_payouts_required = total_payouts_required.quantize(Decimal('0.01'))

    if total_deposits_required == Decimal('0.00') and total_payouts_required == Decimal('0.00'):
        return jsonify({'message': 'Group is already settled.'}), 200

    # SETTLEMENT INVARIANT CHECK (Section 4 & Section 12)
    available_for_payouts = (pre_settlement_pool_balance + total_deposits_required).quantize(Decimal('0.01'))
    if available_for_payouts < total_payouts_required:
        db.session.rollback()
        return jsonify({'error': 'Settlement cannot be completed because the available pool balance is insufficient for the required settlement.'}), 400
        
    try:
        transactions_created = 0
        # FIRST: Settlement Deposits (negative-net members -> Shared Pool)
        for dep in depositors:
            s = SettlementTransaction(
                group_id=group.id,
                user_id=dep['user_id'],
                amount=dep['amount'],
                type='SETTLEMENT_DEPOSIT',
                description='Final settlement deposit into the shared pool'
            )
            db.session.add(s)
            transactions_created += 1
            
        # THEN: Settlement Payouts (Shared Pool -> positive-net members)
        for rec in recipients:
            s = SettlementTransaction(
                group_id=group.id,
                user_id=rec['user_id'],
                amount=rec['amount'],
                type='SETTLEMENT_PAYOUT',
                description='Final settlement payout from the shared pool'
            )
            db.session.add(s)
            transactions_created += 1
            
        db.session.commit()
        return jsonify({'message': f'Settlement complete. {transactions_created} transactions processed.'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Settlement failed', 'details': str(e)}), 500


@app.route('/api/groups/<int:group_id>/payments', methods=['POST'])
@token_required
def add_pool_payment(current_user, group_id):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if current_user.id not in [m.id for m in group.members]:
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.json
    try:
        amount = Decimal(str(data.get('amount')))
    except (ValueError, TypeError, Exception):
        return jsonify({'error': 'Invalid amount'}), 400
        
    if amount <= Decimal('0.00'):
        return jsonify({'error': 'Amount must be greater than zero'}), 400
        
    recipient_name = data.get('recipient_name')
    recipient_upi_id = data.get('recipient_upi_id')
    payment_method = data.get('payment_method')
    description = data.get('description')
    category = data.get('category') or 'Other'
    participants_input = data.get('participants')
    
    group_member_ids = [m.id for m in group.members]
    if participants_input and isinstance(participants_input, list):
        participant_ids = [int(uid) for uid in participants_input if int(uid) in group_member_ids]
    else:
        participant_ids = []
        
    if not participant_ids:
        participant_ids = group_member_ids
        
    import json
    participants_json = json.dumps(participant_ids)
    
    if not recipient_name or not recipient_upi_id:
        return jsonify({'error': 'Recipient name and UPI ID are required'}), 400
        
    if payment_method not in ['QR', 'UPI_ID']:
        return jsonify({'error': 'Invalid payment method'}), 400
        
    try:
        available_pool_balance = calculate_pool_balance(group)
        
        if amount > available_pool_balance:
            return jsonify({'error': f'Insufficient pool balance. Available: ₹{available_pool_balance}'}), 400

            
        import random, string
        receipt_id = f"PYS-{''.join(random.choices(string.digits, k=7))}"
        
        new_payment = PoolPayment(
            group_id=group.id,
            user_id=current_user.id,
            amount=amount,
            recipient_name=recipient_name,
            recipient_upi_id=recipient_upi_id,
            payment_method=payment_method,
            description=description,
            category=category,
            participants_json=participants_json,
            status='SUCCESS',
            receipt_id=receipt_id
        )
        
        db.session.add(new_payment)
        db.session.flush()
        
        shares = split_amount_into_paise(amount, len(participant_ids))
        for uid, share in zip(participant_ids, shares):
            ppp = PoolPaymentParticipant(pool_payment_id=new_payment.id, user_id=uid, share_amount=share)
            db.session.add(ppp)
            
        db.session.commit()
        
        return jsonify({
            'message': 'Payment successful',
            'receipt_id': new_payment.receipt_id,
            'pool_balance': float(available_pool_balance - amount)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred while processing the payment'}), 500


# AWS Lambda + API Gateway entry point.
# Flask is WSGI; Mangum expects ASGI. WsgiToAsgi bridges the protocol.
# Lambda handler config: app.handler (i.e. module "app", attribute "handler")
asgi_app = WsgiToAsgi(app)
handler = Mangum(asgi_app, lifespan="off")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE pool_payments ADD COLUMN category VARCHAR(50) DEFAULT 'Other'"))
                conn.commit()
        except Exception:
            pass
    app.run(debug=False, use_reloader=False, port=5000)
