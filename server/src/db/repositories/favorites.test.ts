import { newId } from '../../core/ids';
import { createTestDb } from '../../test-support/db';
import type { Db } from '../sqlite';
import { FavoritesRepository } from './favorites';

describe('FavoritesRepository', () => {
  let db: Db;
  let repo: FavoritesRepository;
  let userId: string;
  let shopId: string;
  let barberId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new FavoritesRepository(db);

    userId = newId('usr');
    db.run(
      `INSERT INTO users (id, email, email_normalised, password_hash, password_updated_at,
                          first_name, last_name, display_name, role)
       VALUES (?, 'cust@gmail.com', 'cust@gmail.com', 'h', '2026-10-07T00:00:00.000Z',
               'Customer', 'One', 'Customer One', 'customer')`,
      [userId],
    );

    shopId = newId('shop');
    barberId = newId('staff');
  });

  afterEach(() => db.close());

  it('adds, checks, and removes favorites idempotently', () => {
    expect(repo.isFavorite(userId, 'shop', shopId)).toBe(false);

    const fav1 = repo.add(userId, 'shop', shopId);
    expect(fav1.id).toMatch(/^fav_/);
    expect(repo.isFavorite(userId, 'shop', shopId)).toBe(true);

    // Duplicate add returns same existing favorite
    const fav2 = repo.add(userId, 'shop', shopId);
    expect(fav2.id).toBe(fav1.id);

    // Add barber
    repo.add(userId, 'barber', barberId);

    const allFavs = repo.listByUser(userId);
    expect(allFavs).toHaveLength(2);

    const shopOnly = repo.listByUser(userId, 'shop');
    expect(shopOnly).toHaveLength(1);
    expect(shopOnly[0]!.targetId).toBe(shopId);

    // Remove shop
    const removed = repo.remove(userId, 'shop', shopId);
    expect(removed).toBe(true);
    expect(repo.isFavorite(userId, 'shop', shopId)).toBe(false);

    // Remove again returns false
    expect(repo.remove(userId, 'shop', shopId)).toBe(false);
  });
});
