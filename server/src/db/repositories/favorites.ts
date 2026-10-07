import { newId } from '../../core/ids';
import type { Db } from '../sqlite';

export type FavoriteTargetType = 'shop' | 'barber';

export interface FavoriteRecord {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
}

interface FavoriteRow {
  id: string;
  user_id: string;
  target_type: FavoriteTargetType;
  target_id: string;
  created_at: string;
}

function mapFavoriteRow(row: FavoriteRow): FavoriteRecord {
  return {
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at,
  };
}

const FavoriteColumns = 'id, user_id, target_type, target_id, created_at';

export class FavoritesRepository {
  constructor(private readonly db: Db) {}

  add(userId: string, targetType: FavoriteTargetType, targetId: string): FavoriteRecord {
    const existing = this.find(userId, targetType, targetId);
    if (existing) return existing;

    const id = newId('fav');
    const now = new Date().toISOString();

    this.db.run(
      `INSERT OR IGNORE INTO favorites (id, user_id, target_type, target_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, targetType, targetId, now],
    );

    return this.find(userId, targetType, targetId)!;
  }

  remove(userId: string, targetType: FavoriteTargetType, targetId: string): boolean {
    const res = this.db.run(
      `DELETE FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ?`,
      [userId, targetType, targetId],
    );
    return res.changes > 0;
  }

  isFavorite(userId: string, targetType: FavoriteTargetType, targetId: string): boolean {
    return this.find(userId, targetType, targetId) !== null;
  }

  find(userId: string, targetType: FavoriteTargetType, targetId: string): FavoriteRecord | null {
    const row = this.db.get<FavoriteRow>(
      `SELECT ${FavoriteColumns} FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ?`,
      [userId, targetType, targetId],
    );
    return row ? mapFavoriteRow(row) : null;
  }

  listByUser(userId: string, targetType?: FavoriteTargetType): FavoriteRecord[] {
    const clauses = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (targetType) {
      clauses.push('target_type = ?');
      params.push(targetType);
    }

    return this.db
      .all<FavoriteRow>(
        `SELECT ${FavoriteColumns} FROM favorites WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
        params,
      )
      .map(mapFavoriteRow);
  }
}
