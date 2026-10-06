'use strict';
const http = require('node:http');
const { Database } = require('./backend/sql');
const { setup } = require('./backend/setup');
const { createApp } = require('./backend/app');
const config = require('./config.json');
const db = new Database(config);
async function main() {
  if (config.host !== '127.0.0.1') throw new Error('This configuration is for local access only.');
  await setup(db, config);
  const server = http.createServer(createApp(db, config));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port already in use. Open http://localhost:3000 or change config.json.' : error.message); db.close(); process.exitCode = 1; });
  server.listen(config.port, config.host, () => console.log(`RelaxCaps: http://localhost:${config.port}\nSQL Server: ${config.sqlServer}\nDatabase: ${config.database}\nStop: Ctrl+C`));
  const shutdown = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(error => { console.error('Startup failed:', error.message); db.close(); process.exitCode = 1; });
