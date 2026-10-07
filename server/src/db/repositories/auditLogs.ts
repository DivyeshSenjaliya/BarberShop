import type { Db } from '../sqlite';
import { newId } from '../../core/ids';

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

export interface CreateAuditLogParams {
  id?: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | string | null;
}

export interface ListAuditLogsFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogsRepository {
  constructor(private readonly db: Db) {}

  create(params: CreateAuditLogParams): AuditLogRow {
    const id = params.id ?? newId('aud');
    const createdAt = new Date().toISOString();
    const detailsJson =
      typeof params.details === 'string'
        ? params.details
        : params.details
        ? JSON.stringify(params.details)
        : null;

    this.db.run(
      `INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id,
        ip_address, user_agent, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId ?? null,
        params.action,
        params.entityType,
        params.entityId,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        detailsJson,
        createdAt,
      ]
    );

    return {
      id,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      details: detailsJson,
      created_at: createdAt,
    };
  }

  list(filters: ListAuditLogsFilters = {}): AuditLogRow[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }
    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      conditions.push('entity_id = ?');
      params.push(filters.entityId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = filters.offset ?? 0;

    const sql = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    return this.db.all<AuditLogRow>(sql, [...params, limit, offset]);
  }

  count(filters: Omit<ListAuditLogsFilters, 'limit' | 'offset'> = {}): number {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }
    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      conditions.push('entity_id = ?');
      params.push(filters.entityId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) as cnt FROM audit_logs ${whereClause}`;
    const row = this.db.get<{ cnt: number }>(sql, params);
    return row ? row.cnt : 0;
  }

  findById(id: string): AuditLogRow | null {
    const row = this.db.get<AuditLogRow>('SELECT * FROM audit_logs WHERE id = ?', [id]);
    return row ?? null;
  }
}
