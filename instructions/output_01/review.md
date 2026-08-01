# Step 1 Verification & Review Guide

This guide details the review steps, expected behaviors, and verification checkpoints for the **Step 1: Project Scaffolding & Git Setup** implementation.

---

## 1. Local Verification Commands

### Part A: Verification of Backend Setup
1. **Navigate to the server directory**:
   ```bash
   cd D:\Assingment\textflow\server
   ```
2. **Start the Express server**:
   ```bash
   npm run dev
   ```
3. **Verify initialization outputs**:
   * Inspect the terminal console log. It should show:
     ```text
     🚀 TextFlow server running on port 4000
     📊 Flexprice API: http://localhost:8080
     🌐 CORS origin: http://localhost:5173
     ✅ Database initialized successfully
     ```
   * Inspect the directory contents to ensure the database file was successfully created:
     * File Path: `D:\Assingment\textflow\server\data\textflow.db` (should be ~32KB in size).

4. **Verify Health Endpoint**:
   * Visit `http://localhost:4000/api/health` in your browser or run:
     ```bash
     curl http://localhost:4000/api/health
     ```
   * Expected Response payload:
     ```json
     {"status":"ok","timestamp":"<current_iso_timestamp>"}
     ```

---

### Part B: Verification of Frontend Setup
1. **Open a new terminal session**.
2. **Navigate to the client directory**:
   ```bash
   cd D:\Assingment\textflow\client
   ```
3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
4. **Open the client address**:
   * Open `http://localhost:5173` in your browser.
   * Verify that the page shows the **TextFlow** navigation header with buttons for `Home`, `Sign Up`, and `Login`.
   * Verify the landing page description displays the plan cards showing the **Free Plan** and **Pro Plan** features.

---

### Part C: Verification of Proxy Routing
1. With both the backend (`:4000`) and frontend (`:5173`) running:
2. Request the backend health endpoint *through* the Vite dev server proxy:
   * Visit `http://localhost:5173/api/health` in your browser.
   * **Expected Result**: It should display the same health check JSON payload as the backend. This proves the Vite dev proxy is correctly catching `/api/*` requests and routing them to the Express server, eliminating CORS issues.

---

### Part D: Verification of Git Setup
1. Run the following command at the root folder `D:\Assingment`:
   ```bash
   git status
   ```
   * **Expected Result**: Output should read `nothing to commit, working tree clean`.
2. Check the remote history:
   ```bash
   git log -n 1
   ```
   * **Expected Result**: Show the commit with hash and description `Initial project scaffolding`.
3. Check the remote mapping:
   ```bash
   git remote -v
   ```
   * **Expected Result**:
     ```text
     origin  https://github.com/CodeSmith18/Assignment.git (fetch)
     origin  https://github.com/CodeSmith18/Assignment.git (push)
     ```
