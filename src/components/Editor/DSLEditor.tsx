import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useDiagramStore } from '../../store/diagramStore';
import { installDiagramDslTestHook } from '../../utils/devTestHook';
import { applyBoardSource, toDslSource, toMermaidSource } from '../../utils/sourceText';
import { plainStepsToDSL } from '../../parser/plainSteps';
import { plainArchitectureToDSL, plainPartsFromBoardSource, typePartsSuccessMessage } from '../../parser/plainArchitecture';
import { plainSequenceToMermaid, plainMessagesFromBoardSource, typeMessagesSuccessMessage } from '../../parser/plainSequence';
import { plainGanttToDSL, plainTasksFromBoardSource, typeTasksSuccessMessage } from '../../parser/plainGantt';
import { stepLineRange } from '../../parser/typeStepsPreview';
import { TypeStepsPreview } from './TypeStepsPreview';
import { TypePartsPreview } from './TypePartsPreview';
import { TypeMessagesPreview } from './TypeMessagesPreview';
import { TypeTasksPreview } from './TypeTasksPreview';
import { flowStepList, type FlowStep } from '../../parser/flowToPlainSteps';
import { architectureWalkSequence } from '../../parser/architectureWalk';
import { plainStepsFromBoardSource, applyLoadedPlainSteps, sourceMatchesRoleLanes } from '../../parser/boardToPlainSteps';
import { insertRolePrefix, type RolePrefixRole } from '../../parser/insertRolePrefix';
import { nextShowStepsAfterBuild, statsFromPlainStepsDsl, buildFromStepsSuccessMessage } from './buildFromStepsPanel';
import { AI_PROMPT_TEXT } from './aiPrompt';
import { useToast } from '../../utils/useToast';
import { ToastContainer } from '../Toast/ToastContainer';
import type { BoardMode } from '../../utils/boardManager';
import { IconStylePicker } from '../Canvas/IconStylePicker';

function asBoardMode(mode: string): BoardMode {
  return mode === 'flow' || mode === 'sequence' || mode === 'gantt' ? mode : 'architecture';
}

export function DSLEditor() {
  const { dslText, setDslText, setParsedDiagram, setError, setSourceWarning, setLoading, diagramMode, error, sourceWarning, parsedDiagram, isReadOnlyShared } = useDiagramStore();
  const enterWalkThrough = useDiagramStore(s => s.enterWalkThrough);
  const showStepNumbers = useDiagramStore(s => s.showStepNumbers);
  const setShowStepNumbers = useDiagramStore(s => s.setShowStepNumbers);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  // DT-AI-01: thin "Type steps" box for plain sentences (Flow boards only).
  const [showSteps, setShowSteps] = useState(false);
  const [stepsText, setStepsText] = useState('');
  // DT-AI-27: off until the user ticks it. The board remembers it by the
  // lane blocks in the DSL, so Load steps restores the tick. No new field.
  const [lanesByRole, setLanesByRole] = useState(false);
  // DT-ARCH-01: "Type parts" is the architecture twin of Type steps.
  const [showParts, setShowParts] = useState(false);
  const [partsText, setPartsText] = useState('');
  const [partsHandwritten, setPartsHandwritten] = useState(false);
  const partsInputRef = useRef<HTMLTextAreaElement | null>(null);
  // DT-SEQ-02: "Type messages" is the sequence twin of Type steps.
  const [showMessages, setShowMessages] = useState(false);
  const [messagesText, setMessagesText] = useState('');
  const [messagesHandwritten, setMessagesHandwritten] = useState(false);
  const messagesInputRef = useRef<HTMLTextAreaElement | null>(null);
  // DT-GANTT-02: "Type tasks" is the Gantt twin of Type steps.
  const [showTasks, setShowTasks] = useState(false);
  const [tasksText, setTasksText] = useState('');
  const [tasksHandwritten, setTasksHandwritten] = useState(false);
  const tasksInputRef = useRef<HTMLTextAreaElement | null>(null);
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
    const payload = typeStepsSeed.payload;
    const current = stepsText;
    queueMicrotask(() => {
      const next = applyLoadedPlainSteps(current, payload);
      setStepsText(next.stepsText);
      setShowSteps(next.showSteps);
      clearTypeStepsSeed();
    });
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
      setSourceWarning(result.warnings.length > 0 ? result.warnings.join('\n') : null);
      if (result.kind === 'diagram') setParsedDiagram(result.parsed);
    } else {
      setError(result.error);
      setSourceWarning(null);
    }
    setLoading(false);
  }, [diagramMode, setDslText, setParsedDiagram, setError, setSourceWarning, setLoading]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    if (useDiagramStore.getState().isReadOnlyShared) return;
    // Ignore Monaco echoes after a canvas writeback updates `dslText`.
    if (value === useDiagramStore.getState().dslText) return;
    applySource(value);
  }, [applySource]);

  // DT-AI-01: convert typed sentences into existing flow DSL, then re-parse via
  // the same applySource path as manual typing. Bad/empty input → one teachable
  // toast; the board is untouched because dslText is never updated.
  // DT-AI-11: successful Build keeps Type steps open (textarea unchanged) for
  // iterate-create; empty/error leave panel visibility as today.
  const buildFromSteps = useCallback(() => {
    const input = stepsText.trim();
    if (!input) {
      toast.error('Type one step per line first. Example: "Model: draft reply", "then Send reply", "If error then Retry".');
      return;
    }
    try {
      const loopMisses = { count: 0 };
      const parallelHints = { count: 0 };
      const dsl = plainStepsToDSL(input, {
        title: useDiagramStore.getState().dslText.match(/^\s*title\s*:\s*(.+)\s*$/im)?.[1]?.trim(),
        loopMisses,
        parallelHints,
        lanesByRole,
      });
      // DT-AI-11: keep panel open; DT-AI-13: success toast with step→node count (+ roles).
      setShowSteps(prev => nextShowStepsAfterBuild(prev, 'success'));
      applySource(dsl);
      // DT-AI-16: offer Walk through on the success toast when the freshly
      // built board has steps to walk (same flowStepList rule that enables the
      // toolbar control). Re-read the store because the walkSteps memo above
      // still reflects the pre-build board.
      const built = useDiagramStore.getState().parsedDiagram;
      let canWalk = false;
      if (diagramMode === 'flow' && built) {
        try {
          canWalk = flowStepList(built).length > 0;
        } catch {
          canWalk = false;
        }
      }
      toast.success(
        buildFromStepsSuccessMessage(statsFromPlainStepsDsl(dsl), loopMisses.count, parallelHints.count),
        undefined,
        canWalk ? { label: 'Walk through', onSelect: enterWalkThrough } : undefined,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read those steps. Type one step per line.');
    }
  }, [stepsText, lanesByRole, toast, applySource, diagramMode, enterWalkThrough]);

  // Undo/redo replaces dslText without going through Monaco. Re-parse so the
  // canvas follows the restored source. Flow keeps its own applySource path.
  useEffect(() => {
    if (diagramMode !== 'architecture') return;
    const result = applyBoardSource(dslText, 'architecture');
    if (result.ok) {
      setError(null);
      setSourceWarning(result.warnings.length > 0 ? result.warnings.join('\n') : null);
      if (result.kind === 'diagram') setParsedDiagram(result.parsed);
    } else {
      setError(result.error);
      setSourceWarning(null);
    }
  }, [dslText, diagramMode, setParsedDiagram, setError, setSourceWarning]);

  const PARTS_PLACEHOLDER = `User -> Chat app: asks
Chat app -> Agent: question
Agent -> Vector DB: search
inside Cloud: Chat app, Agent`;

  const toggleParts = useCallback(() => {
    setShowParts(open => {
      const next = !open;
      if (!next) return next;
      const loaded = plainPartsFromBoardSource(useDiagramStore.getState().dslText);
      if (loaded == null) {
        setPartsText('');
        setPartsHandwritten(true);
      } else {
        setPartsText(loaded);
        setPartsHandwritten(false);
      }
      return next;
    });
  }, []);

  const buildFromParts = useCallback(() => {
    const input = partsText.trim();
    if (!input) {
      toast.error('Type one part per line first. Example: "User -> Chat app: asks", "Agent -> Vector DB: search".');
      return;
    }
    try {
      const stats = { parts: 0, connections: 0 };
      const dsl = plainArchitectureToDSL(input, {
        title: useDiagramStore.getState().dslText.match(/^\s*title\s*:\s*(.+)\s*$/im)?.[1]?.trim(),
        stats,
      });
      setShowParts(true);
      setPartsHandwritten(false);
      applySource(dsl);
      toast.success(typePartsSuccessMessage(stats.parts, stats.connections));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read those parts. Type one connection per line.');
    }
  }, [partsText, toast, applySource]);

  const focusPartsLine = useCallback((lineIndex: number) => {
    const input = partsInputRef.current;
    if (!input) return;
    const range = stepLineRange(partsText, lineIndex);
    input.focus();
    input.setSelectionRange(range.start, range.end);
  }, [partsText]);

  const MESSAGES_PLACEHOLDER = `User asks Agent: plan my trip
Agent calls Search tool: flights
Search tool replies Agent: 3 options
if no flights:
Agent tells User: try other dates
else:
Agent tells User: book it
end`;

  const toggleMessages = useCallback(() => {
    setShowMessages(open => {
      const next = !open;
      if (!next) return next;
      const loaded = plainMessagesFromBoardSource(useDiagramStore.getState().dslText);
      if (loaded == null) {
        setMessagesText('');
        setMessagesHandwritten(true);
      } else {
        setMessagesText(loaded);
        setMessagesHandwritten(false);
      }
      return next;
    });
  }, []);

  const buildFromMessages = useCallback(() => {
    const input = messagesText.trim();
    if (!input) {
      toast.error('Type one message per line first. Example: "User asks Agent: plan my trip".');
      return;
    }
    try {
      const stats = { participants: 0, messages: 0 };
      const mermaid = plainSequenceToMermaid(input, {
        title: useDiagramStore.getState().dslText.match(/^\s*title\s*:?\s+(.+)\s*$/im)?.[1]?.trim(),
        stats,
      });
      setShowMessages(true);
      setMessagesHandwritten(false);
      applySource(mermaid);
      toast.success(typeMessagesSuccessMessage(stats.participants, stats.messages));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read those messages. Type one message per line.');
    }
  }, [messagesText, toast, applySource]);

  const TASKS_PLACEHOLDER = `Phase: Build
Collect data — 3d — Human: Jack
Train model — 5d after Collect data — AI agent
Review — 2d after Train model — Human: May
Go live — milestone after Review`;

  const toggleTasks = useCallback(() => {
    setShowTasks(open => {
      const next = !open;
      if (!next) return next;
      const loaded = plainTasksFromBoardSource(useDiagramStore.getState().dslText);
      if (loaded == null) {
        setTasksText('');
        setTasksHandwritten(true);
      } else {
        setTasksText(loaded);
        setTasksHandwritten(false);
      }
      return next;
    });
  }, []);

  const buildFromTasks = useCallback(() => {
    const input = tasksText.trim();
    if (!input) {
      toast.error('Type one task per line first. Example: "Collect data — 3d — Human: Jack".');
      return;
    }
    try {
      const stats = { tasks: 0, groups: 0, milestones: 0 };
      const dsl = plainGanttToDSL(input, {
        title: useDiagramStore.getState().dslText.match(/^\s*title\s*:\s*(.+)\s*$/im)?.[1]?.trim(),
        stats,
      });
      setShowTasks(true);
      setTasksHandwritten(false);
      applySource(dsl);
      toast.success(typeTasksSuccessMessage(stats.tasks, stats.groups));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read those tasks. Type one task per line.');
    }
  }, [tasksText, toast, applySource]);

  const focusTasksLine = useCallback((lineIndex: number) => {
    const input = tasksInputRef.current;
    if (!input) return;
    const range = stepLineRange(tasksText, lineIndex);
    input.focus();
    input.setSelectionRange(range.start, range.end);
  }, [tasksText]);

  const focusMessagesLine = useCallback((lineIndex: number) => {
    const input = messagesInputRef.current;
    if (!input) return;
    const range = stepLineRange(messagesText, lineIndex);
    input.focus();
    input.setSelectionRange(range.start, range.end);
  }, [messagesText]);

  // DT-AI-07: fill Type steps from the live board (same serializer as Copy; no clipboard).
  const loadSteps = useCallback(() => {
    const previous = stepsText;
    try {
      const payload = plainStepsFromBoardSource(dslText);
      const next = applyLoadedPlainSteps(previous, payload);
      setStepsText(next.stepsText);
      setShowSteps(next.showSteps);
      setLanesByRole(sourceMatchesRoleLanes(dslText));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load steps from this board.');
      // textarea unchanged on failure
    }
  }, [dslText, stepsText, toast]);

  // DT-AI-17: copy the fixed AI instruction — clipboard only, never any AI call.
  const copyAiPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEXT);
      toast.success('AI prompt copied');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not copy the AI prompt.');
      // clipboard unchanged on failure
    }
  }, [toast]);

  // DT-AI-08: tab-reachable role-prefix buttons (no global shortcuts).
  // Decides where the prefix goes via the pure helper; restores the
  // caret/selection once React commits the new value.
  // DT-AI-28: a warning row selects that line. The board stays as it is.
  const focusStepsLine = useCallback((lineIndex: number) => {
    const input = stepsInputRef.current;
    if (!input) return;
    const range = stepLineRange(stepsText, lineIndex);
    input.focus();
    input.setSelectionRange(range.start, range.end);
  }, [stepsText]);

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

  // DT-AI-14: Walk through shares the Copy as steps serializer's ordered step
  // list (same source of order), so the two never disagree. null = nothing to
  // walk on this board (non-Flow or empty) → control is hidden/disabled.
  const walkSteps = useMemo((): FlowStep[] | null => {
    if (diagramMode !== 'flow' || !parsedDiagram) return null;
    try {
      return flowStepList(parsedDiagram);
    } catch {
      return null;
    }
  }, [diagramMode, parsedDiagram]);

  const archCanWalk = useMemo(() => {
    if (diagramMode !== 'architecture' || !parsedDiagram) return false;
    return architectureWalkSequence(parsedDiagram).length > 0;
  }, [diagramMode, parsedDiagram]);


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
        {diagramMode === 'architecture' && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-type-parts"
              onClick={toggleParts}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400"
            >
              {showParts ? 'Hide Type parts' : 'Type parts'}
            </button>
            {archCanWalk && (
              <button
                type="button"
                data-testid="walk-through"
                onClick={enterWalkThrough}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400"
              >
                Walk through
              </button>
            )}
          </div>
        )}
        {diagramMode === 'sequence' && (
          <div className="mt-2">
            <button
              type="button"
              data-testid="toggle-type-messages"
              onClick={toggleMessages}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400"
            >
              {showMessages ? 'Hide Type messages' : 'Type messages'}
            </button>
          </div>
        )}
        {diagramMode === 'gantt' && (
          <div className="mt-2">
            <button
              type="button"
              data-testid="toggle-type-tasks"
              onClick={toggleTasks}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400"
            >
              {showTasks ? 'Hide Type tasks' : 'Type tasks'}
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
                {/* DT-AI-14: read-only walk-through, step order = Copy as steps order. */}
                {!isReadOnlyShared && (
                  <>
                    <IconStylePicker />
                    <button
                      type="button"
                      data-testid="toggle-step-numbers"
                      aria-pressed={showStepNumbers}
                      title={showStepNumbers ? 'Step numbers on' : 'Step numbers off'}
                      onClick={() => setShowStepNumbers(!showStepNumbers)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                        showStepNumbers
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      Step numbers
                    </button>
                  </>
                )}
                <button
                  type="button"
                  data-testid="walk-through"
                  disabled={!walkSteps}
                  title={walkSteps ? undefined : 'No steps on this board yet. Add a few nodes, or use Type steps to build one.'}
                  onClick={enterWalkThrough}
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-400"
                >
                  Walk through
                </button>
                {!walkSteps && (
                  <span data-testid="walk-through-unavailable" className="text-[11px] font-medium text-slate-500">
                    No steps on this board yet. Add a few nodes, or use Type steps to build one.
                  </span>
                )}
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
            Type steps — one step per line. Optional words: then, if, else, go back to, and at the same time, Human:/User:, Model:/Assistant:/AI:, Tool:, Check:/System:, Data:/Memory:/DB:/File:. Optional note: Step — why
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
          {/* DT-AI-28: live reading of the same converter Build uses. Read-only. */}
          <TypeStepsPreview text={stepsText} onFocusLine={focusStepsLine} />
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
          <label className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
            <input
              type="checkbox"
              data-testid="type-steps-lanes-by-role"
              checked={lanesByRole}
              onChange={event => setLanesByRole(event.target.checked)}
            />
            Lanes by role
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="build-steps"
              onClick={buildFromSteps}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Build board
            </button>
            {/* DT-AI-17: hands the fixed instruction to any chat AI (copy-only). */}
            <button
              type="button"
              data-testid="copy-ai-prompt"
              onClick={() => void copyAiPrompt()}
              className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400"
            >
              Copy AI prompt
            </button>
            <span className="text-[11px] text-slate-500">Parsed locally — nothing leaves this device.</span>
          </div>
        </div>
      )}

      {diagramMode === 'architecture' && showParts && (
        <div
          data-testid="type-parts-box"
          className="mx-3 mb-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3"
        >
          <label className="mb-1 block text-[11px] font-semibold text-indigo-700">
            Type parts — one connection per line. A -&gt; B or A -&gt; B: label. Kinds from (db), (queue), (AI), (tool), (user), or a name ending in DB, Queue, Agent, Tool, or User. Groups: inside Cloud: A, B
          </label>
          <textarea
            ref={partsInputRef}
            data-testid="type-parts-input"
            value={partsText}
            onChange={e => {
              setPartsText(e.target.value);
              if (e.target.value.trim()) setPartsHandwritten(false);
            }}
            placeholder={PARTS_PLACEHOLDER}
            rows={4}
            className="w-full rounded border border-indigo-200 bg-white p-2 font-mono text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
          />
          {partsHandwritten && !partsText.trim() && (
            <p data-testid="type-parts-handwritten-hint" className="mt-1 text-[11px] text-slate-500">
              This board was not built with Type parts. The box starts empty so the current DSL stays as it is.
            </p>
          )}
          <TypePartsPreview text={partsText} onFocusLine={focusPartsLine} />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="build-parts"
              onClick={buildFromParts}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Build board
            </button>
            <span className="text-[11px] text-slate-500">Parsed locally — nothing leaves this device.</span>
          </div>
        </div>
      )}

      {diagramMode === 'gantt' && showTasks && (
        <div
          data-testid="type-tasks-box"
          className="mx-3 mb-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3"
        >
          <label className="mb-1 block text-[11px] font-semibold text-indigo-700">
            Type tasks — one task per line. Length: 3d, 2w, or 3 days. Waits for: after X, or after X and Y. milestone. Owner: Human: Name, AI agent, AI:, Tool:. Phase: Build or ## Build starts a group. 50% done. starts 2026-11-02. Separators: —, -, or comma.
          </label>
          <textarea
            ref={tasksInputRef}
            data-testid="type-tasks-input"
            value={tasksText}
            onChange={e => {
              setTasksText(e.target.value);
              if (e.target.value.trim()) setTasksHandwritten(false);
            }}
            placeholder={TASKS_PLACEHOLDER}
            rows={5}
            className="w-full rounded border border-indigo-200 bg-white p-2 font-mono text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
          />
          {tasksHandwritten && !tasksText.trim() && (
            <p data-testid="type-tasks-handwritten-hint" className="mt-1 text-[11px] text-slate-500">
              This board was not built with Type tasks. The box starts empty so the current plan stays as it is.
            </p>
          )}
          <TypeTasksPreview text={tasksText} onFocusLine={focusTasksLine} />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="build-tasks"
              onClick={buildFromTasks}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Build chart
            </button>
            <span className="text-[11px] text-slate-500">Parsed locally — nothing leaves this device.</span>
          </div>
        </div>
      )}

      {diagramMode === 'sequence' && showMessages && (
        <div
          data-testid="type-messages-box"
          className="mx-3 mb-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3"
        >
          <label className="mb-1 block text-[11px] font-semibold text-indigo-700">
            Type messages — one message per line. asks/calls/sends/tells/uses are solid; replies/returns/answers/responds are dashed; notifies/fires/emits are async. A -&gt; B: text and A =&gt; B: text. Frames: if, else, end, repeat, maybe, at the same time, and. note on User: text. Roles: Human:, AI:, Tool:, Data:.
          </label>
          <textarea
            ref={messagesInputRef}
            data-testid="type-messages-input"
            value={messagesText}
            onChange={e => {
              setMessagesText(e.target.value);
              if (e.target.value.trim()) setMessagesHandwritten(false);
            }}
            placeholder={MESSAGES_PLACEHOLDER}
            rows={4}
            className="w-full rounded border border-indigo-200 bg-white p-2 font-mono text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
          />
          {messagesHandwritten && !messagesText.trim() && (
            <p data-testid="type-messages-handwritten-hint" className="mt-1 text-[11px] text-slate-500">
              This board was not built with Type messages. The box starts empty so the current Mermaid stays as it is.
            </p>
          )}
          <TypeMessagesPreview text={messagesText} onFocusLine={focusMessagesLine} />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="build-messages"
              onClick={buildFromMessages}
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
      {sourceWarning && (
        <div
          data-testid="dsl-parse-warning"
          role="status"
          className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
        >
          {sourceWarning}
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
              readOnly: isReadOnlyShared,
            }}
          />
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
