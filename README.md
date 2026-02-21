# DiagramTool

Transform text into professional diagrams. Write simple DSL code, generate beautiful architecture diagrams instantly.

## Features

- **Simple DSL Syntax** - Write diagrams in plain text, no drag-and-drop required
- **Architecture Mode** - Visualize microservices, databases, queues, and connections
- **Flow Mode** - Model business processes, claims workflows, and decision trees
- **CSV Import** - Import data from APM tools (Datadog, Jaeger, OpenTelemetry)
- **Multi-Format Export** - Export to PNG, SVG, or JSON
- **Auto-Save & History** - Automatic saving with access to last 10 diagrams

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## DSL Examples

### Architecture Mode

```
diagram: architecture
title: Claims Platform

service ClaimsAPI {
  type: api
  connects: ClaimsService
}

service ClaimsService {
  type: microservice
  connects: ClaimsDB, EventQueue
}

database ClaimsDB {
  type: postgresql
}

queue EventQueue {
  type: kafka
}
```

### Flow Mode

```
diagram: flow
title: Claims Processing Flow

start FNOL

FNOL -> Intake
Intake -> Assignment
Assignment -> Investigation

Investigation ->|Fraud Detected| SpecialInvestigation
Investigation ->|No Fraud| Evaluation

Evaluation -> Settlement
Settlement -> Payment -> Closure

end Closure

node FNOL {
  label: First Notice of Loss
  system: ClaimsAPI
  duration: 1d
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save diagram |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected node |
| `Ctrl+V` | Paste node |
| `Ctrl+D` | Duplicate selected node |
| `Delete` | Delete selected node |
| `Escape` | Deselect |

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests (requires Playwright browsers)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Build Status

| Metric | Status |
|--------|--------|
| Build | ✅ Passing |
| Unit Tests | ✅ 32/32 (100%) |
| Bundle Size | 456.79 kB JS, 29.72 kB CSS |
| TypeScript | ✅ No errors |
| Lint | ⚠️ 6 errors, 3 warnings |

## Project Structure

```
diagram-tool/
├── src/
│   ├── components/      # React components
│   ├── parser/          # DSL parser
│   ├── utils/           # Utilities (save, CSV, etc.)
│   └── types/           # TypeScript types
├── e2e/                 # Playwright E2E tests
├── landing/             # Marketing landing page
├── samples/             # Sample diagrams
└── public/              # Static assets
```

## Sprint Progress

**Current Sprint:** Sprint 6 (Save/Load + Flow Mode + E2E Testing)
**Progress:** 92% complete
**Status:** Feature-complete, minor lint cleanup needed

### Completed Features
- ✅ Save/Load with auto-save (30s)
- ✅ File export/import (.diagram format)
- ✅ Recent diagrams history
- ✅ Decision node diamond visuals
- ✅ Toast notification system
- ✅ Copy/paste/duplicate nodes
- ✅ Marketing landing page

### Pending
- ⏸️ E2E test execution (requires browser dependencies)
- 📝 Lint error cleanup (6 errors)

## Documentation

- [Sprint 6 Requirements](../memory/sprint-06-requirements.md)
- [Productivity Tracking](../memory/productivity-tracking.md)

## License

MIT
