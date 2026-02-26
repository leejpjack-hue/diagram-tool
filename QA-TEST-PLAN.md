# 🧪 QA Test Plan - DiagramTool

**Date:** 2026-02-26
**Version:** 1.0
**Status:** Ready for Testing

---

## 📋 Test Environment

- **URL:** http://167.179.88.55:8888
- **Prototypes:** http://167.179.88.55:8888/prototypes/
- **Browser:** Chrome, Firefox, Safari, Edge
- **Devices:** Desktop, Tablet, Mobile

---

## 🎯 Test Scope

### Pages to Test
1. Architecture Mode
2. Flow Mode
3. Gantt Mode

### Components to Test
1. Header & Navigation
2. DSL Editor
3. Canvas/Diagram Area
4. Side Panels
5. Controls & Buttons
6. Filters & Search
7. Responsive Design

---

## ✅ Test Cases

### 1. Architecture Mode

#### TC-ARCH-001: Page Load
**Steps:**
1. Navigate to http://167.179.88.55:8888
2. Click on "Architecture" tab

**Expected:**
- ✅ Page loads without errors
- ✅ Architecture tab is active (highlighted)
- ✅ DSL editor shows architecture DSL
- ✅ Canvas displays architecture nodes
- ✅ Side panel shows properties

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-ARCH-002: Node Interaction
**Steps:**
1. Click on a node in the canvas
2. Verify node properties appear in side panel

**Expected:**
- ✅ Node becomes selected (highlighted border)
- ✅ Properties panel updates with node details
- ✅ Node can be edited in properties panel

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-ARCH-003: DSL ↔ Canvas Sync
**Steps:**
1. Edit DSL in the editor
2. Change a node name or property
3. Verify canvas updates

**Expected:**
- ✅ Canvas updates immediately
- ✅ Changes reflect in visual nodes
- ✅ No lag or delay

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-ARCH-004: Node Drag & Drop
**Steps:**
1. Click and hold a node
2. Drag to new position
3. Release mouse

**Expected:**
- ✅ Node follows cursor
- ✅ Node stays at new position
- ✅ Connection lines update

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-ARCH-005: Zoom Controls
**Steps:**
1. Click zoom in button (+)
2. Click zoom out button (-)
3. Click fit to screen button

**Expected:**
- ✅ Zoom in enlarges canvas
- ✅ Zoom out shrinks canvas
- ✅ Fit to screen resets view

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

### 2. Flow Mode

#### TC-FLOW-001: Page Load
**Steps:**
1. Click on "Flow" tab

**Expected:**
- ✅ Flow tab is active
- ✅ DSL editor shows flow DSL
- ✅ Canvas displays flowchart
- ✅ Start/End nodes have special colors

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-FLOW-002: Flow Nodes
**Steps:**
1. Verify start node (green)
2. Verify end node (red)
3. Verify decision node (yellow)

**Expected:**
- ✅ Start node has green background
- ✅ End node has red background
- ✅ Decision node has yellow background
- ✅ All nodes display correctly

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-FLOW-003: Flow Arrows
**Steps:**
1. Verify arrows between nodes
2. Check arrow direction
3. Check Yes/No labels on decision paths

**Expected:**
- ✅ Arrows point in correct direction
- ✅ Arrowheads are visible
- ✅ Yes/No labels appear on decision branches

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-FLOW-004: Flow DSL Sync
**Steps:**
1. Edit flow DSL
2. Add new action node
3. Verify canvas updates

**Expected:**
- ✅ New node appears on canvas
- ✅ Connections are correct
- ✅ Layout is automatic

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

### 3. Gantt Mode

#### TC-GANTT-001: Page Load
**Steps:**
1. Click on "Gantt" tab

**Expected:**
- ✅ Gantt tab is active
- ✅ Filter bar appears at top
- ✅ Timeline displays with headers
- ✅ Task list panel on right
- ✅ Task bars visible on timeline

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-002: Task Filters
**Steps:**
1. Type in search box
2. Select assignee from dropdown
3. Select status from dropdown

**Expected:**
- ✅ Search filters tasks by name
- ✅ Assignee filter shows only that person's tasks
- ✅ Status filter shows only matching tasks
- ✅ All filters work together

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-003: Task Bar Interaction
**Steps:**
1. Click on a task bar
2. Drag task bar left/right
3. Verify date changes

**Expected:**
- ✅ Task bar can be clicked
- ✅ Task bar can be dragged
- ✅ Dates update in DSL
- ✅ Task list updates

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-004: Progress Update
**Steps:**
1. Click on task in task list
2. Change progress value
3. Verify progress bar updates

**Expected:**
- ✅ Progress bar fills correctly
- ✅ DSL updates with new progress
- ✅ Visual feedback is immediate

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-005: Add Task
**Steps:**
1. Click "Add Task" button
2. Fill in task details
3. Click Save

**Expected:**
- ✅ Form appears for new task
- ✅ Task appears in task list
- ✅ Task bar appears on timeline
- ✅ DSL updates with new task

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-006: Delete Task
**Steps:**
1. Click on task
2. Click Delete button
3. Confirm deletion

**Expected:**
- ✅ Task is removed from list
- ✅ Task bar disappears from timeline
- ✅ DSL updates

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-007: Task Panel Toggle
**Steps:**
1. Click collapse button on task panel
2. Verify panel hides
3. Click expand button

**Expected:**
- ✅ Panel collapses smoothly
- ✅ Canvas expands to fill space
- ✅ Panel can be expanded again

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-GANTT-008: DSL ↔ Gantt Sync
**Steps:**
1. Edit DSL text
2. Change task dates
3. Verify timeline updates
4. Add new task in UI
5. Verify DSL updates

**Expected:**
- ✅ DSL changes update timeline
- ✅ UI changes update DSL
- ✅ Two-way sync works
- ✅ No data loss

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

### 4. Header & Navigation

#### TC-NAV-001: Tab Switching
**Steps:**
1. Click Architecture tab
2. Click Flow tab
3. Click Gantt tab

**Expected:**
- ✅ Tabs switch correctly
- ✅ Active tab is highlighted
- ✅ Content updates for each mode
- ✅ No state loss when switching

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-NAV-002: Logo
**Steps:**
1. Click on logo

**Expected:**
- ✅ Returns to default mode
- ✅ No errors

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-NAV-003: Export Button
**Steps:**
1. Click Export button

**Expected:**
- ✅ Export panel/dialog opens
- ✅ Export options are available
- ✅ Can export to PNG/SVG/JSON

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-NAV-004: Import CSV
**Steps:**
1. Click Import CSV button
2. Select a CSV file
3. Verify import works

**Expected:**
- ✅ File dialog opens
- ✅ CSV is parsed correctly
- ✅ Data appears in diagram

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

### 5. DSL Editor

#### TC-EDIT-001: Syntax Highlighting
**Steps:**
1. View DSL editor
2. Check for color coding

**Expected:**
- ✅ Keywords are highlighted
- ✅ Properties are highlighted
- ✅ Values are highlighted
- ✅ Comments are visible

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-EDIT-002: Edit & Save
**Steps:**
1. Edit text in DSL editor
2. Check save status

**Expected:**
- ✅ Text is editable
- ✅ Save status shows "Unsaved"
- ✅ Auto-save works

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-EDIT-003: Resize Editor
**Steps:**
1. Drag resize handle
2. Change editor width

**Expected:**
- ✅ Editor width changes
- ✅ Canvas adjusts
- ✅ Smooth resize animation

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

### 6. Responsive Design

#### TC-RESP-001: Mobile View (375px)
**Steps:**
1. Resize browser to 375px width
2. Check all elements

**Expected:**
- ✅ Layout adjusts for mobile
- ✅ All controls accessible
- ✅ Text is readable
- ✅ No horizontal scroll

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-RESP-002: Tablet View (768px)
**Steps:**
1. Resize browser to 768px width
2. Check layout

**Expected:**
- ✅ Layout adjusts for tablet
- ✅ Side panels visible
- ✅ All features work

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-RESP-003: Desktop View (1280px+)
**Steps:**
1. Resize browser to 1280px+ width
2. Check layout

**Expected:**
- ✅ Full desktop layout
- ✅ All panels visible
- ✅ Optimal use of space

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

### 7. Accessibility

#### TC-ACC-001: Keyboard Navigation
**Steps:**
1. Use Tab key to navigate
2. Use Enter to activate

**Expected:**
- ✅ All elements reachable via Tab
- ✅ Focus indicators visible
- ✅ Enter activates buttons

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-ACC-002: Screen Reader
**Steps:**
1. Use screen reader
2. Navigate through app

**Expected:**
- ✅ All elements have labels
- ✅ ARIA attributes present
- ✅ Logical reading order

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

#### TC-ACC-003: Color Contrast
**Steps:**
1. Check text contrast ratios
2. Verify color-blind friendliness

**Expected:**
- ✅ Contrast ratio ≥ 4.5:1
- ✅ Not relying on color alone
- ✅ Clear differentiation

**Status:** ⬜ PASS | ⬜ FAIL
**Notes:** ___________________________

---

## 🐛 Bug Report Template

**Bug ID:** BUG-XXX
**Date:** 2026-02-26
**Severity:** ⬜ Critical | ⬜ High | ⬜ Medium | ⬜ Low
**Priority:** ⬜ P1 | ⬜ P2 | ⬜ P3

**Summary:**
___________________________

**Description:**
___________________________

**Steps to Reproduce:**
1. ___________________________
2. ___________________________
3. ___________________________

**Expected Result:**
___________________________

**Actual Result:**
___________________________

**Screenshots:**
___________________________

**Environment:**
- Browser: ___________________________
- OS: ___________________________
- Device: ___________________________

**Status:** ⬜ Open | ⬜ In Progress | ⬜ Fixed | ⬜ Verified

---

## 📊 Test Summary

**Total Test Cases:** 35
**Passed:** ___
**Failed:** ___
**Blocked:** ___
**Not Tested:** ___

**Pass Rate:** ___%

**Critical Bugs:** ___
**High Bugs:** ___
**Medium Bugs:** ___
**Low Bugs:** ___

**Overall Status:** ⬜ PASS | ⬜ FAIL | ⬜ CONDITIONAL

**Sign-off:**
- QA Lead: ___________________________
- Dev Lead: ___________________________
- Date: ___________________________

---

## 📝 Test Execution Log

| Date | Tester | TC ID | Status | Notes |
|------|--------|-------|--------|-------|
| 2026-02-26 | ______ | ______ | ______ | ______ |
| 2026-02-26 | ______ | ______ | ______ | ______ |
| 2026-02-26 | ______ | ______ | ______ | ______ |

---

## 🎯 Next Steps

1. ⬜ Execute all test cases
2. ⬜ Document bugs found
3. ⬜ Fix critical/high bugs
4. ⬜ Re-test fixed bugs
5. ⬜ Regression testing
6. ⬜ Sign-off

---

**End of Test Plan**
