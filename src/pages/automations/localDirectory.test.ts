import { describe, expect, it } from 'vitest';
import type {
  AutomationScanResult,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import { buildAutomationCopy } from './copyAutomation';
import {
  defaultLocalDirectoryConfig,
  localDirectoryDefinition,
  localDirectoryPhaseLabel,
  localDirectoryReferences,
  localDirectoryScanMessage,
  readLocalDirectoryConfig,
} from './localDirectory';
import {
  collectAutomationBindings,
  portableAutomationTemplate,
  readTemplateConfiguration,
  replaceAutomationBindings,
} from './management';

const source: AutomationSource = {
  id: 1,
  name: 'NAS 监控',
  description: '',
  enabled: true,
  trigger_type: 'local_directory',
  directory_path: '/mnt/media',
  recursive: true,
  interval_seconds: 300,
  quiet_seconds: 30,
  local_config_json: JSON.stringify({
    ...defaultLocalDirectoryConfig(),
    batch_size: 16,
    max_watches: 64,
    exclude_patterns: ['*.part'],
    events: ['modified'],
  }),
  initialized: true,
  created_at: '',
  updated_at: '',
};
const workflow: AutomationWorkflow = {
  id: 2,
  source_id: 1,
  name: source.name,
  enabled: true,
  version: 1,
  definition_json: JSON.stringify(localDirectoryDefinition()),
  created_at: '',
  updated_at: '',
};

describe('local monitor management', () => {
  it('adds bounded scan and retention defaults when loading older monitor configurations', () => {
    const config = readLocalDirectoryConfig({
      local_config_json: JSON.stringify({
        mode: 'poll',
        events: ['modified'],
        batch_size: 32,
      }),
    });
    expect(config).toMatchObject({
      mode: 'poll',
      events: ['modified'],
      batch_size: 32,
      scan_budget_ms: 2000,
      scan_item_limit: 4096,
      max_pending_runs: 1000,
      history_retention_days: 30,
      history_max_runs: 10000,
      missing_retention_days: 7,
    });
  });
  it('does not report a partial baseline segment as a complete scan', () => {
    const result = {
      baseline: true,
      scanned_items: 4096,
      pending_stable: 8,
      created_runs: 0,
      local_monitor: {
        watched_directories: 0,
        degraded: false,
        in_progress: true,
        cycle_completed: false,
        phase: 'enumerate',
        pending_directories: 123456,
        backpressured: true,
        queued_runs: 1000,
      },
    } as AutomationScanResult;
    const message = localDirectoryScanMessage(result, 'baseline');
    expect(message).toContain('本段扫描 4096 个对象');
    expect(message).toContain('123456 个目录待扫描，本轮尚未完成');
    expect(message).toContain('运行积压 1000 项，暂缓派发新运行');
    expect(message).not.toContain('基线建立完成');
    expect(message).not.toContain('未触发存量内容');
  });
  it('labels supported stages and tolerates future backend stages', () => {
    expect(localDirectoryPhaseLabel('verify')).toBe('复核子树');
    expect(localDirectoryPhaseLabel('aggregate')).toBe('汇总目录稳定状态');
    expect(localDirectoryPhaseLabel('reconcile')).toBe('确认消失对象');
    expect(localDirectoryPhaseLabel('future-stage')).toBe('处理中');
  });

  it('copies local settings without introducing cloud account bindings', () => {
    const copy = buildAutomationCopy(source, workflow, []);
    expect(copy.source.enabled).toBe(false);
    expect(copy.source.local_config).toMatchObject({
      max_watches: 64,
      batch_size: 16,
      events: ['modified'],
      exclude_patterns: ['*.part'],
    });
    expect(copy.source.cloud_storage_id).toBeUndefined();
    expect(collectAutomationBindings(copy)).toHaveLength(1);
    const binding = collectAutomationBindings(copy)[0];
    expect(
      replaceAutomationBindings(copy, { [binding.key]: '/mnt/new' }).source
        .directory_path,
    ).toBe('/mnt/new');
    expect(source.directory_path).toBe('/mnt/media');
  });
  it('supports portable template import with resource limits retained and path cleared', () => {
    const portable = portableAutomationTemplate(
      buildAutomationCopy(source, workflow, []),
    );
    const imported = readTemplateConfiguration(JSON.stringify(portable));
    expect(imported.source.directory_path).toBe('');
    expect(imported.source.local_config?.batch_size).toBe(16);
    expect(imported.source.trigger_type).toBe('local_directory');
  });
  it('refuses corrupted persisted configuration during copy', () => {
    expect(() =>
      buildAutomationCopy(
        { ...source, local_config_json: '[1]' },
        workflow,
        [],
      ),
    ).toThrow('本地目录配置无法读取');
  });
  it('offers directory event fields using the engine item namespace', () => {
    expect(localDirectoryReferences.map((field) => field.value)).toEqual([
      '$item.event_id',
      '$item.event_type',
      '$item.path',
      '$item.relative_path',
      '$item.root_path',
      '$item.name',
      '$item.title',
      '$item.is_directory',
      '$item.size',
      '$item.modified_at',
    ]);
  });
});
