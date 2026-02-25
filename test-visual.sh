#!/bin/bash

# Visual E2E Testing Demo Script
# Run this to see what humans actually see!

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🎨 Visual E2E Testing - What Humans See                    ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Choose how you want to test:"
echo ""
echo "1) 🖥️  Interactive UI Mode (Recommended)"
echo "   Watch tests run in real-time with full browser visibility"
echo "   Command: npm run test:e2e:ui"
echo ""
echo "2) 👁️  Headed Mode (See Browser)"
echo "   Run tests with visible browser window"
echo "   Command: npm run test:e2e -- --headed"
echo ""
echo "3) 📸  Visual Regression (Screenshots)"
echo "   Compare UI to baseline screenshots"
echo "   Command: npm run test:e2e -- e2e/visual.spec.ts"
echo ""
echo "4) 🎥  Slow Motion Demo"
echo "   Run tests slowly for demo/presentation"
echo "   Command: npm run test:e2e -- --headed --slow-mo=1000"
echo ""
echo "5) 🎬  Record New Test"
echo "   Record actions and generate test code"
echo "   Command: npx playwright codegen http://167.179.88.55:8888"
echo ""
echo "6) 📊  View Screenshots"
echo "   View baseline screenshots"
echo "   Location: e2e/visual.spec.ts-snapshots/"
echo ""
echo "7) 📋  Full Test Report"
echo "   Run all tests with HTML report"
echo "   Command: npm run test:e2e -- --reporter=html"
echo ""
echo -n "Enter choice (1-7): "
read choice

case $choice in
    1)
        echo ""
        echo "🖥️  Opening Interactive UI Mode..."
        echo "A browser will open with the Playwright UI"
        echo ""
        npm run test:e2e:ui
        ;;
    2)
        echo ""
        echo "👁️  Running tests with visible browser..."
        echo ""
        npm run test:e2e -- --headed
        ;;
    3)
        echo ""
        echo "📸 Running visual regression tests..."
        echo ""
        npm run test:e2e -- e2e/visual.spec.ts
        echo ""
        echo "✅ Done! Check test-results/ for any diffs"
        ;;
    4)
        echo ""
        echo "🎥 Running in slow motion (1 second per action)..."
        echo ""
        npm run test:e2e -- --headed --slow-mo=1000
        ;;
    5)
        echo ""
        echo "🎬 Opening test recorder..."
        echo "Click around the app and it will generate test code!"
        echo ""
        npx playwright codegen http://167.179.88.55:8888
        ;;
    6)
        echo ""
        echo "📊 Baseline Screenshots:"
        echo ""
        ls -lh e2e/visual.spec.ts-snapshots/
        echo ""
        echo "To view: open e2e/visual.spec.ts-snapshots/*.png"
        ;;
    7)
        echo ""
        echo "📋 Running all tests with HTML report..."
        echo ""
        npm run test:e2e -- --reporter=html
        echo ""
        echo "Opening report..."
        npx playwright show-report
        ;;
    *)
        echo ""
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
