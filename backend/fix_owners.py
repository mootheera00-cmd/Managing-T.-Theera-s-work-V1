import sqlite3
conn = sqlite3.connect('theera_work.db')
conn.execute("UPDATE projects SET owner_username='N636450' WHERE owner_username='T.Theera'")
conn.commit()
rows = conn.execute('SELECT id, title, owner_username FROM projects').fetchall()
for r in rows:
    print(r)
conn.close()
