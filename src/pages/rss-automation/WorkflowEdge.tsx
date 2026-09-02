import { BaseEdge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import type { RSSFlowEdge } from './flow';

const WorkflowEdge = ({
  id,
  data,
  markerEnd,
  markerStart,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<RSSFlowEdge>) => {
  const laneOffset = Number(data?.laneOffset || 0);
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    centerX: (sourceX + targetX) / 2 + laneOffset,
    offset: 18,
  });
  const configuredStrokeWidth = Number(style?.strokeWidth || 1.5);
  const strokeWidth = Number.isFinite(configuredStrokeWidth)
    ? configuredStrokeWidth
    : 1.5;

  return (
    <BaseEdge
      id={id}
      interactionWidth={18}
      markerEnd={markerEnd}
      markerStart={markerStart}
      path={path}
      style={{
        ...style,
        stroke: selected ? '#1677ff' : style?.stroke || '#94a3b8',
        strokeWidth: selected ? Math.max(strokeWidth, 2.2) : strokeWidth,
        transition: 'opacity 160ms ease, stroke 160ms ease',
      }}
    />
  );
};

export default WorkflowEdge;
