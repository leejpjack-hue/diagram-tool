# Gantt Chart - Design Prototype Specification

## 🎯 Expected UI Behavior

### Desktop View (1280x720)

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  DiagramTool  [Architecture] [Flow] [Gantt ✓]               │
│  [File] [Import CSV] [Export] [Properties]                  │
└─────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────┬──────────────────┐
│              │                          │                  │
│  DSL Editor  │   Gantt Timeline Grid    │   Task List      │
│  (Code)      │   (Visual Chart)         │   (Details)      │
│              │                          │                  │
│  400px       │   Flexible               │   320px          │
│  fixed       │   width                  │   fixed          │
│              │                          │                  │
└──────────────┴──────────────────────────┴──────────────────┘
```

#### Timeline Grid Requirements
- **Grid Lines:** Should be visible and aligned to dates
- **Date Headers:** Should show month/day clearly
- **Task Bars:** Should be horizontally aligned with correct dates
- **Current Date Line:** Red vertical line indicating today
- **Progress Bars:** Should be filled proportionally to completion %

#### Expected Task Bar Positions
```
Task: Planning
  Start: Feb 23, 2026
  End: Feb 26, 2026
  Bar should span: Feb 23 → Feb 26
  Progress: 100% (fully filled)

Task: Requirements
  Start: Feb 26, 2026
  End: Mar 2, 2026
  Bar should span: Feb 26 → Mar 2
  Progress: 60% (60% filled from left)

Task: Design
  Start: Mar 2, 2026
  End: Mar 9, 2026
  Bar should span: Mar 2 → Mar 9
  Progress: 20% (20% filled from left)
```

#### Color Coding (Expected)
- Planning: Blue (#3B82F6)
- Requirements: Green (#10B981)
- Design: Orange (#F59E0B)
- Development: Purple (#8B5CF6)
- Testing: Red (#EF4444)
- Deployment: Gray (#6B7280)

---

### Mobile View (375x667)

#### Expected Layout
```
┌─────────────────────────────────────┐
│  ≡  DiagramTool  [A] [F] [G ✓]      │
│  [File] [Import] [Export] [Props]   │
├─────────────────────────────────────┤
│                                     │
│  DSL Editor (Full Width)            │
│  - Code visible                     │
│  - Scrollable                       │
│                                     │
│  OR                                 │
│                                     │
│  Gantt Timeline (Full Width)        │
│  - Timeline grid                    │
│  - Task bars                        │
│  - Scrollable horizontally          │
│                                     │
└─────────────────────────────────────┘
```

#### Mobile-Specific Requirements
- **Vertical Scrolling:** Should work smoothly
- **Horizontal Scroll:** Timeline should scroll left/right
- **Touch Targets:** Buttons should be at least 44x44px
- **Task List:** Should be below timeline, not side-by-side
- **Editor/Timeline Toggle:** Should switch between views

---

## 🚨 Common UI Issues to Check

### 1. Timeline Alignment Issues
❌ **Bad:** Task bars not aligned with date grid
✅ **Good:** Task bars perfectly aligned with date columns

### 2. Progress Bar Issues
❌ **Bad:** Progress bar shows wrong percentage
✅ **Good:** Progress bar accurately reflects task completion

### 3. Overlapping Elements
❌ **Bad:** Task list panel overlaps timeline
❌ **Bad:** Controls not clickable (overlaid by other elements)
✅ **Good:** All elements properly positioned, no overlap

### 4. Responsive Issues
❌ **Bad:** On mobile, timeline and editor both show (cramped)
❌ **Bad:** Text too small on mobile
❌ **Bad:** Buttons too small for touch
✅ **Good:** Single view at a time on mobile
✅ **Good:** Readable text, large touch targets

### 5. Grid/Date Issues
❌ **Bad:** Date grid lines missing or misaligned
❌ **Bad:** Month labels not visible
❌ **Bad:** Days of week not showing
✅ **Good:** Clear grid with proper date labels

---

## 📋 UI Checklist

### Timeline Grid
- [ ] Grid lines visible and aligned
- [ ] Date headers (Feb, Mar) clearly visible
- [ ] Day numbers visible (23, 24, 25, etc.)
- [ ] Red current-date line visible
- [ ] Zoom controls functional

### Task Bars
- [ ] Correct colors for each task
- [ ] Correct start/end positions
- [ ] Progress fill accurate (100%, 60%, 20%)
- [ ] Task labels visible
- [ ] Bars don't overlap

### Task List Panel (Right Side)
- [ ] Shows all 6 tasks
- [ ] Task names visible
- [ ] Assignees visible (Jack, Sarah, Mike)
- [ ] Progress percentages visible
- [ ] Add Task button visible and clickable

### DSL Editor (Left Side)
- [ ] Code visible and readable
- [ ] Line numbers showing
- [ ] Syntax highlighting working
- [ ] Scrollable vertically

### Controls
- [ ] Day/Week/Month toggle visible
- [ ] Search input functional
- [ ] Filter dropdowns working
- [ ] Date Range picker accessible

---

## 🎨 Visual Hierarchy

### Priority Order (Desktop)
1. **Timeline Grid** (Center) - PRIMARY
2. **Task List** (Right) - SECONDARY
3. **DSL Editor** (Left) - TERTIARY

### Priority Order (Mobile)
1. **Active View** (Full screen) - Either Editor OR Timeline
2. **Controls** (Top) - Navigation between views
3. **Task List** (Bottom or separate view)

---

## 📐 Spacing & Sizing

### Desktop (1280x720)
```
Left Panel (DSL Editor):    400px fixed
Center (Timeline):          Flexible (remaining space)
Right Panel (Task List):    320px fixed
Header Height:              64px
Status Bar Height:          32px
```

### Mobile (375x667)
```
Header Height:              56px
Status Bar Height:          28px
Content Area:               Remaining height
Button Min Size:            44x44px
Text Min Size:              14px
```

---

## 🔍 Issues I Might See in Screenshots

Based on the test results, possible issues:

1. **Task bars not showing** in timeline grid
2. **Progress indicators missing** or wrong
3. **Date grid not aligned** with task bars
4. **Controls not visible/accessible** on mobile
5. **Panel overlap** causing elements to be hidden
6. **Wrong colors** for task bars
7. **Text too small** on mobile
8. **Horizontal scroll not working** on mobile timeline

---

## 📝 Next Steps

1. **Analyze current screenshots** to identify specific issues
2. **Create mockups** showing expected correct UI
3. **Document each issue** with before/after
4. **Fix the issues** in the code
5. **Re-run tests** with corrected UI
6. **Create proper baselines** from fixed UI

---

**This prototype specification will help us identify and fix the actual UI issues!**
