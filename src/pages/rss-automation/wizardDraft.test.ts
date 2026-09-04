import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_RSS_AUTOMATION_DEFINITION,
  DEFAULT_RSS_AUTOMATION_MAPPING,
} from '@/services/film-fusion';
import {
  clearRSSAutomationWizardDraft,
  loadRSSAutomationWizardDraft,
  RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY,
  saveRSSAutomationWizardDraft,
} from './wizardDraft';

const source = {
  name: 'Mikan Project',
  enabled: true,
  feed_url: 'https://example.com/feed.xml',
  interval_minutes: 5,
  mapping: DEFAULT_RSS_AUTOMATION_MAPPING,
};

const sample = {
  title: 'Mikan Project',
  items: [{ fields: { title: '第 09 话', guid: 'episode-09' } }],
};

describe('RSS automation wizard draft storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => clearRSSAutomationWizardDraft());

  it('persists and restores every wizard stage value', () => {
    const definition = structuredClone(DEFAULT_RSS_AUTOMATION_DEFINITION);
    definition.viewport = { x: 120, y: 48, zoom: 0.8 };

    const saved = saveRSSAutomationWizardDraft({
      step: 2,
      sourceValues: {
        feed_url: source.feed_url,
        interval_minutes: 5,
        preset: 'rss',
      },
      publishValues: {
        name: '季度新番下载',
        description: '保留未完成配置',
        enabled: false,
      },
      source,
      sample,
      suggestedName: 'Mikan Project 自动化',
      definition,
      selectedSample: 0,
    });

    expect(saved.savedAt).toBeTruthy();
    expect(loadRSSAutomationWizardDraft()).toMatchObject({
      step: 2,
      source,
      sample,
      publishValues: { name: '季度新番下载', enabled: false },
      definition: { viewport: { x: 120, y: 48, zoom: 0.8 } },
    });
  });

  it('removes malformed local data instead of breaking the wizard', () => {
    window.localStorage.setItem(
      RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY,
      '{broken json',
    );

    expect(loadRSSAutomationWizardDraft()).toBeUndefined();
    expect(
      window.localStorage.getItem(RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  it('returns to the RSS step when an old draft lacks its preview sample', () => {
    saveRSSAutomationWizardDraft({
      step: 1,
      sourceValues: {
        feed_url: source.feed_url,
        interval_minutes: 5,
        preset: 'auto',
      },
      publishValues: {},
      suggestedName: '未完成自动化',
      definition: structuredClone(DEFAULT_RSS_AUTOMATION_DEFINITION),
      selectedSample: 0,
    });

    expect(loadRSSAutomationWizardDraft()?.step).toBe(0);
  });
});
