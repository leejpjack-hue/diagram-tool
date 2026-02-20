// SaveManager - Handles diagram persistence

export type SavedDiagramMode = 'architecture' | 'flow';

export interface SavedDiagram {
  id: string;
  title: string;
  dslText: string;
  mode: SavedDiagramMode;
  createdAt: string;
  updatedAt: string;
  viewState?: {
    zoom: number;
    center: [number, number];
  };
}

export interface DiagramFile {
  version: string;
  exportedAt: string;
  diagram: SavedDiagram;
}

const STORAGE_KEY = 'diagram-tool-saved';
const RECENT_KEY = 'diagram-tool-recent';
const MAX_RECENT = 10;
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

class SaveManager {
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSaveTime: Date | null = null;

  // Generate unique ID
  private generateId(): string {
    return `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save to localStorage
  saveDiagram(diagram: Omit<SavedDiagram, 'id' | 'createdAt' | 'updatedAt'>): SavedDiagram {
    const existing = this.getCurrentDiagram();
    const now = new Date().toISOString();

    const saved: SavedDiagram = {
      ...diagram,
      id: existing?.id || this.generateId(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    this.lastSaveTime = new Date();

    // Add to recent list
    this.addToRecent(saved);

    return saved;
  }

  // Load current diagram
  getCurrentDiagram(): SavedDiagram | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as SavedDiagram;
    } catch {
      return null;
    }
  }

  // Export to file
  exportToFile(diagram: SavedDiagram): void {
    const file: DiagramFile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      diagram,
    };

    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `${diagram.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.diagram`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  }

  // Import from file
  async importFromFile(file: File): Promise<SavedDiagram> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content) as DiagramFile;

          // Validate structure
          if (!data.version || !data.diagram) {
            throw new Error('Invalid diagram file format');
          }

          if (!data.diagram.dslText || !data.diagram.mode) {
            throw new Error('Missing required diagram data');
          }

          // Update timestamps
          const imported: SavedDiagram = {
            ...data.diagram,
            id: this.generateId(),
            createdAt: data.diagram.createdAt,
            updatedAt: new Date().toISOString(),
          };

          resolve(imported);
        } catch {
          reject(new Error('Failed to parse diagram file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  // Recent diagrams
  getRecentDiagrams(): SavedDiagram[] {
    const stored = localStorage.getItem(RECENT_KEY);
    if (!stored) return [];

    try {
      return JSON.parse(stored) as SavedDiagram[];
    } catch {
      return [];
    }
  }

  private addToRecent(diagram: SavedDiagram): void {
    let recent = this.getRecentDiagrams();

    // Remove if already exists
    recent = recent.filter(d => d.id !== diagram.id);

    // Add to front
    recent.unshift(diagram);

    // Keep only last 10
    recent = recent.slice(0, MAX_RECENT);

    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }

  clearRecent(): void {
    localStorage.removeItem(RECENT_KEY);
  }

  // Auto-save
  startAutosave(
    getDiagram: () => Omit<SavedDiagram, 'id' | 'createdAt' | 'updatedAt'> | null
  ): void {
    this.stopAutosave();

    this.autosaveTimer = setInterval(() => {
      const diagram = getDiagram();
      if (diagram) {
        this.saveDiagram(diagram);
        console.log('Auto-saved at', new Date().toLocaleTimeString());
      }
    }, AUTOSAVE_INTERVAL);
  }

  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  getLastSaveTime(): Date | null {
    return this.lastSaveTime;
  }

  // Check if there's unsaved work
  hasUnsavedChanges(currentDsl: string): boolean {
    const saved = this.getCurrentDiagram();
    if (!saved) return currentDsl.trim().length > 0;

    return saved.dslText !== currentDsl;
  }
}

export const saveManager = new SaveManager();
