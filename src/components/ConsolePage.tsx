import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ConsolePageProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow: ReactNode;
  title: ReactNode;
  titlePrefix?: ReactNode;
};

const ConsolePage = ({
  actions,
  children,
  className,
  eyebrow,
  title,
  titlePrefix,
}: ConsolePageProps) => (
  <div
    className={cn(
      'box-border w-full px-4 py-5 sm:px-6 sm:py-7 xl:px-8',
      className,
    )}
  >
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
          {eyebrow}
        </p>
        {titlePrefix ? (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
            <div className="shrink-0">{titlePrefix}</div>
            <h1 className="m-0 min-w-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
              {title}
            </h1>
          </div>
        ) : (
          <h1 className="mt-2 mb-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
            {title}
          </h1>
        )}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>

    {children}
  </div>
);

export default ConsolePage;
