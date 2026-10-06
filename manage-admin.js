'use strict';
const { Database } = require('./backend/sql');
const config = require('./config.json');
async function main() {
  const login = process.argv[2];
  if (!login) throw new Error('Usage: node manage-admin.js LOGIN [--revoke]');
  const db = new Database(config);
  try {
    const rows = await db.query('UPDATE dbo.users SET is_admin=@admin,updated_at=SYSUTCDATETIME() OUTPUT INSERTED.login,INSERTED.is_admin AS isAdmin WHERE login=@login;', { login, admin: process.argv.includes('--revoke') ? 0 : 1 });
    if (!rows.length) throw new Error('Account not found. Register this login on the website first.');
    console.log(JSON.stringify(rows[0]));
  } finally { db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
