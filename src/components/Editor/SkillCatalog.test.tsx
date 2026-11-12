import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillCatalog } from './SkillCatalog';
import {
  SKILL_CATALOG_EMPTY_HINT,
  SKILL_CATALOG_SOURCE_NOTE,
  getSkillCatalog,
} from '../../utils/skillsHost';

vi.mock('../../utils/skillsHost', async () => {
  const actual = await vi.importActual<typeof import('../../utils/skillsHost')>('../../utils/skillsHost');
  return {
    ...actual,
    getSkillCatalog: vi.fn(),
  };
});

const catalog = vi.mocked(getSkillCatalog);

beforeEach(() => {
  catalog.mockReset();
});

describe('Skill catalog', () => {
  it('shows the path hint when the skills tree is empty', async () => {
    catalog.mockResolvedValue([]);
    render(<SkillCatalog onActivate={vi.fn()} />);
    expect(await screen.findByTestId('skill-catalog-empty')).toHaveTextContent(SKILL_CATALOG_EMPTY_HINT);
    expect(screen.getByTestId('skill-catalog-empty')).toHaveTextContent('/workspace/.agents/skills/');
    expect(screen.getByTestId('skill-catalog-reload-note')).toHaveTextContent('Worker redeploy');
    expect(screen.getByTestId('skill-catalog-source-note')).toHaveTextContent(SKILL_CATALOG_SOURCE_NOTE);
  });

  it('lists name and description and shows activate progress and errors', async () => {
    catalog.mockResolvedValue([{
      name: 'type-to-flow',
      description: 'Convert a workflow.',
      location: '/workspace/.agents/skills/type-to-flow',
    }]);
    let rejectActivate: (error: Error) => void = () => {};
    const onActivate = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectActivate = reject;
    }));
    render(<SkillCatalog onActivate={onActivate} />);

    const activate = await screen.findByRole('button', { name: 'Activate type-to-flow' });
    expect(screen.getByTestId('skill-name-type-to-flow')).toHaveTextContent('type-to-flow');
    expect(screen.getByTestId('skill-source-type-to-flow')).toHaveTextContent('Source: Workspace');
    expect(screen.getByTestId('skill-catalog-status')).toHaveTextContent('Loaded 1 skill: type-to-flow (Workspace).');
    expect(screen.getByTestId('skill-description-type-to-flow')).toHaveTextContent('Convert a workflow.');
    fireEvent.click(activate);
    expect(await screen.findByTestId('skill-activate-progress')).toHaveTextContent('Activating type-to-flow…');
    rejectActivate(new Error('Skill not found.'));
    expect(await screen.findByTestId('skill-activate-error')).toHaveTextContent('Skill not found.');
    expect(screen.queryByTestId('skill-activate-note')).not.toBeInTheDocument();
  });

  it('shows secondary bundle and R2 sources and updates to Workspace on reload', async () => {
    catalog
      .mockResolvedValueOnce([
        {
          name: 'type-to-flow',
          description: 'Secondary bundle skill.',
          location: 'agents:skills/type-to-flow',
          sourceId: 'bundle:agents:skills',
        },
        {
          name: 'review-notes',
          description: 'Secondary R2 skill.',
          location: 'agents:skills/review-notes',
          sourceId: 'r2:agents:skills',
        },
      ])
      .mockResolvedValueOnce([
        {
          name: 'type-to-flow',
          description: 'Workspace override wins.',
          location: '/workspace/.agents/skills/type-to-flow',
          sourceId: 'workspace:/workspace/.agents/skills',
        },
        {
          name: 'review-notes',
          description: 'Secondary R2 skill.',
          location: 'agents:skills/review-notes',
          sourceId: 'r2:agents:skills',
        },
      ]);

    render(<SkillCatalog onActivate={vi.fn()} />);
    expect(await screen.findByTestId('skill-source-type-to-flow')).toHaveTextContent('Source: bundle');
    expect(screen.getByTestId('skill-source-review-notes')).toHaveTextContent('Source: R2');
    expect(screen.getByTestId('skill-catalog-status')).toHaveTextContent(
      'Loaded 2 skills: type-to-flow (bundle), review-notes (R2).',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reload skills' }));
    expect(await screen.findByTestId('skill-description-type-to-flow')).toHaveTextContent('Workspace override wins.');
    expect(screen.getByTestId('skill-source-type-to-flow')).toHaveTextContent('Source: Workspace');
    expect(screen.getByTestId('skill-source-review-notes')).toHaveTextContent('Source: R2');
    expect(screen.getByTestId('skill-catalog-status')).toHaveTextContent(
      'Loaded 2 skills: type-to-flow (Workspace), review-notes (R2).',
    );
  });

  it('reloads the catalog so a newly added skill appears', async () => {
    catalog
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        name: 'review-notes',
        description: 'Summarise a board in plain language.',
        location: '/workspace/.agents/skills/review-notes',
      }]);
    render(<SkillCatalog onActivate={vi.fn()} />);
    expect(await screen.findByTestId('skill-catalog-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload skills' }));
    expect(await screen.findByTestId('skill-name-review-notes')).toHaveTextContent('review-notes');
    expect(screen.getByTestId('skill-description-review-notes')).toHaveTextContent('Summarise a board in plain language.');
    expect(catalog).toHaveBeenLastCalledWith({ reload: true });
  });
});
