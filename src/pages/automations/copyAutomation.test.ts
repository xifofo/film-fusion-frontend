import { describe, expect, it } from 'vitest';
import type {
  AutomationDefinition,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import { buildAutomationCopy } from './copyAutomation';

const mapping = {
  item_selector: 'feed/entry',
  fields: [
    { name: 'title', selector: 'title', type: 'string', required: true },
    {
      name: 'download_url',
      selector: 'link@href',
      match_attribute: 'rel',
      match_pattern: '^enclosure$',
    },
  ],
};
const source: AutomationSource = {
  id: 7,
  name: '新番订阅',
  description: '自定义 Atom 订阅',
  enabled: true,
  trigger_type: 'rss',
  feed_url: 'https://example.com/feed.xml',
  interval_minutes: 15,
  mapping_json: JSON.stringify(mapping),
  initialized: true,
  last_checked_at: '2026-10-04T01:00:00Z',
  last_success_at: '2026-10-04T01:00:00Z',
  last_error: '历史错误',
  created_at: '2026-10-01T01:00:00Z',
  updated_at: '2026-10-04T01:00:00Z',
};
const definition: AutomationDefinition = {
  schema_version: 1,
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 20, y: 40 } },
    {
      id: 'filter',
      type: 'if',
      name: '判断分类',
      position: { x: 280, y: 40 },
      config: { left: '$item.category', operator: 'eq', right: '动画' },
    },
    {
      id: 'download',
      type: 'qbittorrent',
      name: '下载到指定目录',
      position: { x: 540, y: 40 },
      config: {
        target_id: 42,
        url: '$item.download_url',
        save_path: '/downloads/anime',
        options: { tags: ['anime'], paused: false },
      },
      max_attempts: 5,
      ui: { width: 240 },
    },
    {
      id: 'notify',
      type: 'notification',
      position: { x: 800, y: 40 },
      config: { message: '{{nodes.download.output.info_hash}}' },
    },
    { id: 'end', type: 'end', position: { x: 1060, y: 40 } },
  ],
  edges: [
    { id: 'a', source: 'trigger', source_port: 'next', target: 'filter' },
    { id: 'b', source: 'filter', source_port: 'true', target: 'download' },
    { id: 'c', source: 'filter', source_port: 'false', target: 'end' },
    { id: 'd', source: 'download', source_port: 'success', target: 'notify' },
    { id: 'e', source: 'notify', source_port: 'success', target: 'end' },
  ],
  viewport: { x: 30, y: 60, zoom: 0.8 },
};
const workflow: AutomationWorkflow = {
  id: 9,
  source_id: source.id,
  name: '新番下载流程',
  description: '保留节点、分支和变量引用',
  enabled: true,
  version: 12,
  definition_json: JSON.stringify(definition),
  created_at: source.created_at,
  updated_at: source.updated_at,
};

describe('automation copying', () => {
  it('copies the full RSS graph and mapping without identity or execution state', () => {
    const original = structuredClone({ source, workflow });
    const copy = buildAutomationCopy(source, workflow, []);

    expect(copy).toEqual({
      source: {
        name: '新番订阅（副本）',
        description: source.description,
        enabled: false,
        trigger_type: 'rss',
        feed_url: source.feed_url,
        interval_minutes: 15,
        mapping,
      },
      workflow: {
        name: '新番下载流程（副本）',
        description: workflow.description,
        enabled: false,
        definition,
      },
    });

    const downloadConfig = copy.workflow.definition.nodes[2].config;
    if (!downloadConfig || !copy.source.mapping) {
      throw new Error('Expected copied download configuration and mapping');
    }
    downloadConfig.save_path = '/downloads/other';
    copy.workflow.definition.edges[1].target = 'notify';
    copy.source.mapping.fields[0].selector = 'other_title';
    expect({ source, workflow }).toEqual(original);
  });

  it('copies directory settings while leaving the source and workflow disabled', () => {
    const directory: AutomationSource = {
      ...source,
      trigger_type: '115_directory',
      cloud_storage_id: 8,
      directory_id: '12345',
      directory_path: '/待整理',
      recursive: false,
      interval_seconds: 600,
      quiet_seconds: 180,
    };
    const copy = buildAutomationCopy(directory, workflow, []);

    expect(copy.source).toEqual({
      name: '新番订阅（副本）',
      description: source.description,
      enabled: false,
      trigger_type: '115_directory',
      cloud_storage_id: 8,
      directory_id: '12345',
      directory_path: '/待整理',
      recursive: false,
      interval_seconds: 600,
      quiet_seconds: 180,
    });
    expect(copy.workflow.enabled).toBe(false);
    expect(copy.workflow.definition).toEqual(definition);
  });

  it('uses an independent mapping when the source supplies a parsed mapping', () => {
    const parsedSource = {
      ...source,
      mapping_json: undefined,
      mapping: JSON.parse(JSON.stringify(mapping)),
    };
    const copy = buildAutomationCopy(parsedSource, workflow, []);
    if (!copy.source.mapping) throw new Error('Expected copied mapping');
    copy.source.mapping.fields[0].selector = 'different';
    expect(parsedSource.mapping.fields[0].selector).toBe('title');
  });

  it('numbers existing copies and keeps names within the backend limit', () => {
    const name = '🎬'.repeat(120);
    const firstName = `${'🎬'.repeat(116)}（副本）`;
    const secondName = `${'🎬'.repeat(114)}（副本 2）`;
    const copy = buildAutomationCopy(
      { ...source, name },
      { ...workflow, name },
      [firstName, secondName],
    );
    expect(copy.source.name).toBe(`${'🎬'.repeat(114)}（副本 3）`);
    expect(Array.from(copy.source.name)).toHaveLength(120);
    expect(copy.workflow.name).toBe(copy.source.name);
  });

  it('rejects unreadable configurations instead of creating a default workflow', () => {
    expect(() => buildAutomationCopy(source, undefined, [])).toThrow('找不到');
    for (const raw of [
      '{',
      'null',
      '{}',
      '{"schema_version":1,"nodes":[],"edges":[]}',
    ]) {
      expect(() =>
        buildAutomationCopy(source, { ...workflow, definition_json: raw }, []),
      ).toThrow('原流程配置无法读取');
    }
    expect(() =>
      buildAutomationCopy({ ...source, mapping_json: '{}' }, workflow, []),
    ).toThrow('RSS 解析配置无法读取');
  });
});
