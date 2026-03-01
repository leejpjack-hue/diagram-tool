#!/bin/bash

# Auto Test Runner for Gantt Chart Features
# Usage: ./run-auto-tests.sh [phase]

set -e

echo "🧪 Gantt Chart Auto Test Runner"
echo "================================"
echo ""

# Check if server is running
if ! curl -s http://localhost:8888 > /dev/null 2>&1; then
    echo "⚠️  Dev server not running on port 8888"
    echo "Starting server..."
    npm run dev &
    SERVER_PID=$!
    sleep 10
fi

echo "✅ Server is running"
echo ""

# Run tests based on phase argument
case "$1" in
  "1"|"phase1")
    echo "📋 Running Phase 1: Basic Functionality Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts -g "Phase 1"
    ;;
  "2"|"phase2")
    echo "📋 Running Phase 2: Delay Impact Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts -g "Phase 2"
    ;;
  "3"|"phase3")
    echo "📋 Running Phase 3: Auto-Schedule Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts -g "Phase 3"
    ;;
  "4"|"phase4")
    echo "📋 Running Phase 4: Drag & Drop Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts -g "Phase 4"
    ;;
  "5"|"phase5")
    echo "📋 Running Phase 5: Integration Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts -g "Integration"
    ;;
  "6"|"phase6")
    echo "📋 Running Phase 6: UI/UX Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts -g "UI/UX"
    ;;
  "all"|"")
    echo "📋 Running All Tests"
    npx playwright test tests/e2e/gantt-full-test.spec.ts
    ;;
  *)
    echo "❌ Invalid phase: $1"
    echo "Usage: $0 [1|2|3|4|5|6|all]"
    exit 1
    ;;
esac

echo ""
echo "✅ Tests completed!"
echo "📊 View report: npx playwright show-report"
