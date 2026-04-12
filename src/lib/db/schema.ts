export const SCHEMA = `
-- User profile table
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT,
  age INTEGER,
  sex TEXT CHECK(sex IN ('male', 'female')),
  height_cm REAL,
  weight_kg REAL,
  activity_level TEXT CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal TEXT CHECK(goal IN ('lose', 'maintain', 'gain')),
  calorie_target INTEGER,
  protein_target_g REAL,
  carb_target_g REAL,
  fat_target_g REAL,
  water_target_ml REAL DEFAULT 2500,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Foods table
CREATE TABLE IF NOT EXISTS foods (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  brand TEXT,
  serving_size_g REAL NOT NULL DEFAULT 100,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  calories REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  fiber_g REAL,
  sugar_g REAL,
  sodium_mg REAL,
  barcode TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
CREATE INDEX IF NOT EXISTS idx_foods_is_deleted ON foods(is_deleted);

-- Food log table
CREATE TABLE IF NOT EXISTS food_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  food_id TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  serving_quantity REAL NOT NULL DEFAULT 1,
  serving_size_g REAL NOT NULL,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  calories REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id),
  FOREIGN KEY (food_id) REFERENCES foods(id)
);

CREATE INDEX IF NOT EXISTS idx_food_log_user_date ON food_log(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_food_log_food_id ON food_log(food_id);
CREATE INDEX IF NOT EXISTS idx_food_log_is_deleted ON food_log(is_deleted);

-- Weight log table
CREATE TABLE IF NOT EXISTS weight_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  note TEXT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_weight_log_user_date ON weight_log(user_id, logged_at);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  total_servings REAL NOT NULL DEFAULT 1,
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_is_deleted ON recipes(is_deleted);

-- Recipe ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  recipe_id TEXT NOT NULL,
  food_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id),
  FOREIGN KEY (food_id) REFERENCES foods(id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- Water log table
CREATE TABLE IF NOT EXISTS water_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  amount_ml REAL NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_water_log_user_date ON water_log(user_id, logged_at);

-- Sync metadata table
CREATE TABLE IF NOT EXISTS sync_meta (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  table_name TEXT NOT NULL UNIQUE,
  last_synced_at TEXT,
  sync_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Unit conversions table
CREATE TABLE IF NOT EXISTS unit_conversions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  food_id TEXT,
  from_unit TEXT NOT NULL,
  to_grams REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (food_id) REFERENCES foods(id)
);

CREATE INDEX IF NOT EXISTS idx_unit_conversions_food_unit ON unit_conversions(food_id, from_unit);

-- Pre-seeded generic unit conversions (food_id IS NULL means generic/global)
INSERT OR IGNORE INTO unit_conversions (id, food_id, from_unit, to_grams)
VALUES
  ('generic-cup',    NULL, 'cup',   240),
  ('generic-tbsp',   NULL, 'tbsp',  15),
  ('generic-tsp',    NULL, 'tsp',   5),
  ('generic-fl_oz',  NULL, 'fl_oz', 30),
  ('generic-oz',     NULL, 'oz',    28.35),
  ('generic-lb',     NULL, 'lb',    453.6),
  ('generic-kg',     NULL, 'kg',    1000),
  ('generic-ml',     NULL, 'ml',    1),
  ('generic-liter',  NULL, 'liter', 1000);
`;
