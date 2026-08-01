# TextFlow Step 1 Validation Script (PowerShell Version)

$PassCount = 0
$TotalTests = 10

Write-Host "📋 TextFlow Step 1 Validation Report" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Test 1: Directory Structure
if ((Test-Path "textflow/server/src") -and (Test-Path "textflow/client/src")) {
    Write-Host "✅ Directory structure" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Directory structure" -ForegroundColor Red
}

# Test 2: Git Repository
if (Test-Path ".git") {
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Git repository" -ForegroundColor Red
}

# Test 3: Git Remote
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl -and $remoteUrl.Contains("CodeSmith18/Assignment")) {
    Write-Host "✅ Git remote configured" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Git remote" -ForegroundColor Red
}

# Test 4: Server Dependencies
if (Test-Path "textflow/server/node_modules") {
    Write-Host "✅ Server dependencies installed" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Server dependencies" -ForegroundColor Red
}

# Test 5: Client Dependencies  
if (Test-Path "textflow/client/node_modules") {
    Write-Host "✅ Client dependencies installed" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Client dependencies" -ForegroundColor Red
}

# Test 6: Environment Files
if ((Test-Path "textflow/server/.env") -and (Test-Path "textflow/server/.env.example")) {
    Write-Host "✅ Environment configuration" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Environment configuration" -ForegroundColor Red
}

# Test 7: Database Schema
if (Test-Path "textflow/server/src/db/init.js") {
    Write-Host "✅ Database initialization script" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Database initialization" -ForegroundColor Red
}

# Test 8: Server Entry Point
if (Test-Path "textflow/server/src/server.js") {
    Write-Host "✅ Server entry point" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Server entry point" -ForegroundColor Red
}

# Test 9: React App Structure
if (Test-Path "textflow/client/src/App.jsx") {
    Write-Host "✅ React app structure" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ React app structure" -ForegroundColor Red
}

# Test 10: Vite Configuration
if (Test-Path "textflow/client/vite.config.js") {
    Write-Host "✅ Vite configuration" -ForegroundColor Green
    $PassCount++
} else {
    Write-Host "❌ Vite configuration" -ForegroundColor Red
}

Write-Host ""
Write-Host "📈 Results: $PassCount/$TotalTests tests passed" -ForegroundColor Cyan

if ($PassCount -eq $TotalTests) {
    Write-Host "🎉 Step 1 validation SUCCESSFUL!" -ForegroundColor Green
    Write-Host "✅ Ready to proceed to Step 2: Flexprice Client Wrapper" -ForegroundColor Green
} else {
    Write-Host "⚠️  Step 1 validation INCOMPLETE" -ForegroundColor Yellow
    Write-Host "❌ Please review failed tests before proceeding" -ForegroundColor Red
}
