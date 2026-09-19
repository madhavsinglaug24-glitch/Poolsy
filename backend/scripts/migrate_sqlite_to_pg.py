import argparse
import os
import sys
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.exc import SQLAlchemyError

TABLE_ORDER = [
    'users',
    'groups',
    'group_members',
    'contributions',
    'expenses',
    'expense_participants',
    'settlement_transactions',
    'pool_payments',
    'pool_payment_participants'
]

def main():
    parser = argparse.ArgumentParser(description="Migrate data from local SQLite to production PostgreSQL.")
    parser.add_argument('--source', type=str, default='sqlite:///instance/poolsy.db', help='Source SQLite database URL')
    parser.add_argument('--target', type=str, required=True, help='Target PostgreSQL database URL')
    parser.add_argument('--dry-run', action='store_true', help='Inspect databases without modifying the target')
    
    args = parser.parse_args()
    
    source_url = args.source
    
    print(f"Source DB: {source_url}")
    print(f"Target DB: {args.target}")
    if args.dry_run:
        print("--- DRY RUN MODE: No changes will be written to the target database ---")
        
    try:
        source_engine = create_engine(source_url)
        target_engine = create_engine(args.target)
    except Exception as e:
        print(f"Error creating database engines: {e}")
        sys.exit(1)
        
    source_meta = MetaData()
    try:
        source_meta.reflect(bind=source_engine)
    except Exception as e:
        print(f"Failed to read source database schema: {e}")
        sys.exit(1)

    print("\n[Source Database Stats]")
    source_counts = {}
    with source_engine.connect() as s_conn:
        for table_name in TABLE_ORDER:
            if table_name not in source_meta.tables:
                print(f"Warning: Table '{table_name}' not found in source database.")
                continue
            count = s_conn.scalar(text(f"SELECT COUNT(*) FROM {table_name}"))
            source_counts[table_name] = count
            print(f" - {table_name}: {count} rows")
            
    if args.dry_run:
        print("\nDry run completed successfully. Target database was not modified.")
        sys.exit(0)
        
    # Validation before proceeding
    target_meta = MetaData()
    try:
        target_meta.reflect(bind=target_engine)
    except Exception as e:
        print(f"Failed to read target database schema: {e}")
        sys.exit(1)
        
    for table_name in TABLE_ORDER:
        if table_name not in target_meta.tables:
            print(f"Error: Table '{table_name}' does not exist in target database. Please run schema creation first.")
            sys.exit(1)

    print("\n[Starting Migration]")
    try:
        with target_engine.begin() as t_conn:
            with source_engine.connect() as s_conn:
                for table_name in TABLE_ORDER:
                    if table_name not in source_meta.tables:
                        continue
                        
                    count = source_counts.get(table_name, 0)
                    if count == 0:
                        print(f"Skipping {table_name} (0 rows)...")
                        continue
                        
                    print(f"Migrating {table_name} ({count} rows)...")
                    s_table = source_meta.tables[table_name]
                    t_table = target_meta.tables[table_name]
                    
                    rows = s_conn.execute(s_table.select()).fetchall()
                    if rows:
                        # Convert rows to a list of dicts for bulk insert
                        # We use ._mapping for SQLAlchemy 2.x
                        insert_data = []
                        for row in rows:
                            if hasattr(row, '_mapping'):
                                insert_data.append(dict(row._mapping))
                            else:
                                insert_data.append(dict(zip(s_table.columns.keys(), row)))
                        
                        t_conn.execute(t_table.insert(), insert_data)
                        
            print("\nSynchronizing PostgreSQL sequences...")
            for table_name in TABLE_ORDER:
                if table_name not in target_meta.tables:
                    continue
                t_table = target_meta.tables[table_name]
                pk_cols = list(t_table.primary_key.columns)
                if len(pk_cols) == 1 and pk_cols[0].name == 'id':
                    seq_query = text(f"""
                        SELECT setval(
                            pg_get_serial_sequence('{table_name}', 'id'),
                            COALESCE(MAX(id), 1),
                            MAX(id) IS NOT NULL
                        ) FROM {table_name};
                    """)
                    try:
                        t_conn.execute(seq_query)
                        print(f" - Synced sequence for {table_name}")
                    except Exception as seq_err:
                        print(f" - Warning: Failed to sync sequence for {table_name}: {seq_err}")

        print("\nMigration completed successfully!")
    except SQLAlchemyError as e:
        print(f"\nMigration failed! Transaction rolled back. Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
