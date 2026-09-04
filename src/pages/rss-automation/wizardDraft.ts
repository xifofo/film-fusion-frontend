import type {
  RSSAutomationDefinition,
  RSSAutomationParsedFeed,
  RSSAutomationSourceInput,
} from '@/services/film-fusion';

export const RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY =
  'film-fusion:rss-automation:wizard-draft:v1';

const RSS_AUTOMATION_WIZARD_DRAFT_VERSION = 1;

export type RSSAutomationWizardSourceValues = {
  feed_url: string;
  name?: string;
  interval_minutes: number;
  preset: 'auto' | 'rss' | 'atom';
};

export type RSSAutomationWizardPublishValues = {
  name: string;
  description?: string;
  enabled: boolean;
};

export type RSSAutomationWizardDraft = {
  version: typeof RSS_AUTOMATION_WIZARD_DRAFT_VERSION;
  savedAt: string;
  step: 0 | 1 | 2;
  sourceValues: Partial<RSSAutomationWizardSourceValues>;
  publishValues: Partial<RSSAutomationWizardPublishValues>;
  source?: RSSAutomationSourceInput;
  sample?: RSSAutomationParsedFeed;
  suggestedName: string;
  definition: RSSAutomationDefinition;
  selectedSample: number;
};

export type RSSAutomationWizardDraftInput = Omit<
  RSSAutomationWizardDraft,
  'version' | 'savedAt'
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPosition = (value: unknown) =>
  isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isNode = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  isPosition(value.position);

const isEdge = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.source === 'string' &&
  typeof value.source_port === 'string' &&
  typeof value.target === 'string' &&
  (value.target_port === undefined || typeof value.target_port === 'string');

const isViewport = (value: unknown) =>
  isRecord(value) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.zoom);

const isDefinition = (value: unknown): value is RSSAutomationDefinition =>
  isRecord(value) &&
  value.schema_version === 1 &&
  Array.isArray(value.nodes) &&
  value.nodes.every(isNode) &&
  Array.isArray(value.edges) &&
  value.edges.every(isEdge) &&
  (value.viewport === undefined || isViewport(value.viewport));

const isSource = (value: unknown): value is RSSAutomationSourceInput =>
  isRecord(value) &&
  typeof value.feed_url === 'string' &&
  typeof value.name === 'string' &&
  typeof value.interval_minutes === 'number' &&
  isRecord(value.mapping) &&
  Array.isArray(value.mapping.fields);

const isSample = (value: unknown): value is RSSAutomationParsedFeed =>
  isRecord(value) &&
  typeof value.title === 'string' &&
  Array.isArray(value.items) &&
  value.items.every(
    (item) =>
      isRecord(item) &&
      isRecord(item.fields) &&
      (item.errors === undefined ||
        (Array.isArray(item.errors) &&
          item.errors.every((error) => typeof error === 'string'))),
  );

const removeInvalidDraft = () => {
  try {
    window.localStorage.removeItem(RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

export const loadRSSAutomationWizardDraft = ():
  | RSSAutomationWizardDraft
  | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(
      RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY,
    );
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== RSS_AUTOMATION_WIZARD_DRAFT_VERSION ||
      typeof parsed.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.savedAt)) ||
      ![0, 1, 2].includes(Number(parsed.step)) ||
      !isRecord(parsed.sourceValues) ||
      !isRecord(parsed.publishValues) ||
      typeof parsed.suggestedName !== 'string' ||
      !isDefinition(parsed.definition) ||
      !Number.isInteger(parsed.selectedSample) ||
      Number(parsed.selectedSample) < 0 ||
      (parsed.source !== undefined && !isSource(parsed.source)) ||
      (parsed.sample !== undefined && !isSample(parsed.sample))
    ) {
      removeInvalidDraft();
      return undefined;
    }

    const source = parsed.source as RSSAutomationSourceInput | undefined;
    const sample = parsed.sample as RSSAutomationParsedFeed | undefined;
    const requestedStep = Number(parsed.step) as 0 | 1 | 2;
    const step = requestedStep > 0 && (!source || !sample) ? 0 : requestedStep;

    return {
      version: RSS_AUTOMATION_WIZARD_DRAFT_VERSION,
      savedAt: parsed.savedAt,
      step,
      sourceValues:
        parsed.sourceValues as Partial<RSSAutomationWizardSourceValues>,
      publishValues:
        parsed.publishValues as Partial<RSSAutomationWizardPublishValues>,
      source,
      sample,
      suggestedName: parsed.suggestedName,
      definition: parsed.definition,
      selectedSample: Math.min(
        Number(parsed.selectedSample),
        Math.max(0, (sample?.items.length || 1) - 1),
      ),
    };
  } catch {
    removeInvalidDraft();
    return undefined;
  }
};

export const saveRSSAutomationWizardDraft = (
  input: RSSAutomationWizardDraftInput,
): RSSAutomationWizardDraft => {
  if (typeof window === 'undefined') {
    throw new Error('当前环境无法保存本机草稿');
  }
  const draft: RSSAutomationWizardDraft = {
    ...input,
    version: RSS_AUTOMATION_WIZARD_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY,
    JSON.stringify(draft),
  );
  return draft;
};

export const clearRSSAutomationWizardDraft = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY);
  } catch {
    // Clearing a non-critical local draft must not block a successful publish.
  }
};
