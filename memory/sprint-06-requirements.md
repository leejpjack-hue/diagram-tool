# Sprint 6 Requirements - Diagram Tool

**Sprint Period:** February 17-21, 2026
**Sprint Goal:** Complete core editing features, add marketing presence, improve stability

---

## Sprint 6.1: Save/Load + Panel Redesigns ✅ COMPLETE
- [x] Save/Load functionality for diagrams
- [x] Panel redesigns for better UX
- [x] Modal backdrop fixes (85% opacity, z-index)

## Sprint 6.2: Decision Nodes + Testing ✅ COMPLETE
- [x] Decision nodes support
- [x] Toast notifications system
- [x] E2E test setup (Playwright)
- [x] Separate Vitest and Playwright configs
- [x] Fix lint errors

## Sprint 6.3: Copy/Paste + Marketing 🔄 IN PROGRESS
- [x] Marketing landing page (`landing/index.html`)
- [x] Copy/paste/duplicate node functionality
- [x] Clipboard utilities with DSL parsing
- [x] Align app design with marketing landing page
- [ ] Fix remaining lint errors (9 issues)
- [ ] Add E2E tests for new copy/paste features

---

## Technical Debt
- 9 lint issues remaining (6 errors, 3 warnings)
  - `csvToDiagram.ts`: 1 error (any type)
  - `App.tsx`: 6 errors (any types, unused vars)
  - `saveManager.test.ts`: 1 error (any type)

## Next Sprint Considerations
- Export to image formats (PNG, SVG)
- Keyboard shortcuts
- Undo/Redo functionality
- Connection routing improvements
- Mobile responsiveness

---

## Architecture Notes
- **Framework:** React 19 + TypeScript + Vite 7
- **State:** Zustand store
- **Diagram Engine:** @xyflow/react
- **Code Editor:** Monaco Editor
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Styling:** Tailwind CSS 4

## Key Files
- `src/App.tsx` - Main application component
- `src/store/diagramStore.ts` - Zustand state management
- `src/utils/clipboardUtils.ts` - Copy/paste/duplicate logic
- `src/parser/` - DSL parsing
- `landing/index.html` - Marketing page
