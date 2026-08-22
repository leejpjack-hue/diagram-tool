import { useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useDiagramStore } from '../../store/diagramStore';
import { installDiagramDslTestHook } from '../../utils/devTestHook';
import { applyBoardSource, toDslSource, toMermaidSource } from '../../utils/sourceText';
import type { BoardMode } from '../../utils/boardManager';

function asBoardMode(mode: string): BoardMode {
  return mode === 'flow' || mode === 'sequence' || mode === 'gantt' ? mode : 'architecture';
}

export function DSLEditor() {
  const { dslText, setDslText, setParsedDiagram, setError, setLoading, diagramMode, error } = useDiagramStore();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const applySource = useCallback((value: string) => {
    setDslText(value);
    const mode = asBoardMode(diagramMode);
    if (mode === 'gantt') return;

    setLoading(true);
    const result = applyBoardSource(value, mode);
    if (result.ok) {
      setError(null);
      if (result.kind === 'diagram') setParsedDiagram(result.parsed);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [diagramMode, setDslText, setParsedDiagram, setError, setLoading]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) applySource(value);
  }, [applySource]);

  useEffect(() => {
    applySource(dslText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return installDiagramDslTestHook(
      text => handleEditorChange(text),
      undefined,
      () => useDiagramStore.getState().dslText,
    );
  }, [handleEditorChange]);

  const showCopy = diagramMode === 'flow' || diagramMode === 'sequence';

  const copy = async (kind: 'mermaid' | 'dsl') => {
    const payload = kind === 'mermaid'
      ? toMermaidSource(dslText, asBoardMode(diagramMode))
      : toDslSource(dslText, asBoardMode(diagramMode));
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus(kind === 'mermaid' ? 'Copied Mermaid' : 'Copied DSL');
    } catch {
      setCopyStatus('Copy failed');
    }
    window.setTimeout(() => setCopyStatus(null), 1600);
  };

  return (
    <div className="editor-panel" style={{ height: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="editor-header">
        <div className="editor-title">Editor</div>
        <div className="editor-subtitle">Describe your diagram in plain text</div>
        {showCopy && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="copy-as-mermaid"
              onClick={() => void copy('mermaid')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            >
              Copy as Mermaid
            </button>
            <button
              type="button"
              data-testid="copy-as-dsl"
              onClick={() => void copy('dsl')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            >
              Copy as DSL
            </button>
            {copyStatus && <span className="text-[11px] font-medium text-slate-500">{copyStatus}</span>}
          </div>
        )}
      </div>

      {error && (
        <div
          data-testid="dsl-parse-error"
          role="alert"
          className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <div className="editor-content" style={{ flex: '1 1 auto', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, width: '100%', minHeight: '400px' }}>
          <Editor
            height="100%"
            width="100%"
            defaultLanguage="plaintext"
            value={dslText}
            onChange={handleEditorChange}
            theme="vs-dark"
            loading={<div style={{ padding: '20px', color: '#666' }}>Loading editor...</div>}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 16 },
            }}
          />
        </div>
      </div>
    </div>
  );
}
