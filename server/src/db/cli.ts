import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadEnvFile, loadConfig } from '../core/config';
import { createLogger } from '../core/logger';
import { migrate, migrationStatus } from './migrate';
import { migrations } from './migrations';
import { openDatabase } from './sqlite';

/**
 * Database CLI: `npm run migrate` / `npm run migrate -- status`.
 * Bootstraps the same config and logger as the API process.
 */

function usage(): never {
  process.stderr.write(
    [
      'Usage: npm run migrate -- <command>',
      '',
      'Commands:',
      '  migrate   Apply pending migrations (default)',
      '  status    List migrations and whether they have been applied',
      '',
    ].join('\n'),
  );
  process.exit(2);
}

function main(): void {
  const command = process.argv[2] ?? 'migrate';
  if (!['migrate', 'status'].includes(command)) usage();

  loadEnvFile('.env');
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, base: { component: 'db-cli' } });

  if (config.database.file !== ':memory:') {
    mkdirSync(dirname(config.database.file), { recursive: true });
  }

  const db = openDatabase(config.database.file);
  try {
    if (command === 'status') {
      for (const row of migrationStatus(db, migrations)) {
        const state = row.applied ? `applied ${row.appliedAt}` : 'pending';
        process.stdout.write(`${row.id}  ${row.name.padEnd(24)} ${state}\n`);
      }
      return;
    }

    const result = migrate(db, migrations, logger);
    if (result.applied.length === 0) {
      process.stdout.write(`Database is up to date (${result.alreadyApplied} migrations).\n`);
    } else {
      process.stdout.write(`Applied ${result.applied.length} migration(s): ${result.applied.join(', ')}\n`);
    }
  } finally {
    db.close();
  }
}

main();
