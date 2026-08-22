import { useEffect, useState } from 'react';
import { DiagramCanvas } from '../Canvas/DiagramCanvas';
import { SequenceCanvas } from '../Sequence/SequenceCanvas';
import { GanttCanvas } from '../Gantt/GanttCanvas';
import { ExportPanel } from '../Panel/ExportPanel';
import { parseDiagram } from '../../parser/parser';
import { parseGanttDSL } from '../Gantt/ganttParser';
import { useDiagramStore } from '../../store/diagramStore';
import { useGanttStore } from '../Gantt/ganttStore';
import { useExport } from '../../utils/useExport';
import { fetchShareSnapshot, ShareGoneError } from '../../utils/shareLinks';
import type { BoardDocument } from '../../utils/boardFormat';
import type { BoardMode } from '../../utils/boardManager';
import { BrandLogo } from '../BrandLogo';

interface ShareViewerProps {
  token: string;
}

export function ShareViewer({ token }: ShareViewerProps) {
  const { setDslText, setDiagramMode, setParsedDiagram, diagramMode } = useDiagramStore();
  const { setProject } = useGanttStore();
  const { exportPNG, exportJPG, exportSVG, exportPDF, exportJSON, exportCSV } = useExport();
  const [document, setDocument] = useState<BoardDocument | null>(null);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchShareSnapshot(token)
      .then(snapshot => {
        if (cancelled) return;
        const mode = snapshot.board.mode as BoardMode;
        setDocument(snapshot);
        setDslText(snapshot.board.dslText);
        setDiagramMode(mode);
        if (mode === 'gantt') {
          const project = parseGanttDSL(snapshot.board.dslText);
          if (project) setProject(project.tasks, project.dependencies ?? []);
        } else if (mode !== 'sequence') {
          try {
            setParsedDiagram(parseDiagram(snapshot.board.dslText));
          } catch {
            setParsedDiagram(null);
          }
        }
      })
      .catch(caught => {
        if (cancelled) return;
        setError(caught instanceof ShareGoneError ? caught.message : 'Could not load this view link.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, setDslText, setDiagramMode, setParsedDiagram, setProject]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-slate-950">This view link is gone</h1>
          <p className="mt-2 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading view-only snapshot…</div>;
  }

  const nodeCount = document.board.nodes?.length ?? 0;
  const mode = document.board.mode as BoardMode;

  return (
    <div className="flex h-screen flex-col bg-slate-50" data-testid="share-viewer">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <BrandLogo size={28} />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-slate-950" data-testid="share-viewer-title">{document.board.title}</h1>
          <p className="text-xs text-slate-500">
            View-only snapshot · no sign-in · <span data-testid="share-viewer-node-count">{nodeCount}</span> nodes
          </p>
        </div>
        <button
          type="button"
          className="ml-auto rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold"
          onClick={() => setExportOpen(open => !open)}
        >
          Export
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-white">
          {mode === 'gantt' ? (
            <GanttCanvas />
          ) : mode === 'sequence' ? (
            <SequenceCanvas readOnly />
          ) : (
            <DiagramCanvas readOnly />
          )}
        </div>
        {exportOpen && (
          <div className="w-80 shrink-0 border-l border-slate-200 bg-white">
            <ExportPanel onExport={format => {
              if (format === 'png') exportPNG();
              else if (format === 'svg') exportSVG();
              else if (format === 'jpg') exportJPG();
              else if (format === 'pdf') exportPDF();
              else if (format === 'json') exportJSON();
              else exportCSV();
            }} />
          </div>
        )}
      </div>
      <p className="sr-only">Diagram mode is {diagramMode}. Deck editing and DSL editing are not available on a view link.</p>
    </div>
  );
}
