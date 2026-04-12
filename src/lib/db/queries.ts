import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDatabase } from './index';
import type {
  UserProfile,
  Food,
  FoodLog,
  WeightLog,
  WaterLog,
  UnitConversion
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a SELECT and return typed rows. */
function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/** Run a SELECT and return the first row or null. */
function queryOne<T>(sql: string, params: unknown[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows[0] ?? null;
}

/** Run a mutation (INSERT / UPDATE / DELETE) and auto-save. */
async function mutate(sql: string, params: unknown[] = []): Promise<void> {
  const db = getDb();
  db.run(sql, params);
  await saveDatabase();
}

function now(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// ---------------------------------------------------------------------------
// UserProfile
// ---------------------------------------------------------------------------

export function getProfile(): UserProfile | null {
  return queryOne<UserProfile>('SELECT * FROM user_profile LIMIT 1');
}

export async function upsertProfile(
  data: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
): Promise<UserProfile> {
  const existing = getProfile();
  const ts = now();

  if (existing) {
    const fields = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = Object.values(data);
    await mutate(
      `UPDATE user_profile SET ${fields}, updated_at = ? WHERE id = ?`,
      [...values, ts, existing.id]
    );
    return { ...existing, ...data, updated_at: ts };
  }

  const id = uuidv4();
  const keys = ['id', ...Object.keys(data), 'created_at', 'updated_at'];
  const placeholders = keys.map(() => '?').join(', ');
  const values = [id, ...Object.values(data), ts, ts];
  await mutate(
    `INSERT INTO user_profile (${keys.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return queryOne<UserProfile>('SELECT * FROM user_profile WHERE id = ?', [id])!;
}

// ---------------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------------

export function getFoods(search?: string): Food[] {
  if (search) {
    return queryAll<Food>(
      'SELECT * FROM foods WHERE is_deleted = 0 AND name LIKE ? ORDER BY name',
      [`%${search}%`]
    );
  }
  return queryAll<Food>(
    'SELECT * FROM foods WHERE is_deleted = 0 ORDER BY name'
  );
}

export function getFoodById(id: string): Food | null {
  return queryOne<Food>('SELECT * FROM foods WHERE id = ? AND is_deleted = 0', [
    id
  ]);
}

export async function createFood(
  data: Omit<Food, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>
): Promise<Food> {
  const id = uuidv4();
  const ts = now();
  await mutate(
    `INSERT INTO foods (id, name, brand, serving_size_g, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, barcode, source, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      data.name,
      data.brand ?? null,
      data.serving_size_g,
      data.serving_unit,
      data.calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
      data.fiber_g ?? null,
      data.sugar_g ?? null,
      data.sodium_mg ?? null,
      data.barcode ?? null,
      data.source,
      ts,
      ts
    ]
  );
  return queryOne<Food>('SELECT * FROM foods WHERE id = ?', [id])!;
}

export async function updateFood(
  id: string,
  data: Partial<Omit<Food, 'id' | 'created_at' | 'updated_at'>>
): Promise<Food | null> {
  const ts = now();
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(data);
  await mutate(
    `UPDATE foods SET ${fields}, updated_at = ? WHERE id = ?`,
    [...values, ts, id]
  );
  return getFoodById(id);
}

export async function deleteFood(id: string): Promise<void> {
  await mutate('UPDATE foods SET is_deleted = 1, updated_at = ? WHERE id = ?', [
    now(),
    id
  ]);
}

// ---------------------------------------------------------------------------
// FoodLog
// ---------------------------------------------------------------------------

export function getLogByDate(userId: string, date: string): FoodLog[] {
  return queryAll<FoodLog>(
    `SELECT * FROM food_log
     WHERE user_id = ? AND date(logged_at) = date(?) AND is_deleted = 0
     ORDER BY logged_at`,
    [userId, date]
  );
}

export function getLogByDateRange(
  userId: string,
  start: string,
  end: string
): FoodLog[] {
  return queryAll<FoodLog>(
    `SELECT * FROM food_log
     WHERE user_id = ? AND date(logged_at) >= date(?) AND date(logged_at) <= date(?) AND is_deleted = 0
     ORDER BY logged_at`,
    [userId, start, end]
  );
}

export async function createLogEntry(
  data: Omit<FoodLog, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>
): Promise<FoodLog> {
  const id = uuidv4();
  const ts = now();
  await mutate(
    `INSERT INTO food_log (id, user_id, food_id, meal_type, serving_quantity, serving_size_g, serving_unit, calories, protein_g, carbs_g, fat_g, logged_at, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      data.user_id,
      data.food_id,
      data.meal_type,
      data.serving_quantity,
      data.serving_size_g,
      data.serving_unit,
      data.calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
      data.logged_at,
      ts,
      ts
    ]
  );
  return queryOne<FoodLog>('SELECT * FROM food_log WHERE id = ?', [id])!;
}

export async function updateLogEntry(
  id: string,
  data: Partial<Omit<FoodLog, 'id' | 'created_at' | 'updated_at'>>
): Promise<FoodLog | null> {
  const ts = now();
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(data);
  await mutate(
    `UPDATE food_log SET ${fields}, updated_at = ? WHERE id = ?`,
    [...values, ts, id]
  );
  return queryOne<FoodLog>('SELECT * FROM food_log WHERE id = ? AND is_deleted = 0', [id]);
}

export async function deleteLogEntry(id: string): Promise<void> {
  await mutate(
    'UPDATE food_log SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now(), id]
  );
}

export function getRecentFoods(userId: string, limit = 10): Food[] {
  return queryAll<Food>(
    `SELECT DISTINCT f.* FROM foods f
     INNER JOIN food_log fl ON fl.food_id = f.id
     WHERE fl.user_id = ? AND fl.is_deleted = 0 AND f.is_deleted = 0
     ORDER BY fl.logged_at DESC
     LIMIT ?`,
    [userId, limit]
  );
}

export function getFrequentFoods(userId: string, limit = 10): Food[] {
  return queryAll<Food>(
    `SELECT f.*, COUNT(fl.id) as usage_count FROM foods f
     INNER JOIN food_log fl ON fl.food_id = f.id
     WHERE fl.user_id = ? AND fl.is_deleted = 0 AND f.is_deleted = 0
     GROUP BY f.id
     ORDER BY usage_count DESC
     LIMIT ?`,
    [userId, limit]
  );
}

// ---------------------------------------------------------------------------
// WeightLog
// ---------------------------------------------------------------------------

export function getWeightLogs(userId: string, limit?: number): WeightLog[] {
  if (limit) {
    return queryAll<WeightLog>(
      'SELECT * FROM weight_log WHERE user_id = ? AND is_deleted = 0 ORDER BY logged_at DESC LIMIT ?',
      [userId, limit]
    );
  }
  return queryAll<WeightLog>(
    'SELECT * FROM weight_log WHERE user_id = ? AND is_deleted = 0 ORDER BY logged_at DESC',
    [userId]
  );
}

export async function createWeightLog(
  data: Omit<WeightLog, 'id' | 'is_deleted' | 'created_at'>
): Promise<WeightLog> {
  const id = uuidv4();
  const ts = now();
  await mutate(
    `INSERT INTO weight_log (id, user_id, weight_kg, note, logged_at, is_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, data.user_id, data.weight_kg, data.note ?? null, data.logged_at, ts]
  );
  return queryOne<WeightLog>('SELECT * FROM weight_log WHERE id = ?', [id])!;
}

export async function deleteWeightLog(id: string): Promise<void> {
  await mutate(
    'UPDATE weight_log SET is_deleted = 1 WHERE id = ?',
    [id]
  );
}

// ---------------------------------------------------------------------------
// WaterLog
// ---------------------------------------------------------------------------

export function getWaterByDate(userId: string, date: string): WaterLog[] {
  return queryAll<WaterLog>(
    `SELECT * FROM water_log
     WHERE user_id = ? AND date(logged_at) = date(?) AND is_deleted = 0
     ORDER BY logged_at`,
    [userId, date]
  );
}

export async function addWater(
  data: Omit<WaterLog, 'id' | 'is_deleted' | 'created_at'>
): Promise<WaterLog> {
  const id = uuidv4();
  const ts = now();
  await mutate(
    `INSERT INTO water_log (id, user_id, amount_ml, logged_at, is_deleted, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, data.user_id, data.amount_ml, data.logged_at, ts]
  );
  return queryOne<WaterLog>('SELECT * FROM water_log WHERE id = ?', [id])!;
}

export async function deleteWater(id: string): Promise<void> {
  await mutate(
    'UPDATE water_log SET is_deleted = 1 WHERE id = ?',
    [id]
  );
}

// ---------------------------------------------------------------------------
// UnitConversions
// ---------------------------------------------------------------------------

export function getConversion(
  foodId: string | null,
  fromUnit: string
): UnitConversion | null {
  // Try food-specific first, then fall back to generic
  if (foodId) {
    const specific = queryOne<UnitConversion>(
      'SELECT * FROM unit_conversions WHERE food_id = ? AND from_unit = ?',
      [foodId, fromUnit]
    );
    if (specific) return specific;
  }
  return queryOne<UnitConversion>(
    'SELECT * FROM unit_conversions WHERE food_id IS NULL AND from_unit = ?',
    [fromUnit]
  );
}

export async function addConversion(
  data: Omit<UnitConversion, 'id' | 'created_at'>
): Promise<UnitConversion> {
  const id = uuidv4();
  const ts = now();
  await mutate(
    `INSERT INTO unit_conversions (id, food_id, from_unit, to_grams, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.food_id ?? null, data.from_unit, data.to_grams, ts]
  );
  return queryOne<UnitConversion>(
    'SELECT * FROM unit_conversions WHERE id = ?',
    [id]
  )!;
}
