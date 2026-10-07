import type { Migration } from '../migrate';

export const migration: Migration = {
  id: '010',
  name: 'staff-leaves-enrichment',
  sql: `
ALTER TABLE staff_leaves ADD COLUMN leave_type TEXT NOT NULL DEFAULT 'vacation';
ALTER TABLE staff_leaves ADD COLUMN reject_reason TEXT;
`,
};
