import LiquidGlass from 'liquid-glass-react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { FilingFooter } from '@/components/FilingFooter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/contexts/app-state';
import { getPublicAppConfig, login } from '@/services/film-fusion';

const DEFAULT_SITE: API.PublicAppConfig = {
  login_title: 'Film Fusion',
  login_subtitle: 'Film Fusion 是简单的 Emby + 网盘的辅助工具',
  login_form_title: '欢迎回来',
  login_form_subtitle: '使用管理员账户进入 Film Fusion 控制台',
  login_background_source: 'custom',
  login_background_mode: 'latest',
  login_background_interval: 12,
  login_backgrounds: [],
  footer_text: 'Powered by Kumayi',
};

const DARK_BACKGROUND = [
  'radial-gradient(circle at 16% 18%, rgba(255, 255, 255, 0.11), transparent 34%)',
  'radial-gradient(circle at 82% 22%, rgba(255, 255, 255, 0.07), transparent 31%)',
  'radial-gradient(circle at 52% 88%, rgba(255, 255, 255, 0.06), transparent 36%)',
  'linear-gradient(135deg, #030303 0%, #171717 48%, #080808 100%)',
].join(', ');

const buildBackgroundImage = (backgroundURL?: string) => {
  const normalizedURL = backgroundURL?.trim();
  if (!normalizedURL) {
    return DARK_BACKGROUND;
  }

  return [
    'linear-gradient(115deg, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.44) 52%, rgba(0, 0, 0, 0.72))',
    `url(${JSON.stringify(normalizedURL)})`,
    DARK_BACKGROUND,
  ].join(', ');
};

type LoginError = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

const getLoginErrorMessage = (error: unknown) => {
  const candidate = error as LoginError | undefined;
  return (
    candidate?.response?.data?.message ||
    candidate?.message ||
    '账户或密码错误，请重新输入'
  );
};

const normalizeUsername = (value: string) => value.replace(/[^\x21-\x7E]/g, '');

export default function Login() {
  const navigate = useNavigate();
  const intl = useIntl();
  const pageRef = useRef<HTMLElement>(null);
  const { refreshCurrentUser } = useAppState();
  const [site, setSite] = useState<API.PublicAppConfig>(DEFAULT_SITE);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);

  useEffect(() => {
    let active = true;

    getPublicAppConfig({ skipErrorHandler: true })
      .then((response) => {
        if (!active || response.code !== 0 || !response.data) {
          return;
        }

        setSite({
          ...DEFAULT_SITE,
          ...response.data,
          login_title:
            response.data.login_title?.trim() || DEFAULT_SITE.login_title,
          login_subtitle:
            response.data.login_subtitle?.trim() || DEFAULT_SITE.login_subtitle,
          login_form_title:
            response.data.login_form_title?.trim() ||
            DEFAULT_SITE.login_form_title,
          login_form_subtitle:
            response.data.login_form_subtitle?.trim() ||
            DEFAULT_SITE.login_form_subtitle,
        });
      })
      .catch(() => {
        // 兼容尚未提供新版公开配置接口的后端。
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(query.matches);
    updateMotionPreference();
    query.addEventListener('change', updateMotionPreference);
    return () => query.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const pageTitle = intl.formatMessage({
      id: 'menu.login',
      defaultMessage: '登录页',
    });
    document.title = `${pageTitle} - ${site.login_title}`;
  }, [intl, site.login_title]);

  const backgroundURLs = useMemo(() => {
    const dynamicURLs = (site.login_backgrounds || [])
      .map((value) => value.trim())
      .filter(Boolean);
    if (dynamicURLs.length > 0) {
      return [...new Set(dynamicURLs)];
    }

    const fallbackURL = site.login_background_url?.trim();
    return fallbackURL ? [fallbackURL] : [];
  }, [site.login_background_url, site.login_backgrounds]);

  const backgroundSlides = backgroundURLs.length > 0 ? backgroundURLs : [''];

  useEffect(() => {
    setBackgroundIndex(0);

    for (const backgroundURL of backgroundURLs) {
      const image = new Image();
      image.decoding = 'async';
      image.src = backgroundURL;
    }
  }, [backgroundURLs]);

  useEffect(() => {
    if (backgroundSlides.length < 2) {
      return;
    }

    const intervalSeconds = Math.min(
      300,
      Math.max(5, site.login_background_interval || 12),
    );
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      setBackgroundIndex((current) => (current + 1) % backgroundSlides.length);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [backgroundSlides.length, site.login_background_interval]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      const { response, error } = await login({
        username: username.trim(),
        password,
      });

      if (error || !response?.data) {
        setErrorMessage(getLoginErrorMessage(error));
        return;
      }

      localStorage.setItem('token', response.data.token);
      await refreshCurrentUser();

      const redirect = new URL(window.location.href).searchParams.get(
        'redirect',
      );
      const isSafeRedirect =
        !!redirect &&
        redirect.startsWith('/') &&
        !redirect.startsWith('//') &&
        !redirect.startsWith('/\\');
      navigate(isSafeRedirect ? redirect : '/');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      ref={pageRef}
      className="relative isolate box-border grid min-h-svh w-full place-items-center overflow-hidden bg-neutral-950 px-4 py-20 text-white sm:px-6"
      style={
        {
          '--ring': '#ffffff',
          colorScheme: 'dark',
        } as CSSProperties
      }
    >
      <div
        className="login-background-motion pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        {backgroundSlides.map((backgroundURL, index) => (
          <div
            className={`login-background-slide ${
              index === backgroundIndex ? 'login-background-slide-active' : ''
            }`}
            key={backgroundURL || 'builtin'}
            style={{
              backgroundImage: buildBackgroundImage(backgroundURL),
            }}
          />
        ))}
      </div>

      <header className="login-header-motion absolute top-6 left-6 z-20 flex max-w-[calc(100%-7rem)] items-center gap-3 sm:top-8 sm:left-10">
        <img
          className="size-11 rounded-[14px] border border-white/15 shadow-[0_14px_40px_rgba(0,0,0,0.16)]"
          alt=""
          src="/logo.svg"
        />
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold tracking-[0.12em] text-white">
            {site.login_title}
          </p>
          <p className="mt-1 mb-0 truncate text-[10px] tracking-[0.08em] text-white/45 sm:text-xs">
            {site.login_subtitle}
          </p>
        </div>
      </header>

      <section
        className="login-panel-motion relative z-10 h-[510px] w-[min(430px,calc(100vw-2rem))] [&>div]:!absolute [&>div]:!top-1/2 [&>div]:!left-1/2 [&>div.bg-black]:!opacity-0 [&>span]:!absolute [&>span]:!top-1/2 [&>span]:!left-1/2"
        aria-labelledby="login-heading"
      >
        <LiquidGlass
          className="h-full w-full [&>.glass]:!h-full [&>.glass]:!w-full [&>.glass>div]:!h-full [&>.glass>div]:!w-full"
          style={{ width: '100%', height: '100%' }}
          displacementScale={reducedMotion ? 0 : 34}
          blurAmount={0.65}
          saturation={105}
          aberrationIntensity={0}
          elasticity={0}
          cornerRadius={32}
          mode="standard"
          mouseContainer={pageRef}
          padding="0px"
        >
          <form
            className="box-border flex h-full w-full flex-col justify-center rounded-[32px] bg-black/[0.28] p-7 sm:p-9"
            onSubmit={handleSubmit}
          >
            <div className="login-content-motion login-content-delay-1 mb-7">
              <h1
                id="login-heading"
                className="m-0 text-3xl font-semibold tracking-[-0.04em] text-white"
              >
                {site.login_form_title}
              </h1>
              <p className="mt-2 mb-0 text-sm leading-6 text-white/60">
                {site.login_form_subtitle}
              </p>
            </div>

            <div className="login-content-motion login-content-delay-2 space-y-5">
              <div className="space-y-2">
                <Label
                  className="text-xs tracking-wide text-white/75"
                  htmlFor="username"
                >
                  用户名
                </Label>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/45"
                    aria-hidden="true"
                  />
                  <Input
                    id="username"
                    className="box-border h-12 rounded-xl border-white/15 bg-black/25 pr-4 pl-10 text-white shadow-inner shadow-black/10 placeholder:text-white/30 focus-visible:border-white/45 focus-visible:ring-2 focus-visible:ring-white/15 aria-invalid:border-white/50 aria-invalid:ring-white/15"
                    autoCapitalize="none"
                    autoComplete="username"
                    autoCorrect="off"
                    autoFocus
                    disabled={submitting}
                    inputMode="email"
                    lang="en"
                    onChange={(event) => {
                      setUsername(normalizeUsername(event.target.value));
                      setErrorMessage('');
                    }}
                    placeholder="输入用户名"
                    required
                    spellCheck={false}
                    type="text"
                    value={username}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  className="text-xs tracking-wide text-white/75"
                  htmlFor="password"
                >
                  密码
                </Label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/45"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    className="box-border h-12 rounded-xl border-white/15 bg-black/25 pr-12 pl-10 text-white shadow-inner shadow-black/10 placeholder:text-white/30 focus-visible:border-white/45 focus-visible:ring-2 focus-visible:ring-white/15 aria-invalid:border-white/50 aria-invalid:ring-white/15"
                    aria-invalid={Boolean(errorMessage)}
                    autoComplete="current-password"
                    disabled={submitting}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="输入密码"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <Button
                    className="absolute top-1/2 right-1.5 size-9 -translate-y-1/2 text-white/45 hover:bg-white/10 hover:text-white"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    disabled={submitting}
                    onClick={() => setShowPassword((current) => !current)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
            </div>

            {errorMessage && (
              <Alert className="login-content-motion mt-4 box-border border-white/20 bg-black/35 text-white">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription className="text-white/65">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="login-content-motion login-content-delay-3 mt-5 h-12 w-full rounded-xl bg-white text-black shadow-[0_12px_34px_rgba(255,255,255,0.1)] hover:bg-neutral-200"
              disabled={submitting}
              size="lg"
              type="submit"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  正在验证
                </>
              ) : (
                <>
                  进入控制台
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </LiquidGlass>
      </section>

      <FilingFooter
        className="login-footer-motion absolute right-5 bottom-5 left-5 z-20 sm:right-8 sm:bottom-6 sm:left-8"
        site={site}
        theme="dark"
      />
    </main>
  );
}
