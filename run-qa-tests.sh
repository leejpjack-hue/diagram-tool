#!/bin/bash

# QA Test Execution Script
# DiagramTool - Automated Testing

echo "🧪 Starting QA Tests for DiagramTool..."
echo "========================================"
echo ""

# Test Configuration
BASE_URL="http://167.179.88.55:8888"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_FILE="qa-test-report-${TIMESTAMP}.md"

# Create report file
cat > $REPORT_FILE << EOF
# QA Test Report - DiagramTool

**Date:** $(date +"%Y-%m-%d %H:%M:%S")
**Tester:** Automated Script
**Environment:** Production (http://167.179.88.55:8888)

---

## Test Execution Summary

EOF

# Counter
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=0

# Function to test HTTP status
test_url() {
    local url=$1
    local test_name=$2
    local expected_status=${3:-200}

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo "Testing: $test_name"
    echo "URL: $url"

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $url)

    if [ "$HTTP_STATUS" -eq "$expected_status" ]; then
        echo "✅ PASS - Status: $HTTP_STATUS"
        echo "" >> $REPORT_FILE
        echo "### ✅ $test_name" >> $REPORT_FILE
        echo "- **URL:** $url" >> $REPORT_FILE
        echo "- **Status:** $HTTP_STATUS" >> $REPORT_FILE
        echo "- **Result:** PASS" >> $REPORT_FILE
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "❌ FAIL - Status: $HTTP_STATUS (Expected: $expected_status)"
        echo "" >> $REPORT_FILE
        echo "### ❌ $test_name" >> $REPORT_FILE
        echo "- **URL:** $url" >> $REPORT_FILE
        echo "- **Status:** $HTTP_STATUS (Expected: $expected_status)" >> $REPORT_FILE
        echo "- **Result:** FAIL" >> $REPORT_FILE
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    echo ""
}

# Function to check if file/directory exists
test_file_exists() {
    local file=$1
    local test_name=$2

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo "Testing: $test_name"
    echo "File/Dir: $file"

    if [ -e "$file" ]; then
        echo "✅ PASS - Exists"
        echo "" >> $REPORT_FILE
        echo "### ✅ $test_name" >> $REPORT_FILE
        echo "- **File/Dir:** $file" >> $REPORT_FILE
        echo "- **Result:** PASS (Exists)" >> $REPORT_FILE
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "❌ FAIL - Not found"
        echo "" >> $REPORT_FILE
        echo "### ❌ $test_name" >> $REPORT_FILE
        echo "- **File/Dir:** $file" >> $REPORT_FILE
        echo "- **Result:** FAIL (Not found)" >> $REPORT_FILE
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    echo ""
}

echo "📡 Testing HTTP Endpoints..."
echo "----------------------------"
echo "" >> $REPORT_FILE
echo "## 📡 HTTP Endpoint Tests" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Test main application
test_url "$BASE_URL" "Main Application Load" 200
test_url "$BASE_URL/index.html" "Index Page" 200

# Test prototypes
test_url "$BASE_URL/prototypes/" "Prototypes Index" 200
test_url "$BASE_URL/prototypes/index.html" "Prototypes Index Page" 200
test_url "$BASE_URL/prototypes/architecture-mode.html" "Architecture Mode Prototype" 200
test_url "$BASE_URL/prototypes/flow-mode.html" "Flow Mode Prototype" 200
test_url "$BASE_URL/prototypes/gantt-mode.html" "Gantt Mode Prototype" 200

# Test design system
test_url "$BASE_URL/PROFESSIONAL-DESIGN-SHOWCASE.html" "Design System Showcase" 200

# Test static assets
test_url "$BASE_URL/vite.svg" "Vite SVG Icon" 200

echo ""
echo "📁 Testing File Existence..."
echo "----------------------------"
echo "" >> $REPORT_FILE
echo "## 📁 File Existence Tests" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Test source files
test_file_exists "src/App.tsx" "Main App Component"
test_file_exists "src/index.css" "Main CSS File"
test_file_exists "src/styles/professional.css" "Professional Design System"
test_file_exists "src/components/Gantt/GanttCanvas.tsx" "Gantt Canvas Component"
test_file_exists "src/components/Gantt/ganttGenerator.ts" "Gantt DSL Generator"

# Test prototype files
test_file_exists "prototypes/index.html" "Prototypes Index"
test_file_exists "prototypes/architecture-mode.html" "Architecture Prototype"
test_file_exists "prototypes/flow-mode.html" "Flow Prototype"
test_file_exists "prototypes/gantt-mode.html" "Gantt Prototype"

# Test documentation
test_file_exists "QA-TEST-PLAN.md" "QA Test Plan"
test_file_exists "PROFESSIONAL-DESIGN-GUIDE.md" "Design Guide"
test_file_exists "PROFESSIONAL-DESIGN-COMPLETE.md" "Design Completion Report"

# Test build output
test_file_exists "dist/index.html" "Build Output - index.html"
test_file_exists "dist/assets" "Build Output - assets directory"

echo ""
echo "🔍 Testing Application Features..."
echo "----------------------------------"
echo "" >> $REPORT_FILE
echo "## 🔍 Application Feature Tests" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Test build status
echo "Checking build status..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if [ -f "dist/index.html" ] && [ -d "dist/assets" ]; then
    echo "✅ PASS - Build output exists"
    echo "" >> $REPORT_FILE
    echo "### ✅ Build Status" >> $REPORT_FILE
    echo "- **Result:** PASS" >> $REPORT_FILE
    echo "- **Details:** Build output found in dist/" >> $REPORT_FILE
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "❌ FAIL - Build output missing"
    echo "" >> $REPORT_FILE
    echo "### ❌ Build Status" >> $REPORT_FILE
    echo "- **Result:** FAIL" >> $REPORT_FILE
    echo "- **Details:** Build output not found" >> $REPORT_FILE
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# Test server status
echo "Checking server status..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))

SERVER_PROCESS=$(ps aux | grep "server_8888.py" | grep -v grep | wc -l)

if [ "$SERVER_PROCESS" -gt 0 ]; then
    echo "✅ PASS - Server is running"
    echo "" >> $REPORT_FILE
    echo "### ✅ Server Status" >> $REPORT_FILE
    echo "- **Result:** PASS" >> $REPORT_FILE
    echo "- **Details:** Server process found on port 8888" >> $REPORT_FILE
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "❌ FAIL - Server not running"
    echo "" >> $REPORT_FILE
    echo "### ❌ Server Status" >> $REPORT_FILE
    echo "- **Result:** FAIL" >> $REPORT_FILE
    echo "- **Details:** No server process found" >> $REPORT_FILE
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# Calculate results
PASS_RATE=$(( (PASS_COUNT * 100) / TOTAL_TESTS ))

# Add summary to report
cat >> $REPORT_FILE << EOF

---

## 📊 Test Results Summary

**Total Tests:** $TOTAL_TESTS
**Passed:** $PASS_COUNT ✅
**Failed:** $FAIL_COUNT ❌

**Pass Rate:** ${PASS_RATE}%

---

## 🎯 Overall Status

EOF

if [ $FAIL_COUNT -eq 0 ]; then
    echo "**Result:** ✅ ALL TESTS PASSED" >> $REPORT_FILE
    echo ""
    echo "🎉 ALL TESTS PASSED!"
    echo "Pass Rate: ${PASS_RATE}%"
else
    echo "**Result:** ⚠️ SOME TESTS FAILED" >> $REPORT_FILE
    echo ""
    echo "⚠️ SOME TESTS FAILED"
    echo "Passed: $PASS_COUNT / $TOTAL_TESTS"
    echo "Failed: $FAIL_COUNT"
fi

echo ""
echo "📄 Test report saved to: $REPORT_FILE"
echo "========================================"
echo "QA Testing Complete!"
