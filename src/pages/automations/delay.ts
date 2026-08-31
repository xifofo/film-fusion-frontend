export const AUTOMATION_DELAY_MAX_SECONDS = 30 * 24 * 60 * 60;

export type AutomationDelayUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const delayUnitSeconds: Record<AutomationDelayUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
};

export const automationDelayUnitOptions: Array<{
  label: string;
  value: AutomationDelayUnit;
}> = [
  { label: '秒', value: 'seconds' },
  { label: '分钟', value: 'minutes' },
  { label: '小时', value: 'hours' },
  { label: '天', value: 'days' },
];

export const toAutomationDelaySeconds = (
  value: unknown,
  unit: AutomationDelayUnit = 'minutes',
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * delayUnitSeconds[unit]);
};

export const automationDelayMaxValue = (unit: AutomationDelayUnit) =>
  Math.floor(AUTOMATION_DELAY_MAX_SECONDS / delayUnitSeconds[unit]);

export const automationDelayParts = (
  rawSeconds: unknown,
): { value: number; unit: AutomationDelayUnit } => {
  const seconds = Number(rawSeconds);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    return { value: 0, unit: 'minutes' };
  }
  for (const unit of ['days', 'hours', 'minutes'] as const) {
    const multiplier = delayUnitSeconds[unit];
    if (seconds % multiplier === 0) {
      return { value: seconds / multiplier, unit };
    }
  }
  return { value: seconds, unit: 'seconds' };
};

export const formatAutomationDelay = (rawSeconds: unknown) => {
  const { value, unit } = automationDelayParts(rawSeconds);
  const label = automationDelayUnitOptions.find(
    (option) => option.value === unit,
  )?.label;
  return value > 0 ? `${value} ${label}` : '立即执行';
};
