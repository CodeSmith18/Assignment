# Step 1: Project Scaffolding & Git Setup
## Implementation Instructions for TextFlow SaaS

### Overview
This step sets up the foundation for the TextFlow AI text processing SaaS application. You'll create both the Express backend and React frontend, establish the directory structure, and initialize version control.

---

## Part A: Git Repository Setup

### 1. Initialize Git Repository
```bash
# Navigate to the assignment directory
cd D:\Assingment

# Initialize git repository
git init

# Add the remote repository
git remote add origin https://github.com/CodeSmith18/Assignment.git

# Create initial .gitignore
echo "node_modules/
.env
*.db
.DS_Store
dist/
.vite/" > .gitignore

# Verify remote is added
git remote -v
```

---

## Part B: Backend Setup (`textflow/server`)

### 1. Create Backend Directory Structure
```bash
# Create the server directory structure
mkdir -p textflow/server/src/db
mkdir -p textflow/server/src/flexprice
mkdir -p textflow/server/src/services
mkdir -p textflow/server/src/routes
mkdir -p textflow/server/src/middleware
mkdir -p textflow/server/scripts
mkdir -p textflow/server/data
```

### 2. Initialize Backend Package
```bash
cd textflow/server

# Initialize npm project
npm init -y

# Update package.json name and add scripts
npm pkg set name="textflow-server"
npm pkg set scripts.dev="node src/server.js"
npm pkg set scripts.seed="node scripts/seed-flexprice.js"
npm pkg set scripts.simulate="node scripts/simulate-pricing.js"
npm pkg set type="module"
```

### 3. Install Backend Dependencies
```bash
# Core dependencies
npm install express express-session cors better-sqlite3 bcrypt axios dotenv nanoid

# Development dependencies (optional)
npm install --save-dev nodemon
npm pkg set scripts.dev="nodemon src/server.js"
```

### 4. Create Environment Configuration
```bash
# Create .env.example file
cat > .env.example << 'EOF'
# Server Configuration
PORT=4000
SESSION_SECRET=your-session-secret-here
CLIENT_ORIGIN=http://localhost:5173

# Flexprice Configuration
FLEXPRICE_BASE_URL=http://localhost:8080
FLEXPRICE_API_KEY=sk_local_flexprice_test_key

# AI Service Configuration
HUGGINGFACE_API_TOKEN=your-hf-token-here

# Generated Flexprice Entity IDs (populated by seed script)
FREE_PLAN_ID=
PRO_PLAN_ID=
CHAR_FEATURE_ID=
TONE_FEATURE_ID=
CHAR_METER_ID=
EOF

# Copy to actual .env file
cp .env.example .env
```

### 5. Create Basic Server File
```bash
# Create src/server.js
cat > src/server.js << 'EOF'
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/init.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Initialize database
initDatabase();

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: Add route handlers
// app.use('/api/auth', authRoutes);
// app.use('/api/process', textRoutes);
// app.use('/api/usage', usageRoutes);
// app.use('/api', billingRoutes);

app.listen(PORT, () => {
  console.log(`🚀 TextFlow server running on port ${PORT}`);
  console.log(`📊 Flexprice API: ${process.env.FLEXPRICE_BASE_URL}`);
  console.log(`🌐 CORS origin: ${process.env.CLIENT_ORIGIN}`);
});
EOF
```

### 6. Create Database Initialization
```bash
# Create src/db/init.js
cat > src/db/init.js << 'EOF'
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/textflow.db');

export function initDatabase() {
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      external_customer_id TEXT UNIQUE NOT NULL,
      flexprice_customer_id TEXT,
      flexprice_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create operations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      operation_type TEXT NOT NULL,
      tone TEXT,
      input_chars INTEGER NOT NULL,
      input_preview TEXT,
      output_preview TEXT,
      flexprice_event_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create simulated_customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS simulated_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_customer_id TEXT UNIQUE NOT NULL,
      profile TEXT NOT NULL,
      flexprice_customer_id TEXT,
      flexprice_subscription_id TEXT
    )
  `);
  
  console.log('✅ Database initialized successfully');
  db.close();
}

export function getDatabase() {
  return new Database(dbPath);
}
EOF
```

---

## Part C: Frontend Setup (`textflow/client`)

### 1. Create React App with Vite
```bash
# Navigate back to textflow directory
cd ../

# Create React app using Vite
npm create vite@latest client -- --template react

# Navigate to client directory
cd client

# Install dependencies
npm install
```

### 2. Configure Vite for API Proxy
```bash
# Update vite.config.js
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
})
EOF
```

### 3. Create Basic Directory Structure
```bash
# Create additional directories
mkdir -p src/pages
mkdir -p src/components
mkdir -p src/context
mkdir -p src/styles

# Update package.json
npm pkg set name="textflow-client"
```

### 4. Create Basic App Structure
```bash
# Create src/App.jsx
cat > src/App.jsx << 'EOF'
import { useState } from 'react';
import './styles/index.css';

function App() {
  const [view, setView] = useState('landing'); // landing, signup, login, dashboard

  return (
    <div className="app">
      <header>
        <h1>TextFlow</h1>
        <nav>
          <button onClick={() => setView('landing')}>Home</button>
          <button onClick={() => setView('signup')}>Sign Up</button>
          <button onClick={() => setView('login')}>Login</button>
        </nav>
      </header>
      
      <main>
        {view === 'landing' && <LandingPage />}
        {view === 'signup' && <SignupPage />}
        {view === 'login' && <LoginPage />}
        {view === 'dashboard' && <DashboardPage />}
      </main>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="landing">
      <h2>AI-Powered Text Processing</h2>
      <p>Summarize and rewrite text with advanced AI models.</p>
      <div className="features">
        <div className="feature">
          <h3>Free Plan</h3>
          <p>2,000 characters/month</p>
          <p>Basic summarize & rewrite</p>
        </div>
        <div className="feature">
          <h3>Pro Plan</h3>
          <p>50,000 characters/month</p>
          <p>Tone selector + advanced features</p>
        </div>
      </div>
    </div>
  );
}

function SignupPage() {
  return <div>Signup Page - TODO</div>;
}

function LoginPage() {
  return <div>Login Page - TODO</div>;
}

function DashboardPage() {
  return <div>Dashboard Page - TODO</div>;
}

export default App;
EOF

# Create basic CSS
cat > src/styles/index.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f8f9fa;
}

.app {
  min-height: 100vh;
}

header {
  background: #fff;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

header h1 {
  color: #2563eb;
  font-size: 1.5rem;
}

nav button {
  margin-left: 1rem;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

nav button:hover {
  background: #f3f4f6;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.landing {
  text-align: center;
}

.landing h2 {
  margin-bottom: 1rem;
  font-size: 2rem;
  color: #1f2937;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.feature {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.feature h3 {
  color: #2563eb;
  margin-bottom: 1rem;
}
EOF

# Update main.jsx to use the new CSS
cat > src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF
```

---

## Part D: Initial Commit

### 1. Add Files to Git
```bash
# Navigate back to root directory
cd ../../

# Add all files
git add .

# Make initial commit
git commit -m "Initial project scaffolding

- Set up Express backend with CORS, sessions, and database
- Created React frontend with Vite and API proxy
- Established directory structure for textflow SaaS
- Added environment configuration templates
- Basic landing page with feature comparison"

# Push to remote repository
git push -u origin main
```

---

## Part E: Verification

### 1. Test Backend Server
```bash
cd textflow/server
npm run dev
```
Visit `http://localhost:4000/api/health` - should return JSON status.

### 2. Test Frontend App
```bash
# In a new terminal
cd textflow/client
npm run dev
```
Visit `http://localhost:5173` - should show the landing page.

### 3. Verify Git Setup
```bash
git status
git remote -v
```

---

## Expected Results After Step 1

✅ **Directory Structure**: Complete folder hierarchy for both backend and frontend
✅ **Git Repository**: Initialized with remote origin configured
✅ **Backend Foundation**: Express server with database, CORS, and sessions
✅ **Frontend Foundation**: React app with Vite, API proxy, and basic routing
✅ **Environment Setup**: Configuration files and examples ready
✅ **Initial Commit**: All scaffolding pushed to GitHub repository

## Next Steps

After completing this step, you'll be ready for **Step 2: Flexprice Client Wrapper** where you'll build the backend modules to communicate with your running Flexprice instance.

---

## Troubleshooting

**Port conflicts**: If port 4000 or 5173 are in use, update the PORT in `.env` and CLIENT_ORIGIN accordingly.

**Database issues**: Ensure the `textflow/server/data/` directory exists and is writable.

**CORS errors**: Verify CLIENT_ORIGIN in `.env` matches your React dev server URL.

**Git push errors**: Ensure you have write access to the GitHub repository and have configured your Git credentials.