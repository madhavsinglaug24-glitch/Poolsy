import sqlite3
import secrets
import string

def generate_invite_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))

def migrate():
    conn = sqlite3.connect('instance/poolsy.db')
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(groups)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'invite_code' not in columns:
        print("Adding invite_code column to groups table...")
        cursor.execute("ALTER TABLE groups ADD COLUMN invite_code VARCHAR(10)")
        
        # Create unique index (will fail if duplicates exist, which they won't since they're NULL initially)
        # SQLite allows creating unique index on columns with NULLs in newer versions, but to be safe, 
        # we will backfill first, then create the index.
    
    # Backfill missing invite codes
    cursor.execute("SELECT id FROM groups WHERE invite_code IS NULL")
    groups = cursor.fetchall()
    
    for (group_id,) in groups:
        while True:
            code = generate_invite_code()
            # Ensure unique
            cursor.execute("SELECT id FROM groups WHERE invite_code = ?", (code,))
            if not cursor.fetchone():
                cursor.execute("UPDATE groups SET invite_code = ? WHERE id = ?", (code, group_id))
                print(f"Backfilled Group {group_id} with code {code}")
                break
                
    # Now create index if it doesn't exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='ix_groups_invite_code'")
    if not cursor.fetchone():
        print("Creating index ix_groups_invite_code...")
        cursor.execute("CREATE UNIQUE INDEX ix_groups_invite_code ON groups (invite_code)")
        
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate()
