import type { CampaignFlow, CampaignEdge } from './api';

export const messageBranches = [
  { key: 'SEEN', label: 'Seen', color: '#16a34a' },
  { key: 'NOT_SEEN', label: 'Unseen / delivered', color: '#d97706' },
] as const;
export function branchLabel(branchKey: string) {
  return messageBranches.find((branch) => branch.key === branchKey)?.label ?? branchKey;
}
export function branchColor(branchKey: string) {
  return messageBranches.find((branch) => branch.key === branchKey)?.color ?? '#64748b';
}
// Handle IDs are recovered from the persisted branch, so save/reload does not
// require separate canvas-only handle columns in campaignEdges.
export function campaignEdgeToCanvas(edge: CampaignEdge) {
  // Former default/custom next-message routes use the regular, unread path.
  // Keep every edge so conflicting old routes can be reviewed before saving.
  const branchKey = edge.branchKey === 'SEEN' ? 'SEEN' : 'NOT_SEEN';
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: branchKey,
    targetHandle: 'incoming',
    label: branchLabel(branchKey),
    data: { branchKey },
  };
}
export function canConnectBranch(
  edges: { source: string; data?: { branchKey: string } }[],
  source: string | null,
  target: string | null,
  branchKey: string | null | undefined,
) {
  return (
    !!source &&
    !!target &&
    source !== target &&
    messageBranches.some((branch) => branch.key === branchKey) &&
    !edges.some((edge) => edge.source === source && edge.data?.branchKey === branchKey)
  );
}

export type DelayUnit = 'minute' | 'hour' | 'day';
export function durationToMinutes(amount: number, unit: DelayUnit): number {
  const multiplier = { minute: 1, hour: 60, day: 1440 }[unit];
  const result = amount * multiplier;
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2147483647)
    throw new Error('Delay must be a positive whole number of minutes');
  return result;
}
const minuteDelays = [1, 5, 10, 15, 30].map((value) => ({
  label: `${value} ${value === 1 ? 'minute' : 'minutes'}`,
  minutes: durationToMinutes(value, 'minute'),
}));
export const messageDelays = [
  ...minuteDelays,
  { label: '5 hours', minutes: durationToMinutes(5, 'hour') },
  { label: '12 hours', minutes: durationToMinutes(12, 'hour') },
  ...[1, 2, 3, 5, 7, 10].map((days) => ({
    label: `${days} ${days === 1 ? 'day' : 'days'}`,
    minutes: durationToMinutes(days, 'day'),
  })),
];
export const seenDelays = [
  ...minuteDelays,
  ...[1, 5, 8, 12].map((hours) => ({
    label: `${hours} ${hours === 1 ? 'hour' : 'hours'}`,
    minutes: durationToMinutes(hours, 'hour'),
  })),
  ...[1, 2, 3].map((days) => ({
    label: `${days} ${days === 1 ? 'day' : 'days'}`,
    minutes: durationToMinutes(days, 'day'),
  })),
];
export function delayLabel(minutes: number | null) {
  return (
    [...messageDelays, ...seenDelays].find((item) => item.minutes === minutes)?.label ??
    `${minutes ?? 0} minutes`
  );
}
export function validateCampaignFlow(flow: CampaignFlow, templateIds: Set<string>): string | null {
  const keys = new Set<string>();
  for (const node of flow.nodes) {
    const name = node.label || node.nodeKey || 'Node';
    if (!node.messageTemplateId || !templateIds.has(node.messageTemplateId))
      return `${name}: select a saved template from this tenant`;
    if (!node.nodeKey.trim() || node.nodeKey.trim().length > 255 || keys.has(node.nodeKey.trim()))
      return `${name}: give each node a unique key`;
    keys.add(node.nodeKey.trim());
    if (!Number.isInteger(node.nextMessageDelayMinutes) || node.nextMessageDelayMinutes <= 0)
      return `${name}: select a next-message delay`;
    if (
      node.sendNextMessageOnSeen &&
      (!Number.isInteger(node.nextMessageSeekDelayMinutes) ||
        !node.nextMessageSeekDelayMinutes ||
        node.nextMessageSeekDelayMinutes <= 0 ||
        node.nextMessageSeekDelayMinutes >= node.nextMessageDelayMinutes)
    )
      return `${name}: select a seen delay shorter than the regular delay`;
  }
  if (flow.nodes.length && !flow.nodes.some((node) => node.id === flow.entryNodeId))
    return 'Select an entry node';
  const branches = new Set<string>();
  const ids = new Set(flow.nodes.map((node) => node.id));
  for (const edge of flow.edges) {
    if (!messageBranches.some((branch) => branch.key === edge.branchKey))
      return 'Connections must use the Seen or Unseen / delivered outcome';
    if (
      !ids.has(edge.sourceNodeId) ||
      !ids.has(edge.targetNodeId) ||
      edge.sourceNodeId === edge.targetNodeId
    )
      return 'Connect two different nodes from this workflow';
    const key = `${edge.sourceNodeId}:${edge.branchKey.trim()}`;
    if (!edge.branchKey.trim() || edge.branchKey.trim().length > 255 || branches.has(key))
      return 'Use a unique branch key for each connection from a node';
    branches.add(key);
  }
  return null;
}
