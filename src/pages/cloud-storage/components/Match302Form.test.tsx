import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Match302Form from './Match302Form';

afterEach(cleanup);

describe('Match302Form', () => {
  it('saves the Cookie-only access mode independently of the Token fields', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <Match302Form
        values={
          {
            id: 2,
            storage_type: '115open',
            storage_name: 'source',
            match302_access_mode: 'auto',
            match302_max_active: 0,
            match302_cache_max_gb: 0,
          } as API.CloudStorage
        }
        onSave={onSave}
      />,
    );

    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Match302 访问方式' }),
    );
    fireEvent.click(await screen.findByText('仅 Cookie（DownloadWithUA）'));
    fireEvent.click(screen.getByRole('button', { name: '保存 Match302' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ match302_access_mode: 'cookie_only' }),
      );
    });
  });
});
