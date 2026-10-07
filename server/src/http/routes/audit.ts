import { Router, type Request, type Response } from 'express';
import type { AppConfig } from '../../core/config';
import type { Db } from '../../db/sqlite';
import { AuditLogsRepository } from '../../db/repositories/auditLogs';
import { authenticate, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../asyncHandler';

export interface AuditRouterDeps {
  db: Db;
  config: AppConfig;
}

export function createAuditRouter(deps: AuditRouterDeps): Router {
  const router = Router();
  const repo = new AuditLogsRepository(deps.db);
  const auth = authenticate(deps);

  // Admin/Owner access to audit trail with audit:read permission
  router.get(
    '/',
    auth,
    requireAuth(),
    requirePermission('audit:read'),
    asyncHandler(async (req: Request, res: Response) => {
      const { userId, action, entityType, entityId, page, limit } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        userId: typeof userId === 'string' ? userId : undefined,
        action: typeof action === 'string' ? action : undefined,
        entityType: typeof entityType === 'string' ? entityType : undefined,
        entityId: typeof entityId === 'string' ? entityId : undefined,
        limit: limitNum,
        offset,
      };

      const logs = repo.list(filters);
      const total = repo.count(filters);

      res.status(200).json({
        data: logs.map((log) => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : null,
        })),
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore: offset + logs.length < total,
        },
      });
    }),
  );

  return router;
}
