import { Spin } from 'antd';
import { type ReactNode, Suspense } from 'react';

export const PageLoadingIndicator = () => (
  <output
    className="flex w-full items-center justify-center"
    style={{ minHeight: 'min(420px, 55vh)' }}
    aria-label="页面加载中"
    aria-live="polite"
  >
    <Spin size="large" />
  </output>
);

export const PageLoadingBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <Suspense fallback={<PageLoadingIndicator />}>
    <div className="page-content-enter">{children}</div>
  </Suspense>
);
