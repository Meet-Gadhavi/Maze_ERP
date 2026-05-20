import os

db_path = 'backend/db.js'

with open(db_path, 'r', encoding='utf-8') as f:
    content = f.read()

marker = 'const dbPath = path.join(dbDir, DB_FILE_NAME);'
insert = """
let db = null;
let ready = null;

// Save database to file
function persist() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Initialize database
ready = (async () => {
  const isPackaged = !!process.env.MAZE_USER_DATA;
  
  const SQL = await initSqlJs({
    locateFile: file => {
      if (isPackaged && process.resourcesPath) {
        return path.join(process.resourcesPath, file);
      }
      return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
    }
  });

  console.log(`[Maze ERP] SQLite engine initialized (Data Dir: ${dbDir})`);

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
"""

if marker in content and 'function persist()' not in content:
    content = content.replace(marker, marker + '\n' + insert)
    with open(db_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed db.js successfully")
else:
    print("Marker not found or already fixed")
