import type {
  RSSAutomationDefinition,
  RSSAutomationNodeDefinition,
  RSSAutomationValidationResult,
} from '@/services/film-fusion';
import { NODE_LABELS } from './flow';

const validationPatternEscape = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validationNodeName = (node: RSSAutomationNodeDefinition) =>
  node.name?.trim() || NODE_LABELS[node.type] || node.id;

const validationNodeLabel = (node: RSSAutomationNodeDefinition) =>
  `“${validationNodeName(node)}”`;

const replaceValidationIdentifier = (
  message: string,
  identifier: string,
  label: string,
) => {
  if (!identifier) return message;
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_-])${validationPatternEscape(identifier)}(?=$|[^A-Za-z0-9_-])`,
    'g',
  );
  return message.replace(pattern, (_, prefix: string) => `${prefix}${label}`);
};

const humanizeValidationMessage = (
  rawMessage: string,
  definition: RSSAutomationDefinition,
) => {
  const nodesByID = new Map(
    definition.nodes.map((node) => [node.id, node] as const),
  );
  let message = rawMessage;

  for (const edge of [...definition.edges].sort(
    (left, right) => right.id.length - left.id.length,
  )) {
    const source = nodesByID.get(edge.source);
    const target = nodesByID.get(edge.target);
    if (source) {
      message = message.replace(
        `不适用于 ${source.type} 节点`,
        `不适用于节点 ${validationNodeLabel(source)}`,
      );
    }
    if (source && target) {
      message = replaceValidationIdentifier(
        message,
        edge.id,
        `${validationNodeLabel(source)} → ${validationNodeLabel(target)}`,
      );
    }
  }

  for (const node of [...definition.nodes].sort(
    (left, right) => right.id.length - left.id.length,
  )) {
    message = replaceValidationIdentifier(
      message,
      node.id,
      validationNodeLabel(node),
    );
  }
  return message;
};

export const humanizeRSSAutomationValidation = (
  validation: RSSAutomationValidationResult,
  definition: RSSAutomationDefinition,
): RSSAutomationValidationResult => ({
  ...validation,
  errors: validation.errors.map((message) =>
    humanizeValidationMessage(message, definition),
  ),
  warnings: validation.warnings.map((message) =>
    humanizeValidationMessage(message, definition),
  ),
});
