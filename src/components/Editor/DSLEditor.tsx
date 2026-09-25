import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useDiagramStore } from '../../store/diagramStore';
import { installDiagramDslTestHook } from '../../utils/devTestHook';
import { applyBoardSource, toDslSource, toMermaidSource } from '../../utils/sourceText';
import { plainStepsToDSL } from '../../parser/plainSteps';
import { plainStepsFromBoardSource, applyLoadedPlainSteps } from '../../parser/boardToPlainSteps';
import { insertRolePrefix, type RolePrefixRole } from '../../parser/insertRolePrefix';
import { useToast } from '../../utils/useToast';
import { ToastContainer } from '../Toast/ToastContainer';
import type { BoardMode } from '../../utils/boardManager';

function asBoardMode(mode: string): BoardMode {
  return mode === 'flow' || mode === 'sequence' || mode === 'gantt' ? mode : 'architecture';
}

export function DSLEditor() {
  const { dslText, setDslText, setParsedDiagram, setError, setLoading, diagramMode, error } = useDiagramStore();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  // DT-AI-01: thin "Type steps" box for plain sentences (Flow boards only).
  const [showSteps, setShowSteps] = useState(false);
  const [stepsText, setStepsText] = useState('');
  const toast = useToast();
  // DT-AI-08: textarea ref so role-prefix buttons can read the caret/selection.
  const stepsInputRef = useRef<HTMLTextAreaElement | null>(null);
  // DT-AI-09: one-shot seed from picking the AI workflow template.
  const typeStepsSeed = useDiagramStore(s => s.typeStepsSeed);
  const clearTypeStepsSeed = useDiagramStore(s => s.clearTypeStepsSeed);

  // Apply a template seed like Load steps: writes the payload via
  // applyLoadedPlainSteps (opens the panel) and clears the one-shot signal.
  // Failure never wipes the existing stepsText — the seed payload is only
  // queued after a successful serialize, so nothing to catch here.
  useEffect(() => {
    if (!typeStepsSeed) return;
    const next = applyLoadedPlainSteps(stepsText, typeStepsSeed.payload);
    setStepsText(next.stepsText);
    setShowSteps(next.showSteps);
    clearTypeStepsSeed();
    // stepsText intentionally omitted: applyLoadedPlainSteps overwrites it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeStepsSeed, clearTypeStepsSeed]);

  const STEPS_PLACEHOLDER = `Model: draft reply
then Send reply
If error then Retry
else Flag for review`;

  const applySource = useCallback((value: string) => {
    setDslText(value);
    const mode = asBoardMode(diagramMode);

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
    if (value === undefined) return;
    // Ignore Monaco echoes after a canvas writeback updates `dslText`.
    if (value === useDiagramStore.getState().dslText) return;
    applySource(value);
  }, [applySource]);

  // DT-AI-01: convert typed sentences into existing flow DSL, then re-parse via
  // the same applySource path as manual typing. Bad/empty input → one teachable
  // toast; the board is untouched because dslText is never updated.
  const buildFromSteps = useCallback(() => {
    const input = stepsText.trim();
    if (!input) {
      toast.error('Type one step per line first. Example: "Model: draft reply", "then Send reply", "If error then Retry".');
      return;
    }
    try {
      const dsl = plainStepsToDSL(input, {
        title: useDiagramStore.getState().dslText.match(/^\s*title\s*:\s*(.+)\s*$/im)?.[1]?.trim(),
      });
      setShowSteps(false);
      applySource(dsl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read those steps. Type one step per line.');
    }
  }, [stepsText, toast, applySource]);

  // DT-AI-07: fill Type steps from the live board (same serializer as Copy; no clipboard).
  const loadSteps = useCallback(() => {
    const previous = stepsText;
    try {
      const payload = plainStepsFromBoardSource(dslText);
      const next = applyLoadedPlainSteps(previous, payload);
      setStepsText(next.stepsText);
      setShowSteps(next.showSteps);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load steps from this board.');
      // textarea unchanged on failure
    }
  }, [dslText, stepsText, toast]);

  // DT-AI-08: tab-reachable role-prefix buttons (no global shortcuts).
  // Decides where the prefix goes via the pure helper; restores the
  // caret/selection once React commits the new value.
  const insertRole = useCallback((role: RolePrefixRole) => {
    const input = stepsInputRef.current;
    if (!input) return;
    const next = insertRolePrefix(stepsText, input.selectionStart, input.selectionEnd, role);
    setStepsText(next.text);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }, [stepsText]);

  useEffect(() => {
    applySource(dslText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return installDiagramDslTestHook(text => handleEditorChange(text));
  }, [handleEditorChange]);

  const showCopy = diagramMode === 'flow' || diagramMode === 'sequence';

  const copy = async (kind: 'mermaid' | 'dsl' | 'steps') => {
    if (kind === 'steps') {
      // DT-AI-05: local serialize via shared board→steps helper.
      try {
        const payload = plainStepsFromBoardSource(dslText);
        await navigator.clipboard.writeText(payload);
        setCopyStatus('Copied steps');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not copy steps from this board.');
        // clipboard unchanged on failure
      }
      window.setTimeout(() => setCopyStatus(null), 1600);
      return;
    }
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
        {diagramMode === 'flow' && (
          <div className="mt-2">
            <button
              type="button"
              data-testid="toggle-type-steps"
              onClick={() => setShowSteps(v => !v)}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400"
            >
              {showSteps ? 'Hide Type steps' : 'Type steps'}
            </button>
          </div>
        )}
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
            {diagramMode === 'flow' && (
              <>
                <button
                  type="button"
                  data-testid="copy-as-steps"
                  onClick={() => void copy('steps')}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                >
                  Copy as steps
                </button>
                <button
                  type="button"
                  data-testid="load-steps"
                  onClick={loadSteps}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                >
                  Load steps
                </button>
              </>
            )}
            {copyStatus && <span className="text-[11px] font-medium text-slate-500">{copyStatus}</span>}
          </div>
        )}
      </div>

      {diagramMode === 'flow' && showSteps && (
        <div
          data-testid="type-steps-box"
          className="mx-3 mb-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3"
        >
          <label className="mb-1 block text-[11px] font-semibold text-indigo-700">
            Type steps — one step per line. Optional words: then, if, else, Human:, Model:, Tool:, Check:
          </label>
          <textarea
            ref={stepsInputRef}
            data-testid="type-steps-input"
            value={stepsText}
            onChange={e => setStepsText(e.target.value)}
            placeholder={STEPS_PLACEHOLDER}
            rows={4}
            className="w-full rounded border border-indigo-200 bg-white p-2 font-mono text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
          />
          {/* DT-AI-08: role prefix inserts (#37) — plain buttons, tab-reachable, no shortcuts. */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-medium text-slate-500">Add role:</span>
            {(['Human', 'Model', 'Tool', 'Check'] as const).map(role => (
              <button
                key={role}
                type="button"
                data-testid={`role-prefix-${role.toLowerCase()}`}
                onClick={() => insertRole(role)}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-700"
              >
                {role}:
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="build-steps"
              onClick={buildFromSteps}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Build board
            </button>
            <span className="text-[11px] text-slate-500">Parsed locally — nothing leaves this device.</span>
          </div>
        </div>
      )}

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
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
