export interface UserProfile {
  id: string;
  name: string | null;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  goal: string | null;
  calorie_target: number | null;
  protein_target_g: number | null;
  carb_target_g: number | null;
  fat_target_g: number | null;
  water_target_ml: number | null;
  unit_system: string | null;
  created_at: string;
  updated_at: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  serving_size_g: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  barcode: string | null;
  source: string;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  food_id: string;
  meal_type: string;
  serving_quantity: number;
  serving_size_g: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  note: string | null;
  logged_at: string;
  is_deleted: number;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  total_servings: number;
  notes: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  food_id: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
  is_deleted: number;
  created_at: string;
}

export interface UnitConversion {
  id: string;
  food_id: string | null;
  from_unit: string;
  to_grams: number;
  created_at: string;
}

export interface SyncMeta {
  id: string;
  table_name: string;
  last_synced_at: string;
  sync_version: number;
  created_at: string;
  updated_at: string;
}
