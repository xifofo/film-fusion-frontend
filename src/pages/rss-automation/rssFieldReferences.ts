import type { RSSAutomationMapping } from '@/services/film-fusion';
import { DEFAULT_RSS_AUTOMATION_MAPPING } from '@/services/film-fusion';
import type { NodeFieldReference } from './NodeConfigDrawer';

const referencePreview = (value: unknown) => {
  if (value == null || value === '') return undefined;
  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value).trim();
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
};

export const parseRSSSourceMapping = (
  raw?: string,
): RSSAutomationMapping | undefined => {
  try {
    const mapping = JSON.parse(raw || '') as RSSAutomationMapping;
    return Array.isArray(mapping?.fields) && mapping.fields.length > 0
      ? mapping
      : undefined;
  } catch {
    return undefined;
  }
};

export const buildRSSItemReferences = (
  mapping: RSSAutomationMapping | undefined,
  sampleFields: Record<string, unknown>,
): NodeFieldReference[] => {
  const references: NodeFieldReference[] = [];
  const indexByValue = new Map<string, number>();
  const addReference = (reference: NodeFieldReference) => {
    const existingIndex = indexByValue.get(reference.value);
    if (existingIndex == null) {
      indexByValue.set(reference.value, references.length);
      references.push(reference);
      return;
    }
    const existing = references[existingIndex];
    references[existingIndex] = {
      ...existing,
      ...reference,
      dataType: reference.dataType ?? existing.dataType,
      description: reference.description ?? existing.description,
      preview: reference.preview ?? existing.preview,
    };
  };

  const configuredFields = mapping?.fields;
  const fields =
    configuredFields && configuredFields.length > 0
      ? configuredFields
      : DEFAULT_RSS_AUTOMATION_MAPPING.fields;
  for (const field of fields) {
    const name = String(field.name || '').trim();
    if (!name) continue;
    addReference({
      kind: 'item',
      name,
      value: `$item.${name}`,
      dataType: field.type || 'string',
      description: field.selector
        ? `RSS 源字段（${field.selector}）`
        : 'RSS 源字段',
    });
  }

  for (const [name, value] of Object.entries(sampleFields)) {
    addReference({
      kind: 'item',
      name,
      value: `$item.${name}`,
      preview: referencePreview(value),
    });
  }

  return references;
};
