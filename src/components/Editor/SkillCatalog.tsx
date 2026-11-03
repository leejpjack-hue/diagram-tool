import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SKILL_CATALOG_EMPTY_HINT,
  SKILL_CATALOG_RELOAD_NOTE,
  getSkillCatalog,
  isAbortError,
  type SkillCatalogEntry,
} from '../../utils/skillsHost';

interface SkillCatalogProps {
  disabled?: boolean;
  onActivate: (skill: SkillCatalogEntry) => Promise<void>;
}

export function SkillCatalog({ disabled = false, onActivate }: SkillCatalogProps) {
  const [skills, setSkills] = useState<SkillCatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activatedNote, setActivatedNote] = useState<string | null>(null);
  const requestId = useRef(0);
  const activatingRef = useRef<string | null>(null);

  const applyResult = useCallback((id: number, next: SkillCatalogEntry[]) => {
    if (id !== requestId.current) return;
    setSkills(next);
    setCatalogError(null);
    setLoading(false);
  }, []);

  const applyFailure = useCallback((id: number, error: unknown) => {
    if (isAbortError(error) || id !== requestId.current) return;
    setCatalogError(error instanceof Error ? error.message : 'The skills catalog could not be loaded.');
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    void getSkillCatalog({ signal: controller.signal }).then(
      next => {
        if (controller.signal.aborted) return;
        applyResult(id, next);
      },
      error => {
        if (controller.signal.aborted) return;
        applyFailure(id, error);
      },
    );
    return () => controller.abort();
  }, [applyResult, applyFailure]);

  const reload = () => {
    const id = ++requestId.current;
    setLoading(true);
    setCatalogError(null);
    void getSkillCatalog({ reload: true }).then(
      next => applyResult(id, next),
      error => applyFailure(id, error),
    );
  };

  const activate = (skill: SkillCatalogEntry) => {
    if (disabled || activatingRef.current) return;
    activatingRef.current = skill.name;
    setActivating(skill.name);
    setActivateError(null);
    setActivatedNote(null);
    void onActivate(skill)
      .then(() => {
        setActivatedNote(
          skill.name === 'type-to-flow'
            ? 'Activated type-to-flow and mapped it onto this board.'
            : `Activated ${skill.name}. The board was not changed.`,
        );
      })
      .catch(error => {
        setActivateError(error instanceof Error ? error.message : 'The skill could not be activated.');
      })
      .finally(() => {
        if (activatingRef.current === skill.name) activatingRef.current = null;
        setActivating(current => (current === skill.name ? null : current));
      });
  };

  return (
    <section
      data-testid="skill-catalog"
      aria-labelledby="skill-catalog-heading"
      className="mx-3 mt-3 rounded-md border border-slate-200 bg-white p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="skill-catalog-heading" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Skills
        </h2>
        <button
          type="button"
          data-testid="skill-catalog-reload"
          onClick={reload}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
        >
          Reload skills
        </button>
      </div>
      <p data-testid="skill-catalog-reload-note" className="mt-1 text-[11px] leading-snug text-slate-500">
        {SKILL_CATALOG_RELOAD_NOTE}
      </p>
      {loading && (
        <p role="status" data-testid="skill-catalog-loading" className="mt-2 text-[11px] font-medium text-slate-600">
          {skills ? 'Reloading skills…' : 'Loading skills…'}
        </p>
      )}
      {catalogError && (
        <p role="alert" data-testid="skill-catalog-error" className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
          {catalogError} Choose Reload skills to try again.
        </p>
      )}
      {!loading && !catalogError && skills?.length === 0 && (
        <p data-testid="skill-catalog-empty" className="mt-2 text-[11px] font-medium text-slate-700">
          {SKILL_CATALOG_EMPTY_HINT}
        </p>
      )}
      {skills && skills.length > 0 && (
        <ul className="mt-2 space-y-2" aria-label="Workspace skills">
          {skills.map(skill => {
            const busy = activating === skill.name;
            return (
              <li key={skill.name} data-testid={`skill-catalog-item-${skill.name}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-2">
                <h3 data-testid={`skill-name-${skill.name}`} className="text-xs font-semibold text-slate-800">
                  {skill.name}
                </h3>
                <p id={`skill-desc-${skill.name}`} data-testid={`skill-description-${skill.name}`} className="mt-0.5 text-[11px] leading-snug text-slate-600">
                  {skill.description}
                </p>
                <button
                  type="button"
                  data-testid={`skill-activate-${skill.name}`}
                  aria-label={busy ? `Activating ${skill.name}` : `Activate ${skill.name}`}
                  aria-describedby={`skill-desc-${skill.name}`}
                  aria-busy={busy}
                  disabled={disabled || activating !== null}
                  onClick={() => activate(skill)}
                  className="mt-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-400 disabled:opacity-50"
                >
                  {busy ? 'Activating…' : 'Activate'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {activating && (
        <p role="status" aria-live="polite" data-testid="skill-activate-progress" className="mt-2 text-[11px] font-medium text-indigo-700">
          Activating {activating}…
        </p>
      )}
      {activateError && (
        <p role="alert" data-testid="skill-activate-error" className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
          {activateError}
        </p>
      )}
      {activatedNote && !activateError && (
        <p role="status" data-testid="skill-activate-note" className="mt-2 text-[11px] font-medium text-slate-600">
          {activatedNote}
        </p>
      )}
    </section>
  );
}
