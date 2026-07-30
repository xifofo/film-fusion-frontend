/**
 * React 启动前的轻量占位，与应用内的传统圆形 Loading 保持一致。
 */
(function () {
  const root = document.querySelector('#root');

  if (!root || root.innerHTML !== '') {
    return;
  }

  let theme = document.documentElement.dataset.theme;
  try {
    const savedTheme = localStorage.getItem('film-fusion-nav-theme');
    if (savedTheme === 'realDark' || savedTheme === 'light') {
      theme = savedTheme;
    }
  } catch {}
  const searchParams = new URLSearchParams(window.location.search);
  const debugTheme = searchParams.get('theme');
  const isLoadingDebug =
    window.location.pathname === '/debug/loading' ||
    searchParams.get('debug-loading') === 'boot';
  if (
    isLoadingDebug &&
    (debugTheme === 'dark' || debugTheme === 'light')
  ) {
    theme = debugTheme;
  }
  const themeClass =
    theme === 'dark' || theme === 'realDark'
      ? 'boot-loading--dark'
      : 'boot-loading--light';
  const defaultThemeColor =
    document
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute('content') || '#1890ff';
  const debugColor = isLoadingDebug ? searchParams.get('color') : '';
  const isValidThemeColor = (value) =>
    /^#[\da-f]{3}([\da-f]{3})?$/i.test(value || '');
  const themeColor = isValidThemeColor(debugColor)
    ? debugColor
    : isValidThemeColor(defaultThemeColor)
      ? defaultThemeColor
      : '#1890ff';

  root.innerHTML = `
    <style>
      html,
      body,
      #root {
        min-height: 100%;
        margin: 0;
      }

      .boot-loading {
        --boot-primary: #1890ff;
        --boot-background: #ffffff;
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        overflow: hidden;
        padding: 24px;
        box-sizing: border-box;
        background: var(--boot-background);
      }

      .boot-loading--dark {
        --boot-background: #141414;
      }

      .boot-loading__spinner {
        width: 36px;
        height: 36px;
        box-sizing: border-box;
        border: 3px solid color-mix(in srgb, var(--boot-primary) 20%, transparent);
        border-top-color: var(--boot-primary);
        border-radius: 50%;
        animation: boot-loading-spin 0.8s linear infinite;
      }

      @keyframes boot-loading-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .boot-loading__spinner {
          animation-duration: 1.6s;
        }
      }

    </style>
    <output class="boot-loading ${themeClass}" aria-busy="true" aria-live="polite">
      <span class="boot-loading__spinner" aria-hidden="true"></span>
      <span style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;">页面加载中</span>
    </output>
  `;
  const bootLoading = root.querySelector('.boot-loading');
  if (bootLoading instanceof HTMLElement) {
    bootLoading.style.setProperty('--boot-primary', themeColor);
  }
})();
