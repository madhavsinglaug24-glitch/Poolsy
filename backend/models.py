from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

group_members = db.Table('group_members',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), primary_key=True)
)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    upi_id = db.Column(db.String(100), nullable=True)
    
    # We remove the peer-to-peer debt concept to focus on standard group pool/wallet tracking
    groups = db.relationship('Group', secondary=group_members, backref=db.backref('members', lazy='selectin'), lazy='selectin')

class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    invite_code = db.Column(db.String(10), unique=True, index=True, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Contribution(db.Model):
    __tablename__ = 'contributions'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    amount = db.Column(db.Numeric(precision=10, scale=2), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = db.relationship('User', lazy='joined')
    group = db.relationship('Group', backref='contributions', lazy='joined')

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False, index=True)
    paid_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    amount = db.Column(db.Numeric(precision=10, scale=2), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    category = db.Column(db.String(100), nullable=True)
    receipt_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Using selectin for eager loading
    payer = db.relationship('User', backref='added_expenses', lazy='joined')
    group = db.relationship('Group', backref='expenses', lazy='joined')
    participants = db.relationship('ExpenseParticipant', backref='expense', lazy='selectin', cascade="all, delete-orphan")

class ExpenseParticipant(db.Model):
    __tablename__ = 'expense_participants'
    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.Integer, db.ForeignKey('expenses.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    share_amount = db.Column(db.Numeric(precision=10, scale=2), nullable=False)
    
    user = db.relationship('User', lazy='joined')

class SettlementTransaction(db.Model):
    __tablename__ = 'settlement_transactions'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    amount = db.Column(db.Numeric(precision=10, scale=2), nullable=False)
    type = db.Column(db.String(50), nullable=False) # 'SETTLEMENT_DEPOSIT' or 'SETTLEMENT_PAYOUT'
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = db.relationship('User', lazy='joined')
    group = db.relationship('Group', backref='settlements', lazy='joined')

class PoolPayment(db.Model):
    __tablename__ = 'pool_payments'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    amount = db.Column(db.Numeric(precision=10, scale=2), nullable=False)
    recipient_name = db.Column(db.String(100), nullable=False)
    recipient_upi_id = db.Column(db.String(100), nullable=False)
    payment_method = db.Column(db.String(50), nullable=False) # 'QR' or 'UPI_ID'
    category = db.Column(db.String(50), default='Other')
    participants_json = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='SUCCESS')
    receipt_id = db.Column(db.String(20), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = db.relationship('User', lazy='joined')
    group = db.relationship('Group', backref='pool_payments', lazy='joined')
    participants = db.relationship('PoolPaymentParticipant', backref='pool_payment', lazy='selectin', cascade="all, delete-orphan")

class PoolPaymentParticipant(db.Model):
    __tablename__ = 'pool_payment_participants'
    id = db.Column(db.Integer, primary_key=True)
    pool_payment_id = db.Column(db.Integer, db.ForeignKey('pool_payments.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    share_amount = db.Column(db.Numeric(precision=10, scale=2), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = db.relationship('User', lazy='joined')

