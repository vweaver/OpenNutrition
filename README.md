# OpenNutrition — Product Requirements Document

**Version:** 1.0 Draft  
**Date:** March 31, 2026  
**Author:** Lanco Technology LLC  

---

## 1. Overview

OpenNutrition is a fully open-source, self-hostable Progressive Web App (PWA) that replaces proprietary calorie and nutrition trackers like MyFitnessPal. It uses an LLM backend to extract nutrition data from photos of food labels, eliminating tedious manual entry. All user data lives in a local SQLite database on the device (via sql.js / OPFS), with optional sync to a self-hosted backend.

### 1.1 Core Value Proposition

- **Zero manual data entry for packaged foods.** Snap a photo of a nutrition label → LLM extracts every field → user confirms and logs.
- **No account required to start.** Data lives on-device in SQLite. No cloud dependency.
- **Fully open source.** MIT-licensed. No vendor lock-in, no subscriptions, no ads.
- **Works offline.** PWA with service worker caching. Label scanning and sync require connectivity, but logging, browsing history, and viewing dashboards work offline.

### 1.2 Target Users

- People tracking calories, macros, or micronutrients for weight management, athletic performance, or medical dietary needs.
- Privacy-conscious users who don't want their food data in a corporate cloud.
- Self-hosters and tinkerers who want to own their stack.
- Small communities (families, coaching groups) who want a shared instance.

---

## 2. Architecture

### 2.1 High-Level Stack

```
┌─────────────────────────────────────────────────┐
│                   Client (PWA)                  │
│  SvelteKit (or React/Solid) + Tailwind CSS      │
│  sql.js (SQLite compiled to WASM)               │
│  OPFS (Origin Private File System) for storage  │
│  Service Worker for offline + caching           │
│  Camera API for label capture                   │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│              Backend API (Optional)              │
│  Lightweight HTTP server (Go, Python, or Node)   │
│  LLM integration (OpenRouter / Ollama / OpenAI)  │
│  SQLite (server-side) for sync + shared data     │
│  USDA FoodData Central mirror (offline fallback) │
└─────────────────────────────────────────────────┘
```

### 2.2 Why SQLite Everywhere

- **Client-side:** sql.js compiles SQLite to WebAssembly. Paired with OPFS (Origin Private File System), it provides persistent, transactional storage in the browser with no server required. Fallback to IndexedDB-backed storage for browsers without OPFS support.
- **Server-side:** A single SQLite file per user (or one shared database with row-level user scoping). No Postgres/MySQL deployment overhead. Litestream or LiteFS can provide replication if needed.
- **Sync:** Conflict-free merge using CRDTs or a simple last-write-wins strategy with soft deletes and UUIDs as primary keys.

### 2.3 LLM Integration

The LLM is the core differentiator. It handles:

1. **Nutrition label OCR + parsing** — Extract structured data from a photo of a nutrition facts panel.
2. **Serving size interpretation** — Parse "2/3 cup (55g)" into a base unit and allow the user to log fractional servings.
3. **Unit conversions** — Convert between grams, ounces, cups, tablespoons, pieces, etc., using density/weight data when available.
4. **Food identification from photos** — Identify unpackaged foods (an apple, a plate of pasta) and estimate nutrition from the USDA database or LLM knowledge.
5. **Natural language logging** — "I had 2 eggs and a slice of toast with butter" → parsed into individual food items with quantities.

#### 2.3.1 LLM Provider Abstraction

The system must support multiple LLM backends behind a unified interface:

| Provider | Use Case |
|---|---|
| **OpenRouter** | Default cloud option. Lets the user pick model (Claude, GPT-4o, Llama, etc.) with a single API key. |
| **Ollama** | Local/self-hosted. User runs a vision-capable model on their own hardware. Zero cost after setup. |
| **OpenAI-compatible API** | Any provider exposing the OpenAI chat completions format (vLLM, LM Studio, etc.). |
| **Anthropic API direct** | For users who prefer Claude directly. |

The user configures their provider and API key in settings. The PWA stores the key in the local SQLite database (encrypted at rest with a user-provided passphrase, or in the browser's credential store).

#### 2.3.2 Label Scanning Prompt Architecture

The label scanning flow sends a structured prompt to the vision model:

```
System: You are a nutrition data extraction engine. Given a photo of a 
nutrition facts label, extract ALL fields into the following JSON schema. 
If a field is not visible or not applicable, set it to null. Always 
return valid JSON and nothing else.

{
  "product_name": string | null,
  "brand": string | null,
  "serving_size_text": string,        // e.g. "2/3 cup (55g)"
  "serving_size_g": number | null,
  "serving_size_ml": number | null,
  "servings_per_container": number | null,
  "calories": number,
  "total_fat_g": number | null,
  "saturated_fat_g": number | null,
  "trans_fat_g": number | null,
  "polyunsaturated_fat_g": number | null,
  "monounsaturated_fat_g": number | null,
  "cholesterol_mg": number | null,
  "sodium_mg": number | null,
  "total_carbohydrate_g": number | null,
  "dietary_fiber_g": number | null,
  "total_sugars_g": number | null,
  "added_sugars_g": number | null,
  "sugar_alcohols_g": number | null,
  "protein_g": number | null,
  "vitamin_d_mcg": number | null,
  "calcium_mg": number | null,
  "iron_mg": number | null,
  "potassium_mg": number | null,
  "vitamin_a_mcg": number | null,
  "vitamin_c_mg": number | null,
  "barcode": string | null,
  "ingredients_text": string | null,
  "allergens": string[] | null
}

User: [attached image]
```

After receiving the JSON response, the client validates it against the schema, presents it to the user for confirmation/correction, and stores it.

---

## 3. Data Model

All tables use UUIDs as primary keys to support offline-first creation and conflict-free sync. Timestamps are stored as ISO 8601 strings in UTC.

### 3.1 Core Tables

```sql
-- User profile and goals
CREATE TABLE user_profile (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    display_name TEXT,
    height_cm REAL,
    birth_date TEXT,              -- ISO date
    sex TEXT,                     -- 'M', 'F', 'other', or null
    activity_level TEXT,          -- 'sedentary','light','moderate','active','very_active'
    goal TEXT,                    -- 'lose','maintain','gain'
    calorie_target INTEGER,
    protein_target_g REAL,
    carb_target_g REAL,
    fat_target_g REAL,
    fiber_target_g REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT               -- soft delete
);

-- Food definitions (the "database" of known foods)
CREATE TABLE foods (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    source TEXT,                  -- 'label_scan', 'usda', 'manual', 'community'
    serving_size_text TEXT,       -- human-readable: "1 cup (240ml)"
    serving_size_g REAL,
    serving_size_ml REAL,
    servings_per_container REAL,
    calories REAL NOT NULL,
    total_fat_g REAL,
    saturated_fat_g REAL,
    trans_fat_g REAL,
    polyunsaturated_fat_g REAL,
    monounsaturated_fat_g REAL,
    cholesterol_mg REAL,
    sodium_mg REAL,
    total_carbohydrate_g REAL,
    dietary_fiber_g REAL,
    total_sugars_g REAL,
    added_sugars_g REAL,
    sugar_alcohols_g REAL,
    protein_g REAL,
    vitamin_d_mcg REAL,
    calcium_mg REAL,
    iron_mg REAL,
    potassium_mg REAL,
    vitamin_a_mcg REAL,
    vitamin_c_mg REAL,
    ingredients_text TEXT,
    allergens TEXT,               -- JSON array as text
    label_image_hash TEXT,        -- SHA-256 of original label photo
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_name ON foods(name);

-- Daily food log entries
CREATE TABLE food_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES user_profile(id),
    food_id TEXT NOT NULL REFERENCES foods(id),
    log_date TEXT NOT NULL,       -- ISO date (YYYY-MM-DD)
    meal TEXT NOT NULL,           -- 'breakfast','lunch','dinner','snack'
    servings REAL NOT NULL DEFAULT 1.0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX idx_food_log_date ON food_log(user_id, log_date);
CREATE INDEX idx_food_log_meal ON food_log(user_id, log_date, meal);

-- Weight / body measurement log
CREATE TABLE weight_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES user_profile(id),
    log_date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    body_fat_pct REAL,
    waist_cm REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX idx_weight_log_date ON weight_log(user_id, log_date);

-- Custom recipes (composite foods)
CREATE TABLE recipes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES user_profile(id),
    name TEXT NOT NULL,
    servings REAL NOT NULL DEFAULT 1.0,
    instructions TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE recipe_ingredients (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    recipe_id TEXT NOT NULL REFERENCES recipes(id),
    food_id TEXT NOT NULL REFERENCES foods(id),
    servings REAL NOT NULL DEFAULT 1.0,
    sort_order INTEGER DEFAULT 0
);

-- Water intake tracking
CREATE TABLE water_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES user_profile(id),
    log_date TEXT NOT NULL,
    amount_ml REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Sync metadata (for optional server sync)
CREATE TABLE sync_meta (
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    last_synced_at TEXT,
    sync_version INTEGER DEFAULT 0,
    PRIMARY KEY (table_name, row_id)
);
```

### 3.2 Unit Conversion Table

```sql
CREATE TABLE unit_conversions (
    id TEXT PRIMARY KEY,
    food_id TEXT REFERENCES foods(id),  -- null = generic conversion
    from_unit TEXT NOT NULL,            -- 'cup','tbsp','oz','piece','slice', etc.
    to_grams REAL NOT NULL,             -- how many grams = 1 of from_unit
    notes TEXT                          -- e.g. "packed", "level", "heaping"
);
```

Generic conversions (water-based liquids: 1 cup = 240g, 1 tbsp = 15g, etc.) are pre-seeded. Food-specific conversions (1 cup of flour = 125g, 1 medium banana = 118g) can be added manually or pulled from USDA data.

---

## 4. Features

### 4.1 Label Scanning (MVP — Priority 1)

**Flow:**

1. User taps "Scan Label" → camera opens (or file picker on desktop).
2. User captures photo of nutrition facts panel.
3. Image is sent to configured LLM endpoint with the structured extraction prompt.
4. LLM returns JSON → client validates and displays an editable form pre-filled with extracted data.
5. User reviews, corrects if needed, and taps "Save Food."
6. Food is stored in the local `foods` table.
7. User is prompted: "Log this now?" → selects meal slot and number of servings → entry added to `food_log`.

**Edge cases to handle:**

- Partial label (folded, torn, blurry) — LLM returns nulls for missing fields; UI highlights them in yellow for manual entry.
- Dual-column labels ("per serving" vs "per container") — prompt explicitly requests per-serving values.
- Canadian/EU labels with different formatting — prompt handles both FDA and international label formats.
- Multiple photos — user can submit 2-3 photos (front of package + nutrition panel + ingredients list) in a single request.

### 4.2 Barcode Scanning (Priority 2)

- Use a JavaScript barcode scanning library (e.g., `quagga2` or `zxing-js/browser`) to read UPC/EAN codes from the camera.
- Look up the barcode in the local `foods` table first.
- If not found locally, query Open Food Facts API (open-source food database, no key required).
- If still not found, fall back to label scanning.

### 4.3 Food Logging (MVP — Priority 1)

**Methods to add a food log entry:**

| Method | Description |
|---|---|
| **Search** | Type-ahead search across local foods database by name or brand. |
| **Scan label** | Camera → LLM → structured data (see 4.1). |
| **Scan barcode** | Camera → barcode → local DB or Open Food Facts lookup. |
| **Recent / Frequent** | Quick-access list of recently logged and most-frequently logged foods. |
| **Natural language** | Type "2 eggs, 1 toast with 1 tbsp butter" → LLM parses into individual items and quantities, matching against known foods or USDA data. |
| **Recipe** | Select a saved recipe and log a number of servings. |
| **Quick add** | Manual calorie/macro entry without a specific food (e.g., "300 cal, 15g protein"). |
| **Copy meal** | Duplicate all entries from a previous meal or day. |

**Serving size and unit handling:**

- The default serving is whatever the label says (e.g., "2/3 cup (55g)").
- User can adjust by: fractional servings (0.5, 1.5, 2), grams, ounces, or any unit with a known conversion.
- All nutrition values scale linearly based on the serving multiplier.
- The UI shows a live-updating nutrition summary as the user adjusts the serving.

### 4.4 Daily Dashboard (MVP — Priority 1)

- **Calorie ring/bar** — consumed vs. target, color-coded (green = on track, yellow = close, red = over).
- **Macro breakdown** — protein / carbs / fat in grams and percentage, shown as a stacked bar or pie.
- **Meal breakdown** — expandable sections for breakfast, lunch, dinner, snacks with per-meal totals.
- **Water intake** — simple counter with quick-add buttons (+250ml, +500ml, custom).
- **Remaining budget** — "You have X calories and Y g protein left today."

### 4.5 Weight and Body Tracking (MVP — Priority 1)

- Log weight daily (or whenever the user weighs in).
- Support kg and lbs with automatic conversion.
- Optional body fat percentage, waist circumference.
- Trend line chart with 7-day moving average to smooth out daily fluctuations.
- Weight change rate (lbs/week or kg/week) calculated from the trend.

### 4.6 Recipes and Meal Prep (Priority 2)

- Create a recipe by combining multiple food items with quantities.
- Recipe total nutrition is auto-calculated.
- Define number of servings the recipe makes → per-serving nutrition auto-calculated.
- Log a recipe as a single item with a serving count.
- Import recipes from a URL (LLM extracts ingredients and maps to known foods).

### 4.7 Reports and Insights (Priority 2)

- Weekly and monthly calorie and macro averages.
- Weight trend chart overlaid with calorie intake.
- Nutrient gap analysis — highlight consistently low micronutrients (iron, fiber, vitamin D, etc.).
- Export to CSV for external analysis.

### 4.8 Data Import / Export (Priority 2)

- Export entire database as a SQLite file download.
- Export food log as CSV.
- Import from MyFitnessPal CSV export.
- Import from Cronometer CSV export.
- Import foods from USDA FoodData Central bulk download (SR Legacy or Foundation Foods).

### 4.9 Optional Server Sync (Priority 3)

- Self-hosted backend receives encrypted SQLite diffs.
- Multi-device sync using a simple revision-based merge.
- Shared household food database (scan once, everyone can log).
- The server also acts as an LLM proxy so API keys don't live on the client.

---

## 5. User Interface

### 5.1 Screen Map

```
Home (Daily Dashboard)
├── [+] Log Food
│   ├── Search
│   ├── Scan Label (camera)
│   ├── Scan Barcode (camera)
│   ├── Natural Language Input
│   ├── Recent / Frequent
│   └── Quick Add
├── Meals (expandable: Breakfast / Lunch / Dinner / Snacks)
├── Water Tracker
└── Macros Summary

Weight
├── Log Weight
├── Trend Chart
└── History List

Foods
├── My Foods (user-created)
├── Recipes
└── USDA Search

Reports
├── Weekly Summary
├── Monthly Summary
├── Nutrient Gaps
└── Export

Settings
├── Profile & Goals
├── LLM Provider Config
├── Units (metric / imperial)
├── Data Management (import / export / reset)
└── Sync Setup (optional)
```

### 5.2 Design Principles

- **Mobile-first.** The primary use case is standing in a kitchen or at a table. Touch targets, camera access, and one-handed operation come first.
- **One-tap logging.** Relogging a recent food should take exactly one tap from the dashboard.
- **No chrome.** Minimal navigation. Bottom tab bar with 4 tabs: Dashboard, Weight, Foods, Settings. Reports accessible from Dashboard via a "View Reports" link.
- **Accessible.** WCAG 2.1 AA compliant. High contrast mode. Screen reader support. Respects prefers-reduced-motion.
- **Dark mode.** Follows system preference by default, with manual override.

### 5.3 PWA Requirements

- **Installable.** Manifest with icons, splash screen, standalone display mode.
- **Offline-capable.** Service worker caches the app shell and all static assets. Food logging, browsing, and dashboard viewing work without connectivity. Queued scans are processed when connectivity returns.
- **Responsive.** Usable from 320px (small phones) to 1440px+ (desktop). Desktop layout uses a wider single-column with more data density, not a multi-pane layout.
- **Camera access.** Uses `navigator.mediaDevices.getUserMedia()` with environment-facing camera preference. Falls back to file input on unsupported browsers.

---

## 6. Unit Conversion Engine

A critical subsystem that deserves its own section. The conversion engine handles all quantity transformations.

### 6.1 Conversion Hierarchy

When the user wants to log "1.5 cups" of a food whose label says "serving = 30g":

1. Check `unit_conversions` for a food-specific entry (food_id = this food, from_unit = 'cup').
2. If not found, check for a generic entry (food_id = NULL, from_unit = 'cup').
3. If not found, ask the LLM: "How many grams is 1 cup of [food name]?" → cache the result in `unit_conversions`.
4. Convert 1.5 cups → X grams → X / 30g = Y servings → multiply all nutrition values by Y.

### 6.2 Pre-Seeded Generic Conversions

| Unit | Grams |
|---|---|
| 1 cup (liquid) | 240 |
| 1 tbsp | 15 |
| 1 tsp | 5 |
| 1 fl oz | 30 |
| 1 oz (weight) | 28.35 |
| 1 lb | 453.6 |
| 1 kg | 1000 |
| 1 ml | 1 |
| 1 liter | 1000 |

### 6.3 User Preference

The user sets their preferred unit system in settings (metric or imperial). All display values are converted accordingly. Internal storage is always metric (grams, ml, kg, cm).

---

## 7. LLM Cost and Performance

### 7.1 Cost Estimates (Cloud)

Assuming a vision model at roughly $3/M input tokens, $15/M output tokens:

| Action | Est. Tokens | Est. Cost |
|---|---|---|
| Label scan (1 photo + prompt) | ~1,500 in / ~500 out | ~$0.01 |
| Natural language parse | ~300 in / ~400 out | < $0.01 |
| Unit conversion query | ~200 in / ~100 out | < $0.01 |

A heavy user scanning 5 labels/day would cost roughly $1.50/month in API fees. A moderate user scanning a few labels per week: under $0.50/month.

### 7.2 Latency Targets

| Action | Target |
|---|---|
| Label scan → structured data displayed | < 5 seconds |
| Natural language parse | < 3 seconds |
| Unit conversion lookup (LLM fallback) | < 2 seconds |

### 7.3 Local Model Option

For zero-cost operation, users can run Ollama with a vision-capable model (LLaVA, Llama 3.2 Vision, etc.) on their local network. The PWA points to `http://localhost:11434` or a LAN address. Accuracy may be lower than cloud models, but eliminates API costs entirely.

---

## 8. Technology Choices

### 8.1 Recommended Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | SvelteKit | Small bundle, fast PWA, good mobile perf, SSR for optional server mode. React or Solid are fine alternatives. |
| **Styling** | Tailwind CSS | Utility-first, small production CSS, good mobile defaults. |
| **Client DB** | sql.js + OPFS | SQLite in the browser via WASM. OPFS gives persistent file storage. Fallback: IndexedDB via absurd-sql. |
| **Charts** | Chart.js or Lightweight Charts | Small footprint, good mobile touch support. |
| **Camera/Barcode** | getUserMedia + quagga2 | Native camera access, client-side barcode decoding. |
| **PWA** | Workbox | Service worker tooling from Google, well-maintained. |
| **Server (optional)** | Go (or Python FastAPI) | Single binary deployment, low resource usage. Python is fine if the team prefers it. |
| **Server DB** | SQLite + Litestream | Zero-config database with streaming replication to S3/B2 for backup. |
| **LLM Client** | OpenAI SDK (works with OpenRouter, Ollama, and any compatible API) | Single client library covers all providers. |

### 8.2 Build and Deploy

- **Static PWA mode (no server):** `npm run build` → produces a static site deployable to any web host (Cloudflare Pages, Netlify, GitHub Pages, a Synology NAS, etc.). All LLM calls go directly from the browser to the configured API endpoint.
- **Server mode:** Docker container with the backend API + a static file server for the PWA. Single `docker-compose.yml` with the app and optionally Ollama.
- **Mobile:** PWA installed to home screen on iOS/Android. No app store needed.

---

## 9. Privacy and Security

- **No telemetry.** Zero analytics, no tracking, no crash reporting unless the user explicitly opts in.
- **API keys stored locally.** Encrypted in the SQLite database or in the browser credential store. Never transmitted to any server except the configured LLM endpoint.
- **Photos are ephemeral.** Label photos are sent to the LLM for processing and then discarded. They are not stored unless the user explicitly enables "save label photos" (stored locally only, referenced by SHA-256 hash in the foods table).
- **Server sync is encrypted.** If using the optional server, data is encrypted in transit (TLS) and can be encrypted at rest with a user passphrase.
- **No third-party dependencies that phone home.** All dependencies are audited for telemetry. No Google Fonts (self-hosted), no CDN analytics.

---

## 10. MVP Scope

The minimum viable product includes:

1. PWA shell with install prompt, offline caching, and responsive layout.
2. User profile setup (height, weight, goals, calorie/macro targets).
3. Label scanning via camera → LLM → editable nutrition form → save food.
4. Food search (local database).
5. Food logging by meal (breakfast / lunch / dinner / snack) with serving adjustment.
6. Daily dashboard with calorie and macro summary.
7. Weight logging with trend chart.
8. Settings: LLM provider configuration, unit preferences.
9. Data export (SQLite file download + CSV).
10. Local-only operation (no server required).

### 10.1 Post-MVP Roadmap

| Phase | Features |
|---|---|
| **v1.1** | Barcode scanning, Open Food Facts integration, recipe builder. |
| **v1.2** | Natural language logging, copy meal/day, reports and insights. |
| **v1.3** | Optional server sync, multi-device support, shared household food DB. |
| **v1.4** | MyFitnessPal / Cronometer import, USDA bulk import, nutrient gap analysis. |
| **v1.5** | Community food database (opt-in sharing of scanned foods), exercise tracking integration. |

---

## 11. Open Questions

1. **Framework choice** — SvelteKit is recommended but the team should evaluate based on existing skills. React with Vite is the safer choice if SvelteKit expertise is limited.
2. **OPFS browser support** — OPFS is well-supported in Chromium browsers but Safari support has edge cases. Need a robust fallback path (IndexedDB via absurd-sql or wa-sqlite).
3. **LLM accuracy on damaged/partial labels** — Needs real-world testing across a variety of label conditions. Consider a confidence score in the extraction prompt and flag low-confidence fields for manual review.
4. **Sync strategy** — CRDTs are elegant but complex. A simpler "last-write-wins with soft deletes" approach may be sufficient for v1 since nutrition tracking rarely has true write conflicts.
5. **USDA data seeding** — The USDA FoodData Central database is large (~400K foods). Should the PWA ship with a pre-built SQLite of common foods, or start empty and build up from scans and searches?

---

## 12. License

The project and all source code will be released under the **MIT License**. Documentation under CC BY 4.0.
