import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Form } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsToggle } from './SettingsToggle';

afterEach(cleanup);

describe('SettingsToggle', () => {
  it('keeps the setting name and effect visible next to the switch', async () => {
    const onFinish = vi.fn();
    render(
      <Form initialValues={{ telegram: { silent: false } }} onFinish={onFinish}>
        <SettingsToggle
          name={['telegram', 'silent']}
          title="静默发送"
          description="Telegram 收到消息时不播放提示音。"
        />
        <button type="submit">保存</button>
      </Form>,
    );

    expect(screen.getByText('静默发送')).toBeTruthy();
    expect(screen.getByText('Telegram 收到消息时不播放提示音。')).toBeTruthy();

    const toggle = screen.getByRole('switch', { name: '静默发送' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ telegram: { silent: true } });
    });
  });
});
