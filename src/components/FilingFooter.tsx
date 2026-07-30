import { cn } from '@/lib/utils';
import { PoliceFilingIcon } from './PoliceFilingIcon';

const ICP_QUERY_URL = 'https://beian.miit.gov.cn/';
const POLICE_QUERY_URL = 'https://beian.mps.gov.cn/';

type FilingFooterProps = {
  className?: string;
  site: Pick<
    API.PublicAppConfig,
    'footer_text' | 'icp_number' | 'police_number'
  >;
  theme?: 'light' | 'dark';
};

export function FilingFooter({
  className,
  site,
  theme = 'dark',
}: FilingFooterProps) {
  const footerText = site.footer_text?.trim();
  const icpNumber = site.icp_number?.trim();
  const policeNumber = site.police_number?.trim();
  const isDark = theme === 'dark';
  const policeRecordCode = policeNumber?.match(/\d{10,20}/)?.[0];
  const policeURL = policeRecordCode
    ? `${POLICE_QUERY_URL}#/query/webSearch?code=${encodeURIComponent(policeRecordCode)}`
    : POLICE_QUERY_URL;

  if (!footerText && !icpNumber && !policeNumber) {
    return null;
  }

  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] tracking-wide',
        isDark ? 'text-white/45' : 'text-black/45',
        className,
      )}
    >
      {footerText && <span>{footerText}</span>}
      {icpNumber && (
        <a
          className="transition-opacity hover:opacity-75 focus-visible:underline focus-visible:underline-offset-4"
          href={ICP_QUERY_URL}
          rel="noreferrer"
          style={{ color: 'inherit' }}
          target="_blank"
        >
          {icpNumber}
        </a>
      )}
      {policeNumber && (
        <a
          className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-75 focus-visible:underline focus-visible:underline-offset-4"
          href={policeURL}
          rel="noopener noreferrer"
          style={{ color: 'inherit' }}
          target="_blank"
        >
          <PoliceFilingIcon />
          <span>{policeNumber}</span>
        </a>
      )}
    </footer>
  );
}
