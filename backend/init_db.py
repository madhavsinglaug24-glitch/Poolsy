import sqlite3
from app import app, db
import models

with app.app_context():
    print("Creating tables...")
    db.create_all()
    print("Done creating tables.")

c = sqlite3.connect('instance/poolsy.db')
print("Instance DB tables:", c.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall())
