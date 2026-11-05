import { useCallback, useState, type RefObject } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import { adaptTypeToFlow, retargetAmbiguousNoEdge, type TypeToFlowResult } from '../../utils/typeToFlow';
import { runTypeToFlow } from '../../utils/skillsHost';
import type { SkillActivationResult } from './SkillCatalog';

type PendingAmbiguity = {
  text: string;
  sourceAtStart: string;
  result: TypeToFlowResult;
};

export type TypeToFlowSkillResult = { source: string; mermaid: string; warnings: string[] };

export type TypeToFlowRunOutcome = SkillActivationResult & { count?: number };

interface TypeToFlowAmbiguityOptions {
  stepsInputRef: RefObject<HTMLTextAreaElement | null>;
  /** Open Type steps when a named list is held off the board. */
  openSteps: () => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
}

/**
 * Hold-gate for inferred decision edges. A non-empty ambiguity list stays in
 * `pending` until confirm. Cancel drops it and does not write the store.
 */
export function useTypeToFlowAmbiguity({
  stepsInputRef,
  openSteps,
  notifySuccess,
  notifyError,
}: TypeToFlowAmbiguityOptions) {
  const { setDslText, setParsedDiagram, setError, setSourceWarning } = useDiagramStore();
  const [pending, setPending] = useState<PendingAmbiguity | null>(null);
  const [skillResult, setSkillResult] = useState<TypeToFlowSkillResult | null>(null);

  // Write a validated type-to-flow graph in one step. Callers adapt first so a
  // bad result never reaches the store.
  const commitTypeToFlow = useCallback((adapted: ReturnType<typeof adaptTypeToFlow>) => {
    setDslText(adapted.source);
    setParsedDiagram(adapted.graph);
    setError(null);
    setSourceWarning(null);
    setSkillResult({ source: adapted.source, mermaid: adapted.result.mermaid, warnings: adapted.result.warnings });
    setPending(null);
    return adapted.graph.nodes.length;
  }, [setDslText, setParsedDiagram, setError, setSourceWarning]);

  const proposalStillMatches = useCallback((text: string, sourceAtStart: string) => {
    const current = useDiagramStore.getState();
    const typedNow = stepsInputRef.current?.value.trim() ?? text;
    return current.dslText === sourceAtStart && current.diagramMode === 'flow' && !current.isReadOnlyShared && typedNow === text;
  }, [stepsInputRef]);

  // Map a type-to-flow result onto the board only after it validates and the
  // board still matches the snapshot taken before the run. A named ambiguity
  // list is held here; confirm commits it, cancel drops it. Failures throw
  // before any store write.
  const applyTypeToFlowRun = useCallback(async (text: string): Promise<TypeToFlowRunOutcome> => {
    const before = useDiagramStore.getState();
    const sourceAtStart = before.dslText;
    const title = before.parsedDiagram?.title || 'Untitled workflow';
    const data = await runTypeToFlow({ text, title });
    const adapted = adaptTypeToFlow(data);
    if (!proposalStillMatches(text, sourceAtStart)) {
      throw new Error('The board or steps changed while the skill was running. Run it again.');
    }
    if ((adapted.result.ambiguities?.length ?? 0) > 0) {
      openSteps();
      setPending({ text, sourceAtStart, result: adapted.result });
      return { committed: false };
    }
    const count = commitTypeToFlow(adapted);
    return { committed: true, count };
  }, [commitTypeToFlow, proposalStillMatches, openSteps]);

  const confirm = useCallback(() => {
    if (!pending) return;
    let adapted: ReturnType<typeof adaptTypeToFlow>;
    try {
      adapted = adaptTypeToFlow(pending.result);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'The skill could not run.');
      return;
    }
    if (!proposalStillMatches(pending.text, pending.sourceAtStart)) {
      setPending(null);
      notifyError('The board or steps changed while the skill was running. Run it again.');
      return;
    }
    const count = commitTypeToFlow(adapted);
    notifySuccess(`Built ${count} workflow nodes with type-to-flow.`);
  }, [pending, proposalStillMatches, commitTypeToFlow, notifyError, notifySuccess]);

  const cancel = useCallback(() => {
    setPending(null);
  }, []);

  const editNoTarget = useCallback((ambiguityId: string, toId: string) => {
    setPending(current => {
      if (!current) return current;
      try {
        return { ...current, result: retargetAmbiguousNoEdge(current.result, ambiguityId, toId) };
      } catch {
        return current;
      }
    });
  }, []);

  return { pending, skillResult, applyTypeToFlowRun, confirm, cancel, editNoTarget };
}
