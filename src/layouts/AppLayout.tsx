import { ProLayout, SettingDrawer } from '@ant-design/pro-components';
import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import {
  AvatarDropdown,
  AvatarName,
  Footer,
  PageLoadingBoundary,
  Question,
  SelectLang,
} from '@/components';
import { useAppState } from '@/contexts/app-state';
import { useLoadingPresence } from '@/hooks/useLoadingPresence';
import Loading from '@/loading';
import { menuItems } from '@/router/menu';

const loginPath = '/user/login';

export default function AppLayout() {
  const location = useLocation();
  const { currentUser, loading, settings, setSettings } = useAppState();
  const loadingTheme = settings.navTheme === 'realDark' ? 'dark' : 'light';
  const loadingColor =
    typeof settings.colorPrimary === 'string'
      ? settings.colorPrimary
      : undefined;
  const loadingPresence = useLoadingPresence(loading);

  useEffect(() => {
    document.title =
      typeof settings.title === 'string' ? settings.title : 'Film Fusion';
  }, [settings.title]);

  if (!currentUser && !loadingPresence.mounted) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        replace
        to={`${loginPath}?${new URLSearchParams({ redirect })}`}
      />
    );
  }

  return (
    <>
      {currentUser && (
        <ProLayout
          {...settings}
          actionsRender={() => [
            <Question key="doc" />,
            <SelectLang key="language" />,
          ]}
          avatarProps={{
            src: '/logo.svg',
            title: <AvatarName />,
            render: (_, avatarChildren) => (
              <AvatarDropdown>{avatarChildren}</AvatarDropdown>
            ),
          }}
          bgLayoutImgList={[
            {
              src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/D2LWSqNny4sAAAAAAAAAAAAAFl94AQBr',
              left: 85,
              bottom: 100,
              height: '303px',
            },
            {
              src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/C2TWRpJpiC0AAAAAAAAAAAAAFl94AQBr',
              bottom: -68,
              right: -45,
              height: '303px',
            },
            {
              src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/F6vSTbj8KpYAAAAAAAAAAAAAFl94AQBr',
              bottom: 0,
              left: 0,
              width: '331px',
            },
          ]}
          footerRender={() => <Footer />}
          links={
            import.meta.env.DEV
              ? [<span key="ai-note">P.S. 前端代码 98% 由 AI 生成</span>]
              : []
          }
          location={{ pathname: location.pathname }}
          menuDataRender={() => menuItems}
          menuHeaderRender={undefined}
          menuItemRender={(item, dom) =>
            item.path && !item.children?.length ? (
              <Link to={item.path}>{dom}</Link>
            ) : (
              dom
            )
          }
        >
          <PageLoadingBoundary key={location.pathname}>
            <Outlet />
          </PageLoadingBoundary>
          {import.meta.env.DEV && (
            <SettingDrawer
              disableUrlParams
              enableDarkTheme
              settings={settings}
              onSettingChange={(nextSettings) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  ...nextSettings,
                }))
              }
            />
          )}
        </ProLayout>
      )}
      {loadingPresence.mounted && (
        <Loading
          key="app-loading"
          color={loadingColor}
          exiting={loadingPresence.exiting}
          theme={loadingTheme}
        />
      )}
    </>
  );
}
