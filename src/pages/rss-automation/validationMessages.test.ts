import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { humanizeRSSAutomationValidation } from './validationMessages';

const definition: RSSAutomationDefinition = {
  schema_version: 1,
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: '收到 RSS 条目',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'extract_between_mtkxmcp2_w8n7r',
      type: 'extract_between',
      name: '提取季度编号',
      position: { x: 200, y: 0 },
      config: {},
    },
    {
      id: 'end_success',
      type: 'end',
      name: '提取成功',
      position: { x: 400, y: -80 },
      config: {},
    },
    {
      id: 'end_failure',
      type: 'end',
      name: '提取失败',
      position: { x: 400, y: 80 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'edge_mtkxndpi_tdko',
      source: 'extract_between_mtkxmcp2_w8n7r',
      source_port: 'success',
      target: 'end_success',
    },
    {
      id: 'edge_mtkxmia6_nvxl',
      source: 'extract_between_mtkxmcp2_w8n7r',
      source_port: 'failure',
      target: 'end_failure',
    },
  ],
};

describe('humanizeRSSAutomationValidation', () => {
  it('replaces technical node and edge identifiers with configured names', () => {
    const result = humanizeRSSAutomationValidation(
      {
        valid: false,
        errors: [
          '节点 extract_between_mtkxmcp2_w8n7r 使用了不支持的类型 "extract_between"',
          '连线 edge_mtkxmia6_nvxl 的出口 "failure" 不适用于 extract_between 节点',
          '连线 edge_mtkxndpi_tdko 的出口 "success" 不适用于 extract_between 节点',
        ],
        warnings: [],
      },
      definition,
    );

    expect(result.errors).toEqual([
      '节点 “提取季度编号” 使用了不支持的类型 "extract_between"',
      '连线 “提取季度编号” → “提取失败” 的出口 "failure" 不适用于节点 “提取季度编号”',
      '连线 “提取季度编号” → “提取成功” 的出口 "success" 不适用于节点 “提取季度编号”',
    ]);
    expect(result.errors.join('\n')).not.toContain('mtkx');
  });
});
