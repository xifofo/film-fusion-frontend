type LoadingProps = {
  color?: string;
  exiting?: boolean;
  theme?: 'dark' | 'light';
};

const DEFAULT_LOADING_COLOR = '#1890ff';

const normalizeThemeColor = (color?: string) => {
  const value = color?.trim();
  if (/^#[\da-f]{6}$/i.test(value || '')) {
    return value as string;
  }
  if (/^#[\da-f]{3}$/i.test(value || '')) {
    return `#${[...(value as string).slice(1)]
      .map((character) => `${character}${character}`)
      .join('')}`;
  }
  return DEFAULT_LOADING_COLOR;
};

const Loading: React.FC<LoadingProps> = ({
  color,
  exiting = false,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const accentColor = normalizeThemeColor(color);

  return (
    <output
      className={`fixed inset-0 z-[2000] flex min-h-svh items-center justify-center transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-live="polite"
      aria-busy={!exiting}
      aria-hidden={exiting || undefined}
      style={{
        backgroundColor: isDark ? '#141414' : '#ffffff',
      }}
    >
      <span
        className="size-9 animate-spin rounded-full border-[3px]"
        aria-hidden="true"
        style={{
          borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
          borderTopColor: accentColor,
        }}
      />
      <span className="sr-only">页面加载中</span>
    </output>
  );
};

export default Loading;
