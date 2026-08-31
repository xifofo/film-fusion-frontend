import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_DELAY_MAX_SECONDS,
  automationDelayMaxValue,
  automationDelayParts,
  formatAutomationDelay,
  toAutomationDelaySeconds,
} from './delay';

describe('automation delay helpers', () => {
  it('converts supported units to canonical seconds', () => {
    expect(toAutomationDelaySeconds(10, 'minutes')).toBe(600);
    expect(toAutomationDelaySeconds(2, 'hours')).toBe(7200);
    expect(toAutomationDelaySeconds(1, 'days')).toBe(86400);
  });

  it('uses the largest exact unit when editing persisted seconds', () => {
    expect(automationDelayParts(172800)).toEqual({ value: 2, unit: 'days' });
    expect(automationDelayParts(90)).toEqual({ value: 90, unit: 'seconds' });
    expect(formatAutomationDelay(600)).toBe('10 分钟');
  });

  it('enforces the same thirty-day ceiling for every unit', () => {
    expect(automationDelayMaxValue('seconds')).toBe(
      AUTOMATION_DELAY_MAX_SECONDS,
    );
    expect(automationDelayMaxValue('days')).toBe(30);
  });
});
