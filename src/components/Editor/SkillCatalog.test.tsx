import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillCatalog } from './SkillCatalog';
import { SKILL_CATALOG_EMPTY_HINT, getSkillCatalog } from '../../utils/skillsHost';

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
    expect(screen.getByTestId('skill-description-type-to-flow')).toHaveTextContent('Convert a workflow.');
    fireEvent.click(activate);
    expect(await screen.findByTestId('skill-activate-progress')).toHaveTextContent('Activating type-to-flow…');
    rejectActivate(new Error('Skill not found.'));
    expect(await screen.findByTestId('skill-activate-error')).toHaveTextContent('Skill not found.');
    expect(screen.queryByTestId('skill-activate-note')).not.toBeInTheDocument();
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
