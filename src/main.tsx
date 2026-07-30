import '@ant-design/v5-patch-for-react-19';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AppStateProvider } from '@/contexts/app-state';
import { AppLocaleProvider } from '@/i18n';
import { router } from '@/router';
import '@/styles/globals.css';
import '@/global.less';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root application container');
}

const keepBootLoading =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('debug-loading') === 'boot';

if (!keepBootLoading) {
  ReactDOM.createRoot(root).render(
    <AppLocaleProvider>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AppStateProvider>
            <RouterProvider router={router} />
          </AppStateProvider>
        </QueryClientProvider>
      </AntdApp>
    </AppLocaleProvider>,
  );
}
