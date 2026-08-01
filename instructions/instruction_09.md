# Step 9: React Frontend Implementation
## Implementation Instructions for TextFlow SaaS

### Overview
This step implements the React frontend application for TextFlow. The client will integrate signup/login forms, a dashboard with character counts, tone options (Pro plan locked), real-time usage bars, payment modals, and historical log displays.

---

## Part A: API Client & State Management

### 1. Create API Wrapper
**File:** `textflow/client/src/api.js`
- Set up an axios instance with base URL `http://localhost:4000` (or dynamic based on configuration).
- Enable `withCredentials: true` to persist sessions automatically.

### 2. Create Auth Context
**File:** `textflow/client/src/context/AuthContext.jsx`
- Manage authenticated user state.
- Provide `signup`, `login`, `logout`, and auto-verify checks on startup.

---

## Part B: Components

### 3. Usage Visualization
**File:** `textflow/client/src/components/UsageBar.jsx`
- Displays percentage metrics for character consumption.
- Alerts user when they are near limits.

### 4. Tone Selector
**File:** `textflow/client/src/components/ToneSelector.jsx`
- Renders rewrite tones (Default, Professional, Casual, Academic, Creative).
- Visually badges Pro-only tones and opens the upgrade dialog on click.

### 5. Upgrade Modal
**File:** `textflow/client/src/components/UpgradeModal.jsx`
- Compares Free vs Pro options.
- Fires plan upgrades and downgrades, updating local states on success.

---

## Part C: Main Dashboard & Page Layouts

### 6. Dashboard Workspace
**File:** `textflow/client/src/pages/Dashboard.jsx`
- Main container representing text processing capabilities, output views, stats, and historical logs.

### 7. App Integration
**File:** `textflow/client/src/App.jsx`
- Orchestrates view flows.
