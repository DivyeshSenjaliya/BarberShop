import type { Migration } from '../migrate';
import { migration as identity } from './001-identity';

/**
 * Ordered migration registry. Add new migrations here; never edit a
 * migration that has already been applied anywhere (the runner verifies
 * checksums and will refuse to start).
 */
export const migrations: readonly Migration[] = [identity];
