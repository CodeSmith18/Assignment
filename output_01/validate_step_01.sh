#!/bin/bash

# TextFlow Step 1 Validation Script
# Comprehensive validation of project scaffolding

PASS_COUNT=0
TOTAL_TESTS=10

echo "📋 TextFlow Step 1 Validation Report"
echo "======================================"
echo "Testing project: $(pwd)"
echo ""

# Test 1: Directory Structure
echo "🔍 Test 1: Directory Structure"
if [ -d "textflow/server/src" ] && [ -d "textflow/client/src" ] && [ -d "textflow/server/src/db" ] && [ -d "textflow/server/src/routes" ]; then
  echo "✅ Directory structure complete"
  ((PASS_COUNT++))
else
  echo "❌ Directory structure incomplete"
  echo "   Missing: textflow/server/src or textflow/client/src or subdirectories"
fi
echo ""

# Test 2: Git Repository
echo "🔍 Test 2: Git Repository"
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "✅ Git repository initialized"
  ((PASS_COUNT++))
else
  echo "❌ Git repository not initialized"
  echo "   Run: git init"
fi
echo ""

# Test 3: Git Remote
echo "🔍 Test 3: Git Remote Configuration"
if git remote get-url origin 2>/dev/null | grep -q "CodeSmith18/Assignment"; then
  echo "✅ Git remote configured correctly"
  echo "   Remote: $(git remote get-url origin)"
  ((PASS_COUNT++))
else
  echo "❌ Git remote not configured correctly"
  echo "   Expected: https://github.com/CodeSmith18/Assignment.git"
  echo "   Current: $(git remote get-url origin 2>/dev/null || echo 'No remote set')"
fi
echo ""

# Test 4: Server Dependencies
echo "🔍 Test 4: Server Dependencies"
if [ -d "textflow/server/node_modules" ] && [ -f "textflow/server/package.json" ]; then
  echo "✅ Server dependencies installed"
  echo "   Packages: $(ls textflow/server/node_modules/ | wc -l) packages"
  ((PASS_COUNT++))
else
  echo "❌ Server dependencies missing"
  echo "   Run: cd textflow/server && npm install"
fi
echo ""

# Test 5: Client Dependencies
echo "🔍 Test 5: Client Dependencies"
if [ -d "textflow/client/node_modules" ] && [ -d "textflow/client/src" ] && [ -f "textflow/client/package.json" ]; then
  echo "✅ Client dependencies installed"
  echo "   Packages: $(ls textflow/client/node_modules/ | wc -l) packages"
  ((PASS_COUNT++))
else
  echo "❌ Client dependencies missing"
  echo "   Run: cd textflow/client && npm install"
fi
echo ""

# Test 6: Environment Files
echo "🔍 Test 6: Environment Configuration"
if [ -f "textflow/server/.env" ] && [ -f "textflow/server/.env.example" ]; then
  echo "✅ Environment configuration files present"
  # Check if .env has key variables
  if grep -q "FLEXPRICE_API_KEY" textflow/server/.env 2>/dev/null && grep -q "PORT" textflow/server/.env 2>/dev/null; then
    echo "   Contains required variables"
  else
    echo "   ⚠️  Missing some required variables in .env"
  fi
  ((PASS_COUNT++))
else
  echo "❌ Environment configuration missing"
  echo "   Missing: textflow/server/.env or .env.example"
fi
echo ""

# Test 7: Database Schema
echo "🔍 Test 7: Database Initialization"
if [ -f "textflow/server/src/db/init.js" ]; then
  echo "✅ Database initialization script present"
  # Check if the script contains table creation
  if grep -q "CREATE TABLE.*users" textflow/server/src/db/init.js 2>/dev/null; then
    echo "   Contains user table definition"
  fi
  ((PASS_COUNT++))
else
  echo "❌ Database initialization script missing"
  echo "   Missing: textflow/server/src/db/init.js"
fi
echo ""

# Test 8: Server Entry Point
echo "🔍 Test 8: Server Entry Point"
if [ -f "textflow/server/src/server.js" ]; then
  echo "✅ Server entry point present"
  # Check if it contains Express setup
  if grep -q "express" textflow/server/src/server.js 2>/dev/null && grep -q "cors" textflow/server/src/server.js 2>/dev/null; then
    echo "   Contains Express and CORS setup"
  fi
  ((PASS_COUNT++))
else
  echo "❌ Server entry point missing"
  echo "   Missing: textflow/server/src/server.js"
fi
echo ""

# Test 9: React App Structure
echo "🔍 Test 9: React App Structure"
if [ -f "textflow/client/src/App.jsx" ] && [ -f "textflow/client/src/main.jsx" ]; then
  echo "✅ React app structure present"
  # Check if App.jsx contains TextFlow
  if grep -q "TextFlow" textflow/client/src/App.jsx 2>/dev/null; then
    echo "   Contains TextFlow branding"
  fi
  ((PASS_COUNT++))
else
  echo "❌ React app structure incomplete"
  echo "   Missing: textflow/client/src/App.jsx or main.jsx"
fi
echo ""

# Test 10: Vite Configuration
echo "🔍 Test 10: Vite Configuration"
if [ -f "textflow/client/vite.config.js" ]; then
  echo "✅ Vite configuration present"
  # Check if it contains proxy setup
  if grep -q "proxy" textflow/client/vite.config.js 2>/dev/null && grep -q "/api" textflow/client/vite.config.js 2>/dev/null; then
    echo "   Contains API proxy configuration"
  else
    echo "   ⚠️  Missing API proxy configuration"
  fi
  ((PASS_COUNT++))
else
  echo "❌ Vite configuration missing"
  echo "   Missing: textflow/client/vite.config.js"
fi
echo ""

# Final Results
echo "======================================"
echo "📈 FINAL RESULTS: $PASS_COUNT/$TOTAL_TESTS tests passed"
echo ""

if [ $PASS_COUNT -eq $TOTAL_TESTS ]; then
  echo "🎉 Step 1 validation SUCCESSFUL!"
  echo "✅ Ready to proceed to Step 2: Flexprice Client Wrapper"
  echo ""
  echo "Next steps:"
  echo "1. Test server startup: cd textflow/server && npm run dev"
  echo "2. Test client startup: cd textflow/client && npm run dev"
  echo "3. Proceed to instruction_02.md"
elif [ $PASS_COUNT -ge 8 ]; then
  echo "⚠️  Step 1 validation MOSTLY COMPLETE"
  echo "🔧 Minor issues detected - review failed tests above"
  echo "💡 Consider proceeding with caution to Step 2"
else
  echo "❌ Step 1 validation INCOMPLETE"
  echo "🛠️  Critical issues detected - please fix before proceeding"
  echo "📋 Review the failed tests above and re-run validation"
fi

echo ""
echo "======================================"
echo "Validation completed at: $(date)"
