import initSqlJs, { type Database } from 'sql.js';
import { SCHEMA } from './schema';

const DB_STORAGE_KEY = 'opennutrition_db';

let db: Database | null = null;
let useOPFS = false;
let opfsFileHandle: FileSystemFileHandle | null = null;

/**
 * Initialize the sql.js database.
 * Tries OPFS persistence first, falls back to localStorage (base64).
 */
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: () => 'https://sql.js.org/dist/sql-wasm.wasm'
  });

  // Try to load existing data
  const existingData = await loadPersistedData();

  if (existingData) {
    db = new SQL.Database(existingData);
  } else {
    db = new SQL.Database();
  }

  // Run schema (all IF NOT EXISTS, so safe to run every time)
  db.run(SCHEMA);

  // Migrations: add columns that may be missing on older databases
  try {
    const cols = db.exec("PRAGMA table_info(user_profile)");
    const names = cols[0]?.values.map((r) => r[1] as string) ?? [];
    if (!names.includes('unit_system')) {
      db.run("ALTER TABLE user_profile ADD COLUMN unit_system TEXT DEFAULT 'metric'");
    }
  } catch (e) {
    console.error('Migration check failed:', e);
  }

  // Persist after initial schema creation
  await saveDatabase();

  return db;
}

/**
 * Get the current database instance. Throws if not initialized.
 */
export function getDb(): Database {
  if (!db) {
    throw new Error(
      'Database not initialized. Call initDatabase() first.'
    );
  }
  return db;
}

/**
 * Persist the database to storage (OPFS or localStorage).
 */
export async function saveDatabase(): Promise<void> {
  if (!db) return;

  const data = db.export();
  const uint8 = new Uint8Array(data);

  if (useOPFS && opfsFileHandle) {
    try {
      const writable = await (opfsFileHandle as any).createWritable();
      await writable.write(uint8);
      await writable.close();
      return;
    } catch {
      // Fall through to localStorage
    }
  }

  // localStorage fallback: store as base64
  try {
    const binary = String.fromCharCode(...uint8);
    const base64 = btoa(binary);
    localStorage.setItem(DB_STORAGE_KEY, base64);
  } catch (e) {
    console.error('Failed to save database to localStorage:', e);
  }
}

/**
 * Attempt to load persisted database bytes.
 * Tries OPFS first, then localStorage.
 */
async function loadPersistedData(): Promise<Uint8Array | null> {
  // Try OPFS
  try {
    if (
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'getDirectory' in (navigator.storage ?? {})
    ) {
      const root = await navigator.storage.getDirectory();
      opfsFileHandle = await root.getFileHandle('opennutrition.db', {
        create: true
      });
      const file = await opfsFileHandle.getFile();
      if (file.size > 0) {
        const buffer = await file.arrayBuffer();
        useOPFS = true;
        return new Uint8Array(buffer);
      }
      // File exists but is empty — we'll use OPFS for saving
      useOPFS = true;
    }
  } catch {
    // OPFS not available, fall through
    useOPFS = false;
    opfsFileHandle = null;
  }

  // Try localStorage
  try {
    const base64 = localStorage.getItem(DB_STORAGE_KEY);
    if (base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  } catch {
    // localStorage not available
  }

  return null;
}
