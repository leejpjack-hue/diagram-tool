# Visual & Interactive E2E Testing Guide

## 🎨 Three Ways to Test What Humans Actually See

---

## 1. 📸 Visual Regression Testing (Automated Screenshots)

Visual tests compare screenshots to detect unexpected UI changes.

### Setup Visual Tests
```bash
cd /home/jack/.openclaw/workspace/diagram-tool

# Run visual tests for the first time (creates baseline)
npm run test:e2e -- --grep "Visual"

# Update baselines after intentional changes
npm run test:e2e -- --grep "Visual" -- --update-snapshots
```

### What Gets Tested:
- ✅ Architecture diagram rendering
- ✅ Flow diagram rendering
- ✅ Gantt chart rendering
- ✅ Node hover states
- ✅ Toast notifications
- ✅ Properties panel
- ✅ Export panel
- ✅ File menu dropdown
- ✅ Zoom visual feedback
- ✅ Mobile responsive (375x667)
- ✅ Tablet responsive (768x1024)

### How It Works:
1. First run: Takes screenshots and saves as "baseline"
2. Future runs: Takes screenshots and compares to baseline
3. If different: Test fails and shows diff image
4. If expected change: Update baseline with `--update-snapshots`

---

## 2. 🖥️ Interactive UI Mode (Manual Testing)

Playwright UI mode lets you see tests run in real-time with full browser visibility.

### Start Interactive Mode
```bash
cd /home/jack/.openclaw/workspace/diagram-tool

# Open Playwright UI
npm run test:e2e:ui
```

This opens a web interface where you can:
- 👀 Watch tests run in real-time
- ⏸️ Pause tests at any point
- 🔄 Step through tests manually
- 📸 Take screenshots
- 🔍 Inspect elements
- 🎯 Record new tests
- 📊 View test traces

### UI Mode Features:
- **Time Travel:** Go back to any action
- **Locator Picker:** Click elements to get selectors
- **Code Generator:** Record actions to code
- **Screenshots:** Capture at any point
- **Network Tab:** See all API calls
- **Console:** View browser logs

### What You'll See:
1. Browser window (full visual)
2. Test execution timeline
3. Action log with screenshots
4. Source code viewer
5. Network requests
6. Console output

---

## 3. 🎥 Headed Mode (See the Browser)

Run tests with visible browser window instead of headless.

### Run Tests with Browser Visible
```bash
# Run all tests with visible browser
npm run test:e2e -- --headed

# Run specific test with visible browser
npm run test:e2e -- --headed --grep "should zoom"

# Slow down execution to watch
npm run test:e2e -- --headed --slow-mo=1000  # 1 second delay per action
```

### Debug Mode
```bash
# Step through tests manually
npm run test:e2e -- --debug

# Opens with Playwright Inspector
# - Pause/resume execution
# - Step over actions
# - Inspect page state
# - Modify selectors
```

---

## 🚀 Quick Start: Test Like a Human

### Option A: Watch All Tests Run
```bash
npm run test:e2e -- --headed
```
Opens browser, runs all tests, you watch.

### Option B: Interactive Testing
```bash
npm run test:e2e:ui
```
Opens UI, pick tests, watch in real-time.

### Option C: Visual Regression
```bash
npm run test:e2e -- e2e/visual.spec.ts
```
Creates screenshots, compares to baseline.

---

## 📸 Viewing Screenshots

### From Failed Tests
```bash
# View test results
cd /home/jack/.openclaw/workspace/diagram-tool
ls test-results/

# Open screenshot
open test-results/*/test-failed-1.png

# View all screenshots
find test-results -name "*.png" -exec open {} \;
```

### From Visual Tests
```bash
# Baseline screenshots
ls e2e/__snapshots__/

# Diff images (when tests fail)
ls test-results/*/
```

---

## 🎯 Recommended Testing Workflow

### For Development
```bash
# 1. Write test
npm run test:e2e -- --ui

# 2. Record actions in UI mode
# 3. Save test
# 4. Run visual regression
npm run test:e2e -- e2e/visual.spec.ts
```

### For Manual Testing
```bash
# 1. Open UI mode
npm run test:e2e:ui

# 2. Click through tests
# 3. Pause at interesting points
# 4. Take screenshots
# 5. Inspect elements
```

### For Visual Review
```bash
# 1. Generate baseline screenshots
npm run test:e2e -- e2e/visual.spec.ts -- --update-snapshots

# 2. View screenshots in e2e/__snapshots__/
# 3. After changes, run again
# 4. Review diffs in test-results/
```

---

## 🔧 Advanced: Accessibility Testing

Visual tests include accessibility scanning:

```typescript
test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');
  
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

This tests:
- Color contrast
- Keyboard navigation
- Screen reader compatibility
- ARIA labels
- Form labels

---

## 📊 Test Reports

### HTML Report
```bash
npm run test:e2e -- --reporter=html
# Opens interactive HTML report with screenshots
```

### Trace Viewer
```bash
npm run test:e2e -- --trace on
# After test run:
npx playwright show-trace trace.zip
```

Shows:
- DOM snapshots
- Network requests
- Console logs
- Screenshots
- Source code

---

## 💡 Pro Tips

### 1. Record New Tests
```bash
# Start code generator
npx playwright codegen http://167.179.88.55:8888

# Interact with page
# It generates test code automatically
```

### 2. Test Specific Viewport
```bash
# Mobile
npm run test:e2e -- --viewport=375,667

# Desktop HD
npm run test:e2e -- --viewport=1920,1080
```

### 3. Slow Motion for Demo
```bash
npm run test:e2e -- --headed --slow-mo=500
# Great for demos and videos
```

### 4. Video Recording
```bash
npm run test:e2e -- --video=on
# Saves video in test-results/
```

---

## 🎬 Examples

### Run Visual Tests with Browser Visible
```bash
npm run test:e2e -- e2e/visual.spec.ts --headed --slow-mo=500
```

### Interactive Debugging
```bash
npm run test:e2e:ui
# Then click "Debug" on any test
```

### Generate Test from Actions
```bash
npx playwright codegen http://167.179.88.55:8888
# Click around, it writes the test
```

---

## 📁 File Structure

```
diagram-tool/
├── e2e/
│   ├── architecture.spec.ts      # Functional tests
│   ├── visual.spec.ts            # Visual/UI tests ✨ NEW
│   └── __snapshots__/            # Baseline screenshots
│       ├── visual-architecture.png
│       └── visual-flow.png
└── test-results/                 # Test artifacts
    └── test-name/
        ├── test-failed-1.png     # Failure screenshots
        ├── trace.zip             # Execution trace
        └── video.webm            # Video recording
```

---

## ✅ Summary

| Method | Use Case | Command |
|--------|----------|---------|
| **Visual Regression** | Detect UI changes | `npm run test:e2e -- e2e/visual.spec.ts` |
| **Interactive UI** | Manual testing | `npm run test:e2e:ui` |
| **Headed Mode** | Watch tests | `npm run test:e2e -- --headed` |
| **Debug Mode** | Step through | `npm run test:e2e -- --debug` |
| **Code Generator** | Record tests | `npx playwright codegen <url>` |

---

**Now you can test exactly what humans see!** 🎨
