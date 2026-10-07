import type { Request } from 'express';
import type { Db } from '../db/sqlite';
import { AuditLogsRepository } from '../db/repositories/auditLogs';

export interface AuditEventParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  req?: Request;
  details?: Record<string, unknown> | null;
}

export function recordAuditLog(db: Db, params: AuditEventParams): void {
  try {
    const repo = new AuditLogsRepository(db);
    const ipAddress =
      params.req?.ip ||
      (params.req?.headers['x-forwarded-for'] as string) ||
      params.req?.socket?.remoteAddress ||
      null;
    const userAgent = params.req?.headers['user-agent'] || null;

    repo.create({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
      details: params.details,
    });
  } catch (err) {
    // Non-blocking: audit log errors should never crash request execution
    console.error('Failed to write audit log:', err);
  }
}
