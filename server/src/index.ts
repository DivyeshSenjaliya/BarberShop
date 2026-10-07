import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadEnvFile, loadConfig } from './core/config';
import { createLogger } from './core/logger';
import { migrate } from './db/migrate';
import { migrations } from './db/migrations';
import { openDatabase } from './db/sqlite';
import { createApp } from './http/app';

/**
 * API entrypoint: load config, open the database, apply pending
 * migrations, start listening, and shut down cleanly on a signal so
 * in-flight requests finish and the SQLite file is checkpointed.
 */

loadEnvFile('.env');

const config = loadConfig();
const logger = createLogger({
  level: config.logLevel,
  base: { service: 'barbershop-api', env: config.env },
});

if (config.database.file !== ':memory:') {
  mkdirSync(dirname(config.database.file), { recursive: true });
}

const db = openDatabase(config.database.file);
const migrationResult = migrate(db, migrations, logger);
if (migrationResult.applied.length > 0) {
  logger.info('db.migrations.complete', { applied: migrationResult.applied });
}

const app = createApp({ config, logger, db });

const server = app.listen(config.port, config.host, () => {
  logger.info('server.started', {
    host: config.host,
    port: config.port,
    url: `http://${config.host}:${config.port}`,
  });
});

server.on('error', (error) => {
  logger.error('server.error', { error });
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('server.shutdown', { signal });

  const forceExit = setTimeout(() => {
    logger.error('server.shutdown.timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(() => {
    db.close();
    logger.info('server.stopped');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', { error: reason });
});
