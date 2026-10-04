import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MediaRecognitionShadowTestResult } from '@/services/film-fusion';
import { ShadowComparisonResult } from './index';

const result: MediaRecognitionShadowTestResult = {
  primary_engine: 'moviepilot',
  comparison: {
    status: 'different',
    matched: false,
    moviepilot: { engine: 'moviepilot', title: 'MP2 标题', tmdb_id: '1' },
    local: { engine: 'medianame', title: 'medianame 标题', tmdb_id: '2' },
    differences: [
      {
        field: 'title',
        label: '标题',
        moviepilot: 'MP2 标题',
        local: 'medianame 标题',
      },
    ],
  },
};

describe('recognition comparison presentation', () => {
  afterEach(cleanup);
  it('places medianame first in cards and field differences while retaining engine identity', () => {
    render(<ShadowComparisonResult result={result} />);
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .slice(0, 2)
        .map((heading) => heading.textContent),
    ).toEqual(['medianame 识别', 'MP2 识别']);
    expect(
      screen.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['字段', 'medianame', 'MP2']);
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['标题', 'medianame 标题', 'MP2 标题']);
    expect(result.primary_engine).toBe('moviepilot');
  });
  it('keeps a medianame failure in the preferred card even when MP2 succeeded', () => {
    render(
      <ShadowComparisonResult
        result={{
          ...result,
          comparison: {
            ...result.comparison,
            local: undefined,
            local_error: 'medianame: ambiguous',
            status: 'local_error',
          },
        }}
      />,
    );
    const heading = screen.getByRole('heading', { name: 'medianame 识别' });
    expect(heading.closest('section')?.textContent).toContain(
      'medianame: ambiguous',
    );
    expect(heading.closest('section')?.textContent).not.toContain('MP2 标题');
  });
});
