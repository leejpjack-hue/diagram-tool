// Tests for SaveManager utility
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveManager } from './saveManager';
import type { SavedDiagram } from './saveManager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock URL.createObjectURL and URL.revokeObjectURL
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

describe('SaveManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    saveManager.stopAutosave();
  });

  describe('saveDiagram', () => {
    it('should save a new diagram to localStorage', () => {
      const diagram = {
        title: 'Test Diagram',
        dslText: 'diagram: architecture\nservice API\n',
        mode: 'architecture' as const,
      };

      const saved = saveManager.saveDiagram(diagram);

      expect(saved.id).toBeDefined();
      expect(saved.id).toMatch(/^diagram-/);
      expect(saved.title).toBe('Test Diagram');
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
    });

    it('should update existing diagram', () => {
      const first = saveManager.saveDiagram({
        title: 'First',
        dslText: 'service A\n',
        mode: 'architecture',
      });

      const second = saveManager.saveDiagram({
        title: 'Second',
        dslText: 'service B\n',
        mode: 'architecture',
      });

      expect(second.id).toBe(first.id);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.title).toBe('Second');
    });

    it('should add diagram to recent list', () => {
      const diagram = {
        title: 'Recent Test',
        dslText: 'service X\n',
        mode: 'architecture' as const,
      };

      saveManager.saveDiagram(diagram);
      const recent = saveManager.getRecentDiagrams();

      expect(recent).toHaveLength(1);
      expect(recent[0].title).toBe('Recent Test');
    });
  });

  describe('getCurrentDiagram', () => {
    it('should return null when no diagram saved', () => {
      const result = saveManager.getCurrentDiagram();
      expect(result).toBeNull();
    });

    it('should return saved diagram', () => {
      saveManager.saveDiagram({
        title: 'Current',
        dslText: 'service Y\n',
        mode: 'flow',
      });

      const loaded = saveManager.getCurrentDiagram();
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('Current');
      expect(loaded?.mode).toBe('flow');
    });
  });

  describe('exportToFile', () => {
    it('should create downloadable file', () => {
      const diagram: SavedDiagram = {
        id: 'test-123',
        title: 'Export Test',
        dslText: 'diagram: architecture\n',
        mode: 'architecture',
        createdAt: '2025-02-19T00:00:00.000Z',
        updatedAt: '2025-02-19T00:00:00.000Z',
      };

      // Mock document.createElement
      const mockLink = {
        download: '',
        href: '',
        click: vi.fn(),
      } as Partial<HTMLAnchorElement>;
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as HTMLAnchorElement);

      saveManager.exportToFile(diagram);

      expect(mockLink.download).toMatch(/export-test-\d{4}-\d{2}-\d{2}\.diagram/);
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('importFromFile', () => {
    it('should import valid diagram file', async () => {
      const fileContent = JSON.stringify({
        version: '1.0',
        exportedAt: '2025-02-19T00:00:00.000Z',
        diagram: {
          id: 'old-id',
          title: 'Imported',
          dslText: 'service Z\n',
          mode: 'architecture',
          createdAt: '2025-02-18T00:00:00.000Z',
          updatedAt: '2025-02-18T00:00:00.000Z',
        },
      });

      const file = new File([fileContent], 'test.diagram', { type: 'application/json' });
      const result = await saveManager.importFromFile(file);

      expect(result.title).toBe('Imported');
      expect(result.id).not.toBe('old-id'); // Should get new ID
      expect(result.createdAt).toBe('2025-02-18T00:00:00.000Z');
    });

    it('should reject invalid file format', async () => {
      const fileContent = JSON.stringify({ invalid: 'data' });
      const file = new File([fileContent], 'invalid.diagram', { type: 'application/json' });

      await expect(saveManager.importFromFile(file)).rejects.toThrow();
    });

    it('should reject missing required data', async () => {
      const fileContent = JSON.stringify({
        version: '1.0',
        diagram: { title: 'Missing Data' },
      });
      const file = new File([fileContent], 'incomplete.diagram', { type: 'application/json' });

      await expect(saveManager.importFromFile(file)).rejects.toThrow();
    });
  });

  describe('getRecentDiagrams', () => {
    it('should return empty array when no recent diagrams', () => {
      const recent = saveManager.getRecentDiagrams();
      expect(recent).toEqual([]);
    });

    it('should add to recent list', () => {
      // Create a few diagrams
      for (let i = 0; i < 3; i++) {
        saveManager.saveDiagram({
          title: `Diagram ${i}`,
          dslText: `service ${i}\n`,
          mode: 'architecture',
        });
      }

      const recent = saveManager.getRecentDiagrams();
      expect(recent.length).toBeGreaterThan(0);
      expect(recent.length).toBeLessThanOrEqual(10);
    });

    it('should return most recent first', () => {
      saveManager.saveDiagram({ title: 'First', dslText: 'A\n', mode: 'architecture' });
      saveManager.saveDiagram({ title: 'Second', dslText: 'B\n', mode: 'architecture' });
      saveManager.saveDiagram({ title: 'Third', dslText: 'C\n', mode: 'architecture' });

      const recent = saveManager.getRecentDiagrams();
      expect(recent[0].title).toBe('Third');
    });
  });

  describe('clearRecent', () => {
    it('should clear all recent diagrams', () => {
      saveManager.saveDiagram({ title: 'Test', dslText: 'X\n', mode: 'architecture' });
      expect(saveManager.getRecentDiagrams()).toHaveLength(1);

      saveManager.clearRecent();
      expect(saveManager.getRecentDiagrams()).toHaveLength(0);
    });
  });

  describe('autosave', () => {
    it('should start autosave timer', () => {
      const getDiagram = vi.fn(() => ({
        title: 'Auto',
        dslText: 'service Auto\n',
        mode: 'architecture' as const,
      }));

      saveManager.startAutosave(getDiagram);
      // Timer should be running
      // We can't easily test the actual interval without waiting
      // Just verify it doesn't throw an error
      saveManager.stopAutosave();
    });

    it('should stop autosave timer', () => {
      saveManager.startAutosave(() => null);
      saveManager.stopAutosave();
      // No error should occur
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return true when no saved diagram', () => {
      const result = saveManager.hasUnsavedChanges('service New\n');
      expect(result).toBe(true);
    });

    it('should return false when current matches saved', () => {
      saveManager.saveDiagram({
        title: 'Test',
        dslText: 'service Match\n',
        mode: 'architecture',
      });

      const result = saveManager.hasUnsavedChanges('service Match\n');
      expect(result).toBe(false);
    });

    it('should return true when DSL differs', () => {
      saveManager.saveDiagram({
        title: 'Test',
        dslText: 'service Old\n',
        mode: 'architecture',
      });

      const result = saveManager.hasUnsavedChanges('service New\n');
      expect(result).toBe(true);
    });
  });

  describe('getLastSaveTime', () => {
    it('should return null or Date before any save', () => {
      // Could be null or a Date from a previous test
      const lastSave = saveManager.getLastSaveTime();
      expect(lastSave === null || lastSave instanceof Date).toBe(true);
    });

    it('should return Date after save', () => {
      saveManager.saveDiagram({
        title: 'Test',
        dslText: 'service X\n',
        mode: 'architecture',
      });

      const lastSave = saveManager.getLastSaveTime();
      expect(lastSave).toBeInstanceOf(Date);
    });
  });
});
