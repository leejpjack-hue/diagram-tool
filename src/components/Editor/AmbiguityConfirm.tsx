import type { TypeToFlowResult } from '../../utils/typeToFlow';

interface AmbiguityConfirmProps {
  result: TypeToFlowResult;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onEditNoTarget: (ambiguityId: string, toId: string) => void;
}

/** Named list for inferred decision edges. Confirm or an edited no-branch is what commits. */
export function AmbiguityConfirm({ result, disabled = false, onConfirm, onCancel, onEditNoTarget }: AmbiguityConfirmProps) {
  const items = result.ambiguities ?? [];
  return (
    <section
      data-testid="ambiguity-confirm-panel"
      aria-label="Ambiguous decision branches"
      className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2"
    >
      <h3 className="text-[11px] font-semibold text-amber-950">Confirm ambiguous decision branches</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-amber-900">
        These branches were assumed. They stay off the board until you confirm. Edit the no branch if it should go somewhere else. Cancel leaves the board unchanged.
      </p>
      <ul data-testid="ambiguity-list" className="mt-2 space-y-2">
        {items.map(item => {
          const noEdge = result.flow.edges.find(edge => edge.from === item.id && edge.label?.trim().toLowerCase() === 'no');
          return (
            <li key={item.id} data-testid={`ambiguity-item-${item.id}`} className="rounded border border-amber-200 bg-white p-2">
              <p className="text-[11px] font-semibold text-slate-800">
                <span data-testid="ambiguity-name">{item.id}</span>
              </p>
              <p data-testid="ambiguity-sentence" className="mt-0.5 text-[11px] leading-snug text-slate-700">{item.sentence}</p>
              <label className="mt-1 block text-[11px] font-medium text-slate-600">
                Edit no branch
                <select
                  data-testid={`ambiguity-no-target-${item.id}`}
                  aria-label={`Edit no branch for ${item.id}`}
                  value={noEdge?.to ?? ''}
                  disabled={disabled || !noEdge}
                  onChange={event => onEditNoTarget(item.id, event.target.value)}
                  className="mt-0.5 block w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-800"
                >
                  {result.flow.nodes.filter(node => node.id !== item.id).map(node => (
                    <option key={node.id} value={node.id}>{node.label}</option>
                  ))}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid="ambiguity-confirm"
          disabled={disabled}
          onClick={onConfirm}
          className="rounded-md bg-amber-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
        >
          Confirm branches
        </button>
        <button
          type="button"
          data-testid="ambiguity-cancel"
          disabled={disabled}
          onClick={onCancel}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
