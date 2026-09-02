import {
  AimOutlined,
  ApartmentOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  ImportOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Background,
  type Connection,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Viewport,
} from '@xyflow/react';
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  List,
  Modal,
  message,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  RSSAutomationDefinition,
  RSSAutomationEntryHistoryItem,
  RSSAutomationMapping,
  RSSAutomationNodeDefinition,
  RSSAutomationNodeProtocol,
  RSSAutomationNodeType,
  RSSAutomationParsedFeed,
  RSSAutomationSource,
  RSSAutomationTarget,
  RSSAutomationValidationResult,
  RSSAutomationWorkflow,
} from '@/services/film-fusion';
import {
  DEFAULT_RSS_AUTOMATION_DEFINITION,
  updateRSSAutomationWorkflow,
  validateRSSAutomationWorkflow,
} from '@/services/film-fusion';
import EntryHistoryPanel from './EntryHistoryPanel';
import FlowNode from './FlowNode';
import {
  buildFlowNodeVariableSummaries,
  buildFlowRoutingPlan,
  createNodeDefinition,
  definitionToFlow,
  edgeDefinitionToFlowEdge,
  flowNodeHeight,
  flowToDefinition,
  joinHasConditionalOutcome,
  NODE_LABELS,
  nodeBranches,
  normalizeFlowTargetHandle,
  parseWorkflowDefinition,
  type RSSFlowEdge,
  type RSSFlowNode,
  type RSSFlowVariableView,
} from './flow';
import styles from './index.module.less';
import NodeConfigModal, { type NodeFieldReference } from './NodeConfigDrawer';
import NodeVariableDrawer from './NodeVariableDrawer';
import { NODE_PALETTE_COLUMNS } from './nodePalette';
import { simulateRSSAutomation } from './preview';
import {
  buildRSSItemReferences,
  parseRSSSourceMapping,
} from './rssFieldReferences';
import SamplePreviewPanel from './SamplePreviewPanel';
import WorkflowEdge from './WorkflowEdge';
import {
  createWorkflowTransferPackage,
  type ParsedWorkflowTransfer,
  parseWorkflowTransferText,
  RSS_WORKFLOW_TRANSFER_MAX_BYTES,
  workflowTransferFileName,
} from './workflowTransfer';

const { Text, Title } = Typography;
const nodeTypes = { rssAutomationNode: FlowNode };
const edgeTypes = { workflow: WorkflowEdge };
const FLOW_NODE_WIDTH = 224;
const FLOW_FIT_VIEW_OPTIONS = { padding: 0.18, maxZoom: 1 };

const referencePreview = (value: unknown) => {
  if (value == null || value === '') return undefined;
  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value).trim();
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
};

const previewFeedFromEntry = (
  item: RSSAutomationEntryHistoryItem,
): RSSAutomationParsedFeed => {
  let fields: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(item.entry.fields_json) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      fields = { ...(parsed as Record<string, unknown>) };
    }
  } catch {
    // Keep the canonical entry fields below so older malformed records remain previewable.
  }

  const canonicalFields: Record<string, unknown> = {
    title: item.entry.title,
    detail_url: item.entry.detail_url,
    download_url: item.entry.download_url,
    guid: item.entry.guid,
    published_at: item.entry.published_at,
  };
  for (const [name, value] of Object.entries(canonicalFields)) {
    if (fields[name] == null && value != null && value !== '') {
      fields[name] = value;
    }
  }

  return {
    title: item.source_name || 'RSS 条目记录',
    items: [{ fields }],
  };
};

type WorkflowPanelProps = {
  workflows: RSSAutomationWorkflow[];
  sources: RSSAutomationSource[];
  targets: RSSAutomationTarget[];
  cloudStorages: API.CloudStorage[];
  cloudDirectories: API.CloudDirectory[];
  nodeProtocols?: RSSAutomationNodeProtocol[];
  loading: boolean;
  onChanged: () => Promise<void> | void;
  onCreate?: () => void;
  mode?: 'manage' | 'wizard';
  initialDefinition?: RSSAutomationDefinition;
  sourceMapping?: RSSAutomationMapping;
  previewFeed?: RSSAutomationParsedFeed;
  onWizardBack?: (definition: RSSAutomationDefinition) => void;
  onWizardNext?: (definition: RSSAutomationDefinition) => Promise<void> | void;
  showWorkflowList?: boolean;
};

type WorkflowMeta = {
  id?: number;
  name: string;
  description: string;
  sourceId: number;
  enabled: boolean;
  version?: number;
};

type PendingWorkflowImport = ParsedWorkflowTransfer & { fileName: string };

const bindingRequirements = (value: ParsedWorkflowTransfer['requirements']) =>
  [
    value.qbittorrentTargets > 0
      ? `${value.qbittorrentTargets} 个 qBittorrent 目标`
      : '',
    value.offline115Accounts > 0
      ? `${value.offline115Accounts} 个 115 Cookie 账号`
      : '',
    value.offline115OpenAPIAccounts > 0
      ? `${value.offline115OpenAPIAccounts} 个 115 OpenAPI 账号`
      : '',
    value.directorySelections > 0
      ? `${value.directorySelections} 个 115 保存目录`
      : '',
    value.organizeDirectories > 0
      ? `${value.organizeDirectories} 个整理目录配置`
      : '',
  ].filter(Boolean);

const emptyMeta = (): WorkflowMeta => ({
  name: '新的 RSS 自动化流程',
  description: '',
  sourceId: 0,
  enabled: false,
});

const cloneDefaultDefinition = () =>
  structuredClone(DEFAULT_RSS_AUTOMATION_DEFINITION);

const wizardTemplates: Array<{
  key: string;
  label: string;
  definition: () => RSSAutomationDefinition;
}> = [
  {
    key: 'blank',
    label: '空白流程',
    definition: cloneDefaultDefinition,
  },
  {
    key: 'episode',
    label: '标题集数 > 1000',
    definition: () => ({
      schema_version: 1,
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: '收到 RSS 条目',
          position: { x: 60, y: 240 },
          config: {},
        },
        {
          id: 'extract_episode',
          type: 'regex',
          name: '从标题提取集数',
          position: { x: 350, y: 180 },
          config: {
            input: '$item.title',
            pattern: '(\\d+)集',
            group: '1',
            variable: 'episode',
            value_type: 'integer',
          },
        },
        {
          id: 'episode_over_1000',
          type: 'if',
          name: '集数大于 1000',
          position: { x: 660, y: 140 },
          config: {
            condition: {
              field: '$vars.episode',
              operator: 'gt',
              value: 1000,
            },
          },
        },
        {
          id: 'shared_end',
          type: 'end',
          name: '结束',
          position: { x: 980, y: 210 },
          config: {},
        },
      ],
      edges: [
        {
          id: 'edge_trigger_extract',
          source: 'trigger',
          source_port: 'next',
          target: 'extract_episode',
        },
        {
          id: 'edge_extract_if',
          source: 'extract_episode',
          source_port: 'success',
          target: 'episode_over_1000',
        },
        {
          id: 'edge_extract_failed',
          source: 'extract_episode',
          source_port: 'failure',
          target: 'shared_end',
        },
        {
          id: 'edge_episode_true',
          source: 'episode_over_1000',
          source_port: 'true',
          target: 'shared_end',
        },
        {
          id: 'edge_episode_false',
          source: 'episode_over_1000',
          source_port: 'false',
          target: 'shared_end',
        },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
    }),
  },
  {
    key: 'parallel',
    label: '并行两路',
    definition: () => ({
      schema_version: 1,
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: '收到 RSS 条目',
          position: { x: 80, y: 190 },
          config: {},
        },
        {
          id: 'parallel',
          type: 'parallel',
          name: '同时执行',
          position: { x: 400, y: 190 },
          config: { branches: ['branch-1', 'branch-2'] },
        },
        {
          id: 'shared_end',
          type: 'end',
          name: '结束',
          position: { x: 740, y: 190 },
          config: {},
        },
      ],
      edges: [
        {
          id: 'edge_trigger_parallel',
          source: 'trigger',
          source_port: 'next',
          target: 'parallel',
        },
        {
          id: 'edge_parallel_1',
          source: 'parallel',
          source_port: 'branch-1',
          target: 'shared_end',
        },
        {
          id: 'edge_parallel_2',
          source: 'parallel',
          source_port: 'branch-2',
          target: 'shared_end',
        },
      ],
      viewport: { x: 0, y: 0, zoom: 0.9 },
    }),
  },
];

const WorkflowPanelInner = ({
  workflows,
  sources,
  targets,
  cloudStorages,
  cloudDirectories,
  nodeProtocols = [],
  loading,
  onChanged,
  onCreate,
  mode = 'manage',
  initialDefinition,
  sourceMapping,
  previewFeed,
  onWizardBack,
  onWizardNext,
  showWorkflowList = true,
}: WorkflowPanelProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<RSSFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RSSFlowEdge>([]);
  const [meta, setMeta] = useState<WorkflowMeta>(emptyMeta);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [variablePanel, setVariablePanel] = useState<{
    nodeId: string;
    view: RSSFlowVariableView;
  }>();
  const [validation, setValidation] = useState<RSSAutomationValidationResult>();
  const [saving, setSaving] = useState(false);
  const [layingOut, setLayingOut] = useState(false);
  const [previewItemIndex, setPreviewItemIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [entryPickerOpen, setEntryPickerOpen] = useState(false);
  const [selectedPreviewFeed, setSelectedPreviewFeed] =
    useState<RSSAutomationParsedFeed>();
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingWorkflowImport>();
  const [viewport, setViewportState] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const instanceRef = useRef<ReactFlowInstance<
    RSSFlowNode,
    RSSFlowEdge
  > | null>(null);
  const initialized = useRef(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const nodePickerContentRef = useRef<HTMLDivElement>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const sourceByID = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const effectivePreviewFeed =
    mode === 'manage' ? selectedPreviewFeed : previewFeed;
  const openVariablePanel = useCallback(
    (nodeId: string, view: RSSFlowVariableView) => {
      setSelectedNodeId(undefined);
      setSelectedEdgeId(undefined);
      setVariablePanel({ nodeId, view });
    },
    [],
  );

  const loadDefinition = useCallback(
    (definition: RSSAutomationDefinition) => {
      const flow = definitionToFlow(definition);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setValidation(undefined);
      setSelectedNodeId(undefined);
      setSelectedEdgeId(undefined);
      setVariablePanel(undefined);
      const nextViewport = definition.viewport || { x: 0, y: 0, zoom: 1 };
      setViewportState(nextViewport);
      window.setTimeout(() => {
        instanceRef.current?.setViewport(nextViewport);
      });
    },
    [setEdges, setNodes],
  );

  const selectWorkflow = useCallback(
    (workflow: RSSAutomationWorkflow) => {
      const definition = parseWorkflowDefinition(workflow.definition_json);
      if (!definition) {
        messageApi.error(`流程“${workflow.name}”的定义无法解析`);
        return;
      }
      setMeta({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description || '',
        sourceId: workflow.source_id,
        enabled: workflow.enabled,
        version: workflow.version,
      });
      setSelectedPreviewFeed(undefined);
      setPreviewItemIndex(0);
      setPreviewOpen(false);
      setEntryPickerOpen(false);
      loadDefinition(definition);
    },
    [loadDefinition, messageApi],
  );

  useEffect(() => {
    if (mode !== 'wizard' || initialized.current || loading) return;
    initialized.current = true;
    loadDefinition(initialDefinition || cloneDefaultDefinition());
  }, [initialDefinition, loadDefinition, loading, mode]);

  useEffect(() => {
    if (mode !== 'manage' || loading) return;
    if (workflows.length === 0) {
      if (meta.id) {
        setMeta(emptyMeta());
        setNodes([]);
        setEdges([]);
      }
      return;
    }
    if (!meta.id || !workflows.some((workflow) => workflow.id === meta.id)) {
      selectWorkflow(workflows[0]);
    }
  }, [loading, meta.id, mode, selectWorkflow, setEdges, setNodes, workflows]);

  useEffect(() => {
    if (!effectivePreviewFeed?.items[previewItemIndex]) setPreviewItemIndex(0);
  }, [effectivePreviewFeed, previewItemIndex]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId)?.data.definition,
    [nodes, selectedNodeId],
  );

  const previewDefinition = useMemo(
    () => flowToDefinition(nodes, edges, viewport),
    [edges, nodes, viewport],
  );
  const simulation = useMemo(() => {
    const item = effectivePreviewFeed?.items[previewItemIndex]?.fields;
    return item ? simulateRSSAutomation(previewDefinition, item) : undefined;
  }, [effectivePreviewFeed, previewDefinition, previewItemIndex]);
  const previewEntry = useCallback((item: RSSAutomationEntryHistoryItem) => {
    setSelectedPreviewFeed(previewFeedFromEntry(item));
    setPreviewItemIndex(0);
    setEntryPickerOpen(false);
    setPreviewOpen(true);
  }, []);
  const fieldReferences = useMemo(() => {
    const references: NodeFieldReference[] = [];
    const seen = new Set<string>();
    const addReference = (reference: NodeFieldReference) => {
      if (seen.has(reference.value)) return;
      seen.add(reference.value);
      references.push(reference);
    };

    const sampleFields =
      effectivePreviewFeed?.items[previewItemIndex]?.fields ||
      ({} as Record<string, unknown>);
    const mapping =
      sourceMapping ||
      parseRSSSourceMapping(sourceByID.get(meta.sourceId)?.mapping_json);
    for (const reference of buildRSSItemReferences(mapping, sampleFields)) {
      addReference(reference);
    }

    const ancestorIDs = new Set<string>();
    if (selectedNodeId) {
      const queue = [selectedNodeId];
      while (queue.length > 0) {
        const targetID = queue.shift() as string;
        for (const edge of edges) {
          if (edge.target !== targetID || ancestorIDs.has(edge.source)) {
            continue;
          }
          ancestorIDs.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    for (const flowNode of nodes) {
      if (!ancestorIDs.has(flowNode.id)) continue;
      const definition = flowNode.data.definition;
      const previewOutput = simulation?.nodes[flowNode.id]?.output;
      const previewRecord =
        previewOutput && typeof previewOutput === 'object'
          ? (previewOutput as Record<string, unknown>)
          : undefined;
      if (
        [
          'regex',
          'keyword_replace',
          'regex_replace',
          'convert',
          'set_variable',
          'template',
          'json_extract',
          'math',
          'datetime_operation',
          'list_operation',
          'coalesce',
          'foreach',
        ].includes(definition.type)
      ) {
        const name = String(definition.config?.variable || '').trim();
        if (name) {
          const producedVariables =
            previewRecord?.variables &&
            typeof previewRecord.variables === 'object' &&
            !Array.isArray(previewRecord.variables)
              ? (previewRecord.variables as Record<string, unknown>)
              : undefined;
          addReference({
            kind: 'variable',
            name,
            value: `$vars.${name}`,
            preview:
              referencePreview(producedVariables?.[name]) ||
              referencePreview(simulation?.variables[name]),
            description: `由“${definition.name || NODE_LABELS[definition.type]}”写入`,
          });
        }
      }
      const protocol = nodeProtocols.find(
        (candidate) => candidate.type === definition.type,
      );
      for (const output of protocol?.outputs || []) {
        addReference({
          kind: 'node',
          name: `${definition.name || NODE_LABELS[definition.type]} · ${output.label}`,
          value: `$nodes.${definition.id}.output.${output.name}`,
          preview:
            referencePreview(previewRecord?.[output.name]) ||
            referencePreview(output.example),
          dataType: output.type,
          description: output.description,
        });
      }
    }

    const configuredReference = (() => {
      if (!selectedNode) return '';
      if (
        [
          'keyword',
          'keyword_replace',
          'regex',
          'regex_replace',
          'convert',
          'json_extract',
          'datetime_operation',
          'list_operation',
          'switch',
          'foreach',
        ].includes(selectedNode.type)
      ) {
        return String(selectedNode.config?.input || '').trim();
      }
      if (selectedNode.type === 'set_variable') {
        return String(selectedNode.config?.value || '').trim();
      }
      if (selectedNode.type === 'math') {
        return String(selectedNode.config?.left || '').trim();
      }
      if (selectedNode.type === 'coalesce') {
        const candidates = selectedNode.config?.candidates;
        return Array.isArray(candidates)
          ? String(candidates[0] || '').trim()
          : '';
      }
      if (
        selectedNode.type === 'deduplicate' ||
        selectedNode.type === 'rate_limit'
      ) {
        return String(selectedNode.config?.key || '').trim();
      }
      if (selectedNode.type === 'if') {
        const condition = selectedNode.config?.condition;
        if (condition && typeof condition === 'object') {
          return String(
            (condition as Record<string, unknown>).field || '',
          ).trim();
        }
      }
      if (
        ['qbittorrent', 'offline115', 'offline115_openapi'].includes(
          selectedNode.type,
        )
      ) {
        return String(selectedNode.config?.url || '').trim();
      }
      if (selectedNode.type === 'moviepilot_title_recognize') {
        return String(selectedNode.config?.input || '').trim();
      }
      if (selectedNode.type === 'rename115_openapi') {
        return String(selectedNode.config?.file_id || '').trim();
      }
      if (selectedNode.type === 'filmfusion_recognize') {
        return String(
          selectedNode.config?.recognition_mode === 'file'
            ? selectedNode.config?.tmdb_id || ''
            : selectedNode.config?.input || '',
        ).trim();
      }
      if (selectedNode.type === 'moviepilot_recognize') {
        return String(selectedNode.config?.tmdb_id || '').trim();
      }
      return '';
    })();
    if (configuredReference.startsWith('$item.')) {
      addReference({
        kind: 'item',
        name: configuredReference.slice('$item.'.length),
        value: configuredReference,
      });
    } else if (configuredReference.startsWith('$vars.')) {
      addReference({
        kind: 'variable',
        name: configuredReference.slice('$vars.'.length),
        value: configuredReference,
        preview: referencePreview(
          simulation?.variables[configuredReference.slice('$vars.'.length)],
        ),
      });
    } else if (configuredReference.startsWith('$nodes.')) {
      addReference({
        kind: 'node',
        name: configuredReference,
        value: configuredReference,
      });
    }

    return references;
  }, [
    edges,
    nodes,
    effectivePreviewFeed,
    previewItemIndex,
    sourceByID,
    sourceMapping,
    meta.sourceId,
    selectedNode,
    selectedNodeId,
    simulation?.variables,
    nodeProtocols,
  ]);
  const routingPlan = useMemo(
    () => buildFlowRoutingPlan(nodes, edges),
    [edges, nodes],
  );
  const variableSummaries = useMemo(
    () =>
      buildFlowNodeVariableSummaries(nodes, edges, nodeProtocols, {
        previews: simulation?.nodes,
        triggerFields:
          effectivePreviewFeed?.items[previewItemIndex]?.fields || undefined,
      }),
    [
      edges,
      effectivePreviewFeed,
      nodeProtocols,
      nodes,
      previewItemIndex,
      simulation,
    ],
  );
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          preview: simulation?.nodes[node.id],
          targetHandles: routingPlan.targetHandles.get(node.id),
          variableSummary: variableSummaries.get(node.id),
          openVariablePanel,
        },
      })),
    [nodes, openVariablePanel, routingPlan, simulation, variableSummaries],
  );
  const variablePanelNode = useMemo(
    () =>
      nodes.find((node) => node.id === variablePanel?.nodeId)?.data.definition,
    [nodes, variablePanel?.nodeId],
  );
  const variablePanelSummary = variablePanel
    ? variableSummaries.get(variablePanel.nodeId)
    : undefined;
  const displayEdges = useMemo<RSSFlowEdge[]>(() => {
    const active = new Set(simulation?.activeEdgeIds || []);
    return edges.map((edge) => {
      const route = routingPlan.routes.get(edge.id);
      const isActive = active.has(edge.id);
      return {
        ...edge,
        type: 'workflow',
        label: undefined,
        targetHandle: route?.targetHandle || edge.targetHandle,
        data: {
          ...edge.data,
          laneOffset: route?.laneOffset || 0,
        },
        ...(simulation
          ? {
              animated: isActive,
              style: {
                ...edge.style,
                opacity: isActive ? 1 : 0.22,
                stroke: isActive ? '#16a34a' : '#94a3b8',
                strokeWidth: isActive ? 2.4 : 1.2,
              },
            }
          : {}),
      };
    });
  }, [edges, routingPlan, simulation]);

  const isValidConnection = useCallback(
    (connection: Connection | RSSFlowEdge) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        connection.source === connection.target
      ) {
        return false;
      }
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);
      if (!source || !target) return false;
      if (source.data.definition.type === 'end') return false;
      if (target.data.definition.type === 'trigger') return false;
      if (
        !['join', 'end'].includes(target.data.definition.type) &&
        edges.some((edge) => edge.target === connection.target)
      ) {
        return false;
      }
      if (
        edges.some(
          (edge) =>
            edge.source === connection.source &&
            edge.sourceHandle === connection.sourceHandle,
        )
      ) {
        return false;
      }

      const outgoing = new Map<string, string[]>();
      for (const edge of edges) {
        outgoing.set(edge.source, [
          ...(outgoing.get(edge.source) || []),
          edge.target,
        ]);
      }
      outgoing.set(connection.source, [
        ...(outgoing.get(connection.source) || []),
        connection.target,
      ]);
      const queue = [connection.target];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const current = queue.shift() as string;
        if (current === connection.source) return false;
        if (visited.has(current)) continue;
        visited.add(current);
        queue.push(...(outgoing.get(current) || []));
      }
      return true;
    },
    [edges, nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection) || !connection.sourceHandle) {
        messageApi.warning('该连接会形成循环、重复出口或非法入口');
        return;
      }
      const definition = {
        id: `edge_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        source: connection.source,
        source_port: connection.sourceHandle,
        target: connection.target,
        target_port: normalizeFlowTargetHandle(connection.targetHandle),
      };
      const sourceDefinition = nodes.find(
        (node) => node.id === connection.source,
      )?.data.definition;
      setEdges((current) => [
        ...current,
        edgeDefinitionToFlowEdge(definition, sourceDefinition),
      ]);
      setValidation(undefined);
    },
    [isValidConnection, messageApi, nodes, setEdges],
  );

  const addNode = (type: RSSAutomationNodeType) => {
    const index = nodes.length;
    const definition = createNodeDefinition(type, {
      x: 250 + (index % 3) * 280,
      y: 80 + Math.floor(index / 3) * 150,
    });
    setNodes((current) => [
      ...current,
      {
        id: definition.id,
        type: 'rssAutomationNode',
        position: definition.position,
        deletable: false,
        data: { definition },
      },
    ]);
    setSelectedNodeId(definition.id);
    setValidation(undefined);
  };

  const updateNode = (definition: RSSAutomationNodeDefinition) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === definition.id
          ? { ...node, data: { ...node.data, definition } }
          : node,
      ),
    );
    if (definition.type === 'parallel') {
      const branches = new Set(nodeBranches(definition));
      const removedEdgeIds = new Set(
        edges
          .filter(
            (edge) =>
              edge.source === definition.id &&
              !branches.has(edge.sourceHandle || ''),
          )
          .map((edge) => edge.id),
      );
      setEdges((current) =>
        current.filter((edge) => !removedEdgeIds.has(edge.id)),
      );
      if (selectedEdgeId && removedEdgeIds.has(selectedEdgeId)) {
        setSelectedEdgeId(undefined);
      }
      if (removedEdgeIds.size > 0) {
        messageApi.info('已移除不再存在的并行分支连线');
      }
    }
    if (definition.type === 'switch') {
      const validPorts = new Set(
        (Array.isArray(definition.config?.cases) ? definition.config.cases : [])
          .filter(
            (candidate): candidate is Record<string, unknown> =>
              Boolean(candidate) &&
              typeof candidate === 'object' &&
              !Array.isArray(candidate),
          )
          .map(
            (candidate) => `case-${String(candidate.id || '').toLowerCase()}`,
          )
          .concat(['default', 'failure']),
      );
      const removedEdgeIds = new Set(
        edges
          .filter(
            (edge) =>
              edge.source === definition.id &&
              !validPorts.has(edge.sourceHandle || ''),
          )
          .map((edge) => edge.id),
      );
      setEdges((current) =>
        current.filter((edge) => !removedEdgeIds.has(edge.id)),
      );
      if (selectedEdgeId && removedEdgeIds.has(selectedEdgeId)) {
        setSelectedEdgeId(undefined);
      }
      if (removedEdgeIds.size > 0) {
        messageApi.info('已移除不再存在的多路分支连线');
      }
    }
    if (definition.type === 'join' && !joinHasConditionalOutcome(definition)) {
      const removedEdgeIds = new Set(
        edges
          .filter(
            (edge) =>
              edge.source === definition.id && edge.sourceHandle === 'failure',
          )
          .map((edge) => edge.id),
      );
      setEdges((current) =>
        current.filter((edge) => !removedEdgeIds.has(edge.id)),
      );
      if (selectedEdgeId && removedEdgeIds.has(selectedEdgeId)) {
        setSelectedEdgeId(undefined);
      }
      if (removedEdgeIds.size > 0) {
        messageApi.info('完成型汇合只有“继续”出口，已移除旧的失败连线');
      }
    }
    setValidation(undefined);
  };

  const deleteNode = (definition: RSSAutomationNodeDefinition) => {
    if (definition.type === 'trigger') {
      messageApi.warning('流程必须保留一个 RSS 触发器');
      return;
    }
    if (
      definition.type === 'end' &&
      nodes.filter((node) => node.data.definition.type === 'end').length <= 1
    ) {
      messageApi.warning('流程至少需要一个结束节点');
      return;
    }
    setNodes((current) => current.filter((node) => node.id !== definition.id));
    setEdges((current) =>
      current.filter(
        (edge) =>
          edge.source !== definition.id && edge.target !== definition.id,
      ),
    );
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
    setVariablePanel((current) =>
      current?.nodeId === definition.id ? undefined : current,
    );
    setValidation(undefined);
  };

  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(undefined);
    setValidation(undefined);
  };

  const currentDefinition = useCallback(
    () => previewDefinition,
    [previewDefinition],
  );

  const check = async () => {
    try {
      const response = await validateRSSAutomationWorkflow(currentDefinition());
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '流程校验失败');
      }
      setValidation(response.data);
      if (response.data.valid) messageApi.success('流程结构校验通过');
      else messageApi.warning(`发现 ${response.data.errors.length} 个问题`);
      return response.data;
    } catch (error: any) {
      messageApi.error(error?.message || '流程校验失败');
      return undefined;
    }
  };

  const save = async () => {
    if (!meta.id) {
      messageApi.warning('请先通过向导创建 RSS 自动化');
      return;
    }
    if (!meta.name.trim()) {
      messageApi.warning('请输入流程名称');
      return;
    }
    setSaving(true);
    try {
      const validationResult = await check();
      if (!validationResult?.valid) return;
      const input = {
        source_id: meta.sourceId,
        name: meta.name.trim(),
        description: meta.description.trim(),
        enabled: meta.enabled,
        definition: currentDefinition(),
      };
      const response = await updateRSSAutomationWorkflow(meta.id, input);
      if (response.code !== 0 || !response.data?.workflow) {
        throw new Error(response.message || '保存流程失败');
      }
      setMeta((current) => ({
        ...current,
        id: response.data?.workflow.id,
        version: response.data?.workflow.version,
      }));
      messageApi.success('流程已保存');
      await onChanged();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '保存流程失败');
    } finally {
      setSaving(false);
    }
  };

  const continueWizard = async () => {
    setSaving(true);
    try {
      const validationResult = await check();
      if (!validationResult?.valid) return;
      await onWizardNext?.(currentDefinition());
    } finally {
      setSaving(false);
    }
  };

  const autoLayout = async () => {
    setLayingOut(true);
    try {
      const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
      const elk = new ELK();
      const graph = await elk.layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.spacing.edgeEdge': '18',
          'elk.spacing.edgeNode': '24',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.edgeEdgeBetweenLayers': '18',
          'elk.layered.spacing.edgeNodeBetweenLayers': '24',
          'elk.layered.spacing.nodeNodeBetweenLayers': '150',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        },
        children: nodes.map((node) => ({
          id: node.id,
          width: FLOW_NODE_WIDTH,
          height: flowNodeHeight(
            node.data.definition,
            routingPlan.incomingCounts.get(node.id) || 0,
          ),
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      });
      const positions = new Map(
        graph.children?.map((child) => [
          child.id,
          { x: child.x || 0, y: child.y || 0 },
        ]),
      );
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          position: positions.get(node.id) || node.position,
        })),
      );
      window.setTimeout(() =>
        instanceRef.current?.fitView({
          ...FLOW_FIT_VIEW_OPTIONS,
          duration: 240,
        }),
      );
    } catch (error: any) {
      messageApi.error(error?.message || '自动排版失败');
    } finally {
      setLayingOut(false);
    }
  };

  const applyWizardTemplate = (templateKey: string) => {
    const template = wizardTemplates.find((item) => item.key === templateKey);
    if (!template) return;
    loadDefinition(template.definition());
    messageApi.success(`已载入“${template.label}”起点，可继续修改`);
  };

  const exportWorkflow = () => {
    try {
      const workflowPackage = createWorkflowTransferPackage(
        currentDefinition(),
        meta.name,
      );
      const content = JSON.stringify(workflowPackage, null, 2);
      const url = URL.createObjectURL(
        new Blob([content], { type: 'application/json;charset=utf-8' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = workflowTransferFileName(workflowPackage.name);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      messageApi.success('流程文件已导出，可直接分享给其他用户');
    } catch (error: any) {
      messageApi.error(error?.message || '流程导出失败');
    }
  };

  const readImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > RSS_WORKFLOW_TRANSFER_MAX_BYTES) {
      messageApi.error('流程文件不能超过 1 MB');
      return;
    }
    try {
      const imported = parseWorkflowTransferText(await file.text());
      setPendingImport({ ...imported, fileName: file.name });
    } catch (error: any) {
      messageApi.error(error?.message || '无法读取这个流程文件');
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    loadDefinition(pendingImport.definition);
    const requirements = bindingRequirements(pendingImport.requirements);
    setPendingImport(undefined);
    if (requirements.length > 0) {
      messageApi.warning(`流程已导入，请重新选择${requirements.join('、')}`);
    } else {
      messageApi.success('流程已导入，可继续修改和预览');
    }
  };

  if (mode === 'manage' && workflows.length === 0) {
    return (
      <Card loading={loading}>
        {contextHolder}
        <Empty
          description="还没有 RSS 自动化。RSS 源和流程需要通过向导一起创建。"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button icon={<PlusOutlined />} onClick={onCreate} type="primary">
            新建自动化
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <div
      className={`${styles.workflowShell} ${
        mode === 'wizard' ? styles.workflowShellWizard : ''
      } ${
        mode === 'manage' && !showWorkflowList ? styles.workflowShellSingle : ''
      }`}
    >
      {contextHolder}
      <input
        accept=".json,application/json"
        hidden
        onChange={readImportFile}
        ref={importFileRef}
        type="file"
      />
      {mode === 'manage' && showWorkflowList && (
        <aside className={styles.workflowList}>
          <div className={styles.panelHeading}>
            <div>
              <Text type="secondary">一个 RSS，一个流程</Text>
              <Title level={5}>RSS 自动化</Title>
            </div>
          </div>
          <List
            dataSource={workflows}
            locale={{
              emptyText: (
                <Empty
                  description="还没有流程"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            renderItem={(workflow) => (
              <List.Item
                className={`${styles.workflowListItem} ${
                  workflow.id === meta.id ? styles.workflowListItemActive : ''
                }`}
                onClick={() => selectWorkflow(workflow)}
              >
                <div>
                  <Text strong>{workflow.name}</Text>
                  <div className={styles.workflowListMeta}>
                    <Text
                      className={styles.workflowSourceName}
                      type="secondary"
                    >
                      {sourceByID.get(workflow.source_id)?.name ||
                        'RSS 源不存在'}
                    </Text>
                    <Tag color={workflow.enabled ? 'success' : 'default'}>
                      {workflow.enabled ? '已启用' : '草稿'}
                    </Tag>
                    <Text type="secondary">v{workflow.version}</Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </aside>
      )}

      <section className={styles.workflowMain}>
        {mode === 'manage' && (
          <Card className={styles.workflowMetaCard} size="small">
            <div className={styles.workflowMetaGrid}>
              <Input
                onChange={(event) =>
                  setMeta((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="流程名称"
                value={meta.name}
              />
              <Input
                prefix="RSS"
                readOnly
                value={sourceByID.get(meta.sourceId)?.name || 'RSS 源已不存在'}
              />
              <Space>
                <Switch
                  checked={meta.enabled}
                  onChange={(enabled) =>
                    setMeta((current) => ({ ...current, enabled }))
                  }
                />
                <Text>{meta.enabled ? '启用' : '保存为草稿'}</Text>
                {meta.version && <Tag>v{meta.version}</Tag>}
              </Space>
            </div>
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 3 }}
              onChange={(event) =>
                setMeta((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="说明这个流程会筛选什么、执行什么"
              value={meta.description}
            />
          </Card>
        )}

        {validation && !validation.valid && (
          <Alert
            closable={{ onClose: () => setValidation(undefined) }}
            description={
              <ul className={styles.validationList}>
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            }
            title="流程还不能保存"
            showIcon
            type="error"
          />
        )}

        <div
          className={mode === 'wizard' ? styles.wizardDesignerGrid : undefined}
        >
          <div className={styles.flowWorkspace}>
            <div className={styles.flowSpin}>
              <Spin spinning={layingOut}>
                <ReactFlow<RSSFlowNode, RSSFlowEdge>
                  colorMode="light"
                  deleteKeyCode={['Backspace', 'Delete']}
                  edgeTypes={edgeTypes}
                  edges={displayEdges}
                  fitView
                  fitViewOptions={FLOW_FIT_VIEW_OPTIONS}
                  isValidConnection={isValidConnection}
                  maxZoom={1.6}
                  minZoom={0.2}
                  nodeTypes={nodeTypes}
                  nodes={displayNodes}
                  onConnect={onConnect}
                  onEdgeClick={(_, edge) => {
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(undefined);
                  }}
                  onEdgesDelete={() => {
                    setSelectedEdgeId(undefined);
                    setValidation(undefined);
                  }}
                  onEdgesChange={(changes) => {
                    onEdgesChange(changes);
                    setValidation(undefined);
                  }}
                  onInit={(instance) => {
                    instanceRef.current = instance;
                  }}
                  onMoveEnd={(_, nextViewport) =>
                    setViewportState(nextViewport)
                  }
                  onNodeClick={(_, node) => {
                    setVariablePanel(undefined);
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(undefined);
                  }}
                  onNodesChange={(changes) => {
                    onNodesChange(changes);
                    setValidation(undefined);
                  }}
                  onPaneClick={() => {
                    setSelectedEdgeId(undefined);
                    setSelectedNodeId(undefined);
                  }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={22} size={1} />
                  <Panel
                    className={styles.flowCanvasPrimary}
                    position="top-left"
                  >
                    {mode === 'wizard' && (
                      <Tooltip title="选择模板会替换当前画板，载入后仍可继续修改">
                        <Dropdown
                          menu={{
                            items: wizardTemplates.map((template) => ({
                              key: template.key,
                              label: template.label,
                            })),
                            onClick: ({ key }) => applyWizardTemplate(key),
                          }}
                          placement="bottomLeft"
                          trigger={['click']}
                        >
                          <Button
                            aria-label="流程模板"
                            icon={<ThunderboltOutlined />}
                          >
                            流程模板
                          </Button>
                        </Dropdown>
                      </Tooltip>
                    )}
                    <Button
                      aria-label="添加节点"
                      icon={<PlusOutlined />}
                      onClick={() => setNodePickerOpen(true)}
                    >
                      添加节点
                    </Button>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'import',
                            icon: <ImportOutlined />,
                            label: '导入流程',
                          },
                          {
                            key: 'export',
                            icon: <ExportOutlined />,
                            label: '导出流程',
                          },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'import') importFileRef.current?.click();
                          if (key === 'export') exportWorkflow();
                        },
                      }}
                      placement="bottomLeft"
                      trigger={['click']}
                    >
                      <Button
                        aria-label="导入或导出流程"
                        icon={<ExportOutlined />}
                      >
                        导入 / 导出
                      </Button>
                    </Dropdown>
                    {((mode === 'wizard' &&
                      effectivePreviewFeed &&
                      simulation) ||
                      (mode === 'manage' && meta.sourceId > 0)) && (
                      <Tooltip
                        title={
                          mode === 'manage'
                            ? selectedPreviewFeed
                              ? '重新选择一个已有 RSS 条目并预览当前流程'
                              : '选择一个已有 RSS 条目并预览当前流程'
                            : '用真实 RSS 条目模拟当前流程，不会执行任何动作'
                        }
                      >
                        <Button
                          aria-label="RSS 条目预览"
                          icon={<EyeOutlined />}
                          onClick={() => {
                            if (mode === 'manage') {
                              setEntryPickerOpen(true);
                              return;
                            }
                            setPreviewOpen(true);
                          }}
                        >
                          {mode === 'manage'
                            ? selectedPreviewFeed
                              ? '重新选择 RSS 条目'
                              : '选择 RSS 条目'
                            : `RSS 条目预览 (${effectivePreviewFeed?.items.length || 0})`}
                        </Button>
                      </Tooltip>
                    )}
                  </Panel>
                  <Panel
                    className={styles.flowCanvasActions}
                    position="top-right"
                  >
                    <Tooltip title="自动排版">
                      <Button
                        aria-label="自动排版"
                        icon={<ApartmentOutlined />}
                        loading={layingOut}
                        onClick={autoLayout}
                      />
                    </Tooltip>
                    <Tooltip title="校验流程">
                      <Button
                        aria-label="校验流程"
                        icon={<CheckCircleOutlined />}
                        onClick={check}
                      />
                    </Tooltip>
                    <Tooltip title="居中显示">
                      <Button
                        aria-label="居中显示"
                        icon={<AimOutlined />}
                        onClick={() =>
                          instanceRef.current?.fitView({
                            ...FLOW_FIT_VIEW_OPTIONS,
                            duration: 240,
                          })
                        }
                      />
                    </Tooltip>
                    <span className={styles.flowCanvasDivider} />
                    {mode === 'manage' ? (
                      <Button
                        aria-label="保存流程"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={save}
                        type="primary"
                      >
                        保存流程
                      </Button>
                    ) : (
                      <>
                        <Tooltip title="上一步">
                          <Button
                            aria-label="上一步"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => onWizardBack?.(currentDefinition())}
                          />
                        </Tooltip>
                        <Tooltip title="下一步">
                          <Button
                            aria-label="下一步"
                            icon={<ArrowRightOutlined />}
                            loading={saving}
                            onClick={continueWizard}
                            type="primary"
                          />
                        </Tooltip>
                      </>
                    )}
                    {selectedEdgeId && (
                      <Tooltip title="删除连线">
                        <Button
                          aria-label="删除连线"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={deleteSelectedEdge}
                        />
                      </Tooltip>
                    )}
                  </Panel>
                  <MiniMap pannable zoomable />
                  <Controls />
                </ReactFlow>
              </Spin>
            </div>
          </div>
        </div>
      </section>

      <Modal
        afterOpenChange={(open) => {
          if (!open) return;
          const modalBody =
            nodePickerContentRef.current?.closest('.ant-modal-body');
          if (modalBody instanceof HTMLElement) modalBody.scrollTop = 0;
        }}
        centered
        className={styles.nodePickerModal}
        destroyOnHidden
        footer={null}
        onCancel={() => setNodePickerOpen(false)}
        open={nodePickerOpen}
        title={
          <Space>
            <PlusOutlined />
            <span>添加节点</span>
          </Space>
        }
        width="min(900px, 94vw)"
      >
        <Text className={styles.nodePickerIntro} type="secondary">
          按用途选择节点，添加后将直接打开节点配置。
        </Text>
        <div className={styles.nodePickerGroups} ref={nodePickerContentRef}>
          {NODE_PALETTE_COLUMNS.map((groups) => (
            <div className={styles.nodePickerColumn} key={groups[0].title}>
              {groups.map((group) => {
                const headingID = `node-picker-${group.types[0]}`;
                return (
                  <section
                    aria-labelledby={headingID}
                    className={styles.nodePickerGroup}
                    key={group.title}
                  >
                    <h3 className={styles.nodePickerGroupTitle} id={headingID}>
                      {group.title}
                    </h3>
                    <div className={styles.nodePickerOptions}>
                      {group.types.map((type) => (
                        <Button
                          className={styles.nodePickerOption}
                          key={type}
                          onClick={() => {
                            setNodePickerOpen(false);
                            addNode(type);
                          }}
                        >
                          {NODE_LABELS[type]}
                        </Button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        centered
        destroyOnHidden
        footer={null}
        onCancel={() => setEntryPickerOpen(false)}
        open={entryPickerOpen}
        title="选择 RSS 条目"
        width="min(1180px, 96vw)"
      >
        {meta.sourceId > 0 && (
          <EntryHistoryPanel
            fixedSourceId={meta.sourceId}
            onPreviewEntry={previewEntry}
            sources={sources}
          />
        )}
      </Modal>

      <Modal
        centered
        className={styles.samplePreviewModal}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        open={previewOpen}
        title={
          <Space>
            <EyeOutlined />
            <span>RSS 条目预览</span>
            <Tooltip title="不会触发下载或其他执行动作">
              <Tag className={styles.previewModeTag} color="blue">
                仅预览
              </Tag>
            </Tooltip>
          </Space>
        }
        width={720}
      >
        {effectivePreviewFeed && simulation && (
          <SamplePreviewPanel
            definition={previewDefinition}
            feed={effectivePreviewFeed}
            itemIndex={previewItemIndex}
            onItemChange={setPreviewItemIndex}
            preview={simulation}
          />
        )}
      </Modal>

      <Modal
        centered
        cancelText="取消"
        okText="替换当前画板"
        onCancel={() => setPendingImport(undefined)}
        onOk={confirmImport}
        open={Boolean(pendingImport)}
        title="导入流程"
        width={560}
      >
        {pendingImport && (
          <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            <div>
              <Text strong>{pendingImport.name}</Text>
              <br />
              <Text type="secondary">{pendingImport.fileName}</Text>
            </div>
            <Space wrap>
              <Tag color="blue">
                {pendingImport.definition.nodes.length} 个节点
              </Tag>
              <Tag color="blue">
                {pendingImport.definition.edges.length} 条连线
              </Tag>
              {pendingImport.source === 'bare-definition' && (
                <Tag>兼容旧格式</Tag>
              )}
            </Space>
            <Alert
              description="导入只替换当前画板，不会更改正在配置的 RSS 链接；保存或进入下一步之前仍可继续修改。"
              title="当前画板会被替换"
              showIcon
              type="warning"
            />
            {bindingRequirements(pendingImport.requirements).length > 0 && (
              <Alert
                description={`导入后请重新选择：${bindingRequirements(
                  pendingImport.requirements,
                ).join('、')}。本地目标、账号和目录不会包含在分享文件中。`}
                title="需要重新绑定本地配置"
                showIcon
                type="info"
              />
            )}
          </Space>
        )}
      </Modal>

      <NodeConfigModal
        cloudDirectories={cloudDirectories}
        cloudStorages={cloudStorages}
        fieldReferences={fieldReferences}
        node={selectedNode}
        nodeProtocol={nodeProtocols.find(
          (protocol) => protocol.type === selectedNode?.type,
        )}
        onChange={updateNode}
        onClose={() => setSelectedNodeId(undefined)}
        onDelete={deleteNode}
        preview={selectedNodeId ? simulation?.nodes[selectedNodeId] : undefined}
        targets={targets}
      />
      <NodeVariableDrawer
        node={variablePanelNode}
        onClose={() => setVariablePanel(undefined)}
        open={Boolean(
          variablePanel && variablePanelNode && variablePanelSummary,
        )}
        summary={variablePanelSummary}
        view={variablePanel?.view || 'received'}
      />
    </div>
  );
};

const WorkflowPanel = (props: WorkflowPanelProps) => (
  <ReactFlowProvider>
    <WorkflowPanelInner {...props} />
  </ReactFlowProvider>
);

export default WorkflowPanel;
