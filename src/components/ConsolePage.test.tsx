import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ConsolePage from './ConsolePage';

describe('ConsolePage', () => {
  afterEach(cleanup);

  it('renders the shared page heading and keeps page actions and content', () => {
    render(
      <ConsolePage
        actions={<button type="button">刷新</button>}
        eyebrow="Media tools"
        title="媒体识别"
      >
        <section>页面内容</section>
      </ConsolePage>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '媒体识别' }),
    ).toBeTruthy();
    expect(screen.getByText('Media tools')).toBeTruthy();
    expect(screen.getByRole('button', { name: '刷新' })).toBeTruthy();
    expect(screen.getByText('页面内容')).toBeTruthy();
  });

  it('renders an optional control before the page title', () => {
    render(
      <ConsolePage
        eyebrow="Media organize"
        title="整理目录：影视中心"
        titlePrefix={<button type="button">返回目录</button>}
      >
        <section>整理内容</section>
      </ConsolePage>,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '整理目录：影视中心',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回目录' })).toBeTruthy();
  });
});
