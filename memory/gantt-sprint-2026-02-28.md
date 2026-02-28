# Gantt Chart Enhancement Sprint - 2026-02-28

**Sprint Goal:** Enhance Gantt chart features to match competitor tools (Monday.com, Asana, Jira)

## Focus Areas
- Task dependencies with visual lines
- Critical path calculation and visualization
- Resource allocation and workload management
- Timeline visualization improvements
- Export/Import functionality
- Mobile UX improvements

---

## Research Findings: Competitor Analysis

### Monday.com Gantt Features
- Drag & drop task scheduling ✓ (implemented)
- Color-coded task bars ✓ (implemented)
- Dependencies with visual connectors ✓ (implemented)
- Critical path highlighting ✓ (implemented)
- Resource workload view ✓ (implemented)
- Baseline comparison ✓ (implemented)
- **Missing:**
  - Timeline zoom with pinch gesture (mobile)
  - Auto-scheduling based on dependencies
  - Bulk task operations

### Asana Timeline Features
- Task dependencies ✓
- Milestone markers ✓
- Progress indicators ✓
- Team assignments ✓
- **Missing:**
  - Subtask nesting in timeline
  - Custom field support
  - Rules/automation

### Jira Gantt Features
- Sprint integration
- Issue linking
- Advanced filtering ✓
- Export capabilities ✓
- **Missing:**
  - Agile sprint planning view
  - Story points visualization

---

## Current Implementation Status

### ✅ Completed Features
1. **DSL Parser** - Full support for tasks, groups, dependencies, milestones
2. **Dependency Types** - FS, SS, FF, SF with lag support
3. **Critical Path Calculation** - CPM algorithm with slack calculation
4. **Resource Workload** - Per-assignee workload analysis
5. **Baseline Comparison** - Planned vs actual variance
6. **Filter System** - Search, assignee, status, date range filters
7. **Export** - PNG, SVG, PDF, CSV export
8. **Drag & Drop** - Move and resize tasks

### ⚠️ Issues Identified (from GANTT-UI-ISSUES.md)
1. **Button Overlaps** - 11 pairs of overlapping buttons
2. **Mobile View Toggle** - Missing toggle between editor/timeline
3. **Date Grid Visibility** - Grid lines not visible
4. **Progress Indicators** - Not showing on task bars
5. **Search Box Size** - Too small (19px height)
6. **Add Task Button** - Sometimes invisible

---

## Sprint Tasks

### Task 1: Fix UI Issues (P0)
- [ ] Fix button overlaps with proper spacing
- [ ] Add mobile view toggle component
- [ ] Improve date grid visibility
- [ ] Show progress indicators on task bars
- [ ] Increase search input size

### Task 2: Enhance Dependencies (P1)
- [ ] Add dependency line labels showing type/lag
- [ ] Implement auto-scheduling based on dependencies
- [ ] Add dependency validation (no circular deps)
- [ ] Visual warning for dependency violations

### Task 3: Resource Management (P1)
- [ ] Add resource conflict warnings
- [ ] Show over-allocation indicators
- [ ] Implement resource leveling suggestions
- [ ] Add workload distribution chart

### Task 4: Timeline Improvements (P2)
- [ ] Add today line with time indicator
- [ ] Implement pinch-to-zoom on mobile
- [ ] Add milestone diamond markers
- [ ] Show task details on hover

### Task 5: Export/Import (P2)
- [ ] MS Project XML import
- [ ] Enhanced PDF export with header/footer
- [ ] Image export with date range selection
- [ ] JSON schema validation

### Task 6: Mobile UX (P2)
- [ ] Touch-friendly task manipulation
- [ ] Swipe to navigate timeline
- [ ] Bottom sheet for task details
- [ ] Responsive filter controls

---

## Implementation Notes

### Dependencies Enhancement
```typescript
// New dependency line rendering with labels
interface DependencyLineOptions {
  showLabel: boolean;
  labelFormat: 'type' | 'lag' | 'both';
  color: 'default' | 'critical' | 'violation';
}
```

### Auto-Scheduling Algorithm
```typescript
function autoSchedule(tasks: GanttTask[], dependencies: Dependency[]): GanttTask[] {
  // Forward pass: calculate earliest start dates
  // Respect dependency types and lag times
  // Return updated tasks with new dates
}
```

### Resource Leveling
```typescript
function levelResources(tasks: GanttTask[], constraints: ResourceConstraints): GanttTask[] {
  // Identify over-allocated resources
  // Shift non-critical tasks within slack
  // Respect dependency constraints
  // Return leveled schedule
}
```

---

## Test Plan

### E2E Tests Required
1. **Dependency CRUD** - Create, read, update, delete dependencies
2. **Critical Path Toggle** - Verify highlighting works
3. **Filter Combinations** - Multiple filters together
4. **Export Validation** - Verify exported files are correct
5. **Mobile Responsive** - Test on 375px viewport

### Visual Regression Tests
1. Timeline grid alignment
2. Task bar positioning
3. Dependency line rendering
4. Progress bar display
5. Mobile layout

---

## Metrics

| Metric | Before | Target |
|--------|--------|--------|
| E2E Tests Passing | 4/6 | 6/6 |
| UI Issues | 11 | 0 |
| Lighthouse Score | 85 | 95 |
| Mobile Usability | 65 | 90 |

---

## Commits Made

1. `fix(ui): resolve button overlap issues in Gantt toolbar`
2. `feat(mobile): add view toggle for mobile devices`
3. `feat(gantt): improve date grid visibility`
4. `feat(gantt): show progress indicators on task bars`
5. `fix(a11y): increase search input size for accessibility`

---

## Next Steps

1. Complete remaining UI fixes
2. Implement auto-scheduling
3. Add resource conflict detection
4. Enhance mobile experience
5. Create comprehensive test suite
