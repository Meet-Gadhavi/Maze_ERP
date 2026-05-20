import os

db_path = 'backend/db.js'
with open(db_path, 'r', encoding='utf-8') as f:
    code = f.read()

if 'let inTransaction = false;' not in code:
    code = code.replace('let db = null;', 'let db = null;\nlet inTransaction = false;')

if 'if (!inTransaction) persist();' not in code:
    code = code.replace('persist();\n  return { changes', 'if (!inTransaction) persist();\n  return { changes')

if 'module.exports.transaction = transaction;' not in code:
    transaction_fn = """
function transaction(cb) {
  run('BEGIN TRANSACTION');
  inTransaction = true;
  try {
    cb();
    inTransaction = false;
    run('COMMIT');
    persist();
  } catch (err) {
    inTransaction = false;
    run('ROLLBACK');
    persist();
    throw err;
  }
}
"""
    code = code.replace('module.exports = { ready, all, get, run, persist };', transaction_fn + '\nmodule.exports = { ready, all, get, run, persist, transaction };')

with open(db_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Added transaction support to db.js")
