import type { Migration } from '../migrate';
import { migration as bookings } from './004-bookings';
import { migration as catalog } from './002-catalog';
import { migration as identity } from './001-identity';
import { migration as staffing } from './003-staffing';

/**
 * Ordered migration registry. Add new migrations here; never edit a
 * migration that has already been applied anywhere (the runner verifies
 * checksums and will refuse to start).
 */
export const migrations: readonly Migration[] = [identity, catalog, staffing, bookings];
