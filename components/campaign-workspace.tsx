'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeftIcon, PlusIcon, SaveIcon, Trash2Icon, WorkflowIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CampaignRuns } from '@/components/campaign-runs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  getCampaignFlow,
  saveCampaignFlow,
  listCampaignTemplates,
  type Campaign,
  type CampaignNode,
  type CampaignNodeType,
  type CampaignFlow,
  type MessageTemplate,
} from '@/lib/api';
import {
  messageDelays,
  seenDelays,
  delayLabel,
  validateCampaignFlow,
  messageBranches,
  branchLabel,
  branchColor,
  campaignEdgeToCanvas,
  canConnectBranch,
} from '@/lib/campaign-flow';

type MessageNode = Node<{ row: CampaignNode; entry: boolean; branchKeys?: string[] }, 'message'>;
type FlowEdge = Edge<{ branchKey: string }>;
type NodeActions = {
  templates: MessageTemplate[];
  patch: (id: string, changes: Partial<CampaignNode>) => void;
  busy: boolean;
};
const ActionsContext = createContext<NodeActions>({ templates: [], patch: () => {}, busy: false });
const nodeTypes = { message: MessageNodeCard };
const nodeTypesList: CampaignNodeType[] = ['SEND_TEMPLATE'];
const selectClass =
  'bg-background w-full min-w-0 rounded-md border px-2 py-2 text-sm disabled:opacity-60';

function DelayDropdown({
  id,
  value,
  seen = false,
  disabled,
  onChange,
}: {
  id: string;
  value: number | null;
  seen?: boolean;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const options = seen ? seenDelays : messageDelays;
  return (
    <select
      id={id}
      className={selectClass}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {value === null && <option value="">Select delay</option>}
      {value !== null && !options.some((item) => item.minutes === value) && (
        <option value={value}>{delayLabel(value)} (saved)</option>
      )}
      {options.map((item) => (
        <option key={item.minutes} value={item.minutes}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function MessageNodeCard({ id, data, selected, isConnectable }: NodeProps<MessageNode>) {
  const { templates, patch, busy } = useContext(ActionsContext);
  const row = data.row;
  const updateNodeInternals = useUpdateNodeInternals();
  const branches = messageBranches.map((branch) => branch.key);
  const handleSignature = JSON.stringify(branches);
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleSignature, row.sendNextMessageOnSeen, updateNodeInternals]);
  const missing = !templates.some((template) => template.id === row.messageTemplateId);
  return (
    <article
      className={`bg-card text-card-foreground w-72 rounded-xl border-2 shadow-md ${selected ? 'border-primary' : 'border-border'}`}
    >
      <Handle
        id="incoming"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        aria-label="Incoming connection"
        style={{ width: 12, height: 12 }}
      />
      <header className="bg-muted/50 flex items-center gap-2 rounded-t-lg border-b px-4 py-3">
        <WorkflowIcon className="text-primary size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{row.label || row.nodeKey}</p>
          <p className="text-muted-foreground text-[10px]">{row.nodeType.replaceAll('_', ' ')}</p>
        </div>
        {data.entry && (
          <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px]">
            Entry
          </span>
        )}
      </header>
      <div className="nodrag nopan space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor={`template-${id}`} className="text-xs">
            WhatsApp template <span className="text-destructive">*</span>
          </Label>
          <select
            id={`template-${id}`}
            className={selectClass}
            required
            value={row.messageTemplateId ?? ''}
            disabled={busy}
            onChange={(event) => patch(id, { messageTemplateId: event.target.value || null })}
          >
            <option value="">Select a template</option>
            {row.messageTemplateId && missing && (
              <option value={row.messageTemplateId}>Unavailable template — select another</option>
            )}
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {template.language} · {template.whatsappConnectId.slice(0, 8)}
              </option>
            ))}
          </select>
          {missing && <p className="text-destructive text-[11px]">A saved template is required.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`delay-${id}`} className="text-xs">
            Next message delay
          </Label>
          <DelayDropdown
            id={`delay-${id}`}
            value={row.nextMessageDelayMinutes}
            disabled={busy}
            onChange={(value) => patch(id, { nextMessageDelayMinutes: value })}
          />
        </div>
        <label
          className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium"
          htmlFor={`seen-${id}`}
        >
          Send message on seen
          <input
            id={`seen-${id}`}
            type="checkbox"
            role="switch"
            className="accent-primary size-4"
            checked={row.sendNextMessageOnSeen}
            disabled={busy}
            onChange={(event) =>
              patch(id, {
                sendNextMessageOnSeen: event.target.checked,
                nextMessageSeekDelayMinutes: event.target.checked
                  ? (row.nextMessageSeekDelayMinutes ?? 5)
                  : null,
              })
            }
          />
        </label>
        {row.sendNextMessageOnSeen && (
          <div className="space-y-1.5">
            <Label htmlFor={`seen-delay-${id}`} className="text-xs">
              Delay after seen
            </Label>
            <DelayDropdown
              id={`seen-delay-${id}`}
              value={row.nextMessageSeekDelayMinutes}
              seen
              disabled={busy}
              onChange={(value) => patch(id, { nextMessageSeekDelayMinutes: value })}
            />
            <p className="text-muted-foreground text-[11px]">
              The regular delay still applies if the message is unseen.
            </p>
          </div>
        )}
      </div>
      <footer className="nodrag nopan space-y-0 border-t py-2">
        {branches.map((branchKey) => (
          <div key={branchKey} className="relative flex h-9 items-center gap-2 px-4 text-xs">
            <Handle
              id={branchKey}
              type="source"
              position={Position.Right}
              isConnectable={isConnectable}
              aria-label={`${branchLabel(branchKey)} next message`}
              title={`Connect the ${branchLabel(branchKey).toLowerCase()} next message`}
              style={{
                width: 12,
                height: 12,
                background: branchColor(branchKey),
                right: -2,
                top: '50%',
              }}
            />
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: branchColor(branchKey) }}
            />
            <span>{branchLabel(branchKey)}</span>
            {branchKey === 'SEEN' && (
              <span className="text-muted-foreground ml-auto text-[10px]">
                {row.sendNextMessageOnSeen
                  ? delayLabel(row.nextMessageSeekDelayMinutes)
                  : data.branchKeys?.includes('SEEN')
                    ? 'Disabled'
                    : 'Connect to enable'}
              </span>
            )}
            {branchKey === 'NOT_SEEN' && (
              <span className="text-muted-foreground ml-auto text-[10px]">
                {delayLabel(row.nextMessageDelayMinutes)}
              </span>
            )}
          </div>
        ))}
      </footer>
    </article>
  );
}

function toNodes(flow: CampaignFlow): MessageNode[] {
  return flow.nodes.map((row, index) => ({
    id: row.id,
    type: 'message',
    position: { x: row.positionX ?? index * 360, y: row.positionY ?? 0 },
    data: { row, entry: flow.entryNodeId === row.id },
  }));
}
function toEdges(flow: CampaignFlow): FlowEdge[] {
  return flow.edges.map((edge) => ({
    ...campaignEdgeToCanvas(edge),
    style: { stroke: branchColor(edge.branchKey === 'SEEN' ? 'SEEN' : 'NOT_SEEN') },
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

export function CampaignWorkspace({
  tenant,
  campaign,
  onClose,
  onSaved,
}: {
  tenant: string;
  campaign: Campaign;
  onClose: () => void;
  onSaved: (entryNodeId: string | null, updatedAt: string) => void;
}) {
  const [nodes, setNodes] = useState<MessageNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [entryNodeId, setEntryNodeId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const selectedNode =
    selected?.type === 'node' ? nodes.find((node) => node.id === selected.id) : undefined;
  const selectedEdge =
    selected?.type === 'edge' ? edges.find((edge) => edge.id === selected.id) : undefined;

  useEffect(() => {
    let active = true;
    Promise.all([getCampaignFlow(tenant, campaign.id), listCampaignTemplates(tenant)])
      .then(([flow, savedTemplates]) => {
        if (!active) return;
        setNodes(toNodes(flow.data));
        setEdges(toEdges(flow.data));
        setTemplates(savedTemplates.data);
        setEntryNodeId(flow.data.entryNodeId);
        setUpdatedAt(flow.data.updatedAt);
        setDirty(
          flow.data.edges.some(
            (edge) => !messageBranches.some((branch) => branch.key === edge.branchKey),
          ),
        );
        setError('');
        setLoadError('');
        setSelected(null);
        setConfigDrafts({});
      })
      .catch((err: Error) => {
        if (active) setLoadError(err.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [tenant, campaign.id, reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patch = useCallback((id: string, changes: Partial<CampaignNode>) => {
    setNodes((previous) =>
      previous.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, row: { ...node.data.row, ...changes } } }
          : node,
      ),
    );
    setDirty(true);
    setError('');
  }, []);

  function changeNodes(changes: NodeChange<MessageNode>[]) {
    if (busy) return;
    setNodes((previous) => applyNodeChanges(changes, previous));
    const removed = new Set(
      changes.filter((change) => change.type === 'remove').map((change) => change.id),
    );
    if (removed.size) {
      setEdges((previous) =>
        previous.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
      );
      if (entryNodeId && removed.has(entryNodeId))
        setEntryNodeId(nodes.find((node) => !removed.has(node.id))?.id ?? null);
    }
    if (changes.some((change) => change.type === 'remove' || change.type === 'position'))
      setDirty(true);
  }
  function changeEdges(changes: EdgeChange<FlowEdge>[]) {
    if (busy) return;
    setEdges((previous) => applyEdgeChanges(changes, previous));
    if (changes.some((change) => change.type !== 'select')) setDirty(true);
  }
  function connect(connection: Connection) {
    const branchKey = connection.sourceHandle;
    if (
      busy ||
      !branchKey ||
      !canConnectBranch(edges, connection.source, connection.target, branchKey)
    )
      return;
    if (branchKey === 'SEEN') {
      const source = nodes.find((node) => node.id === connection.source)?.data.row;
      if (source && !source.sendNextMessageOnSeen)
        patch(connection.source, {
          sendNextMessageOnSeen: true,
          nextMessageSeekDelayMinutes: Math.min(5, Math.max(1, source.nextMessageDelayMinutes - 1)),
        });
    }
    setEdges((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        source: connection.source,
        target: connection.target,
        sourceHandle: branchKey,
        targetHandle: 'incoming',
        type: 'smoothstep',
        label: branchLabel(branchKey),
        style: { stroke: branchColor(branchKey) },
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { branchKey },
      },
    ]);
    setDirty(true);
  }
  function addNode() {
    const id = crypto.randomUUID();
    const used = new Set(nodes.map((node) => node.data.row.nodeKey));
    let index = nodes.length + 1;
    while (used.has(`message_${index}`)) index++;
    const row: CampaignNode = {
      id,
      nodeKey: `message_${index}`,
      nodeType: 'SEND_TEMPLATE',
      label: `Message ${index}`,
      config: {},
      messageTemplateId: null,
      sendNextMessageOnSeen: false,
      nextMessageSeekDelayMinutes: null,
      nextMessageDelayMinutes: 5 * 60,
      positionX: 0,
      positionY: 0,
    };
    const anchor = selectedNode ?? nodes[nodes.length - 1];
    setNodes((previous) => [
      ...previous,
      {
        id,
        type: 'message',
        position: { x: anchor ? anchor.position.x + 360 : 40, y: anchor?.position.y ?? 40 },
        data: { row, entry: !entryNodeId },
      },
    ]);
    if (!entryNodeId) setEntryNodeId(id);
    setSelected({ type: 'node', id });
    setDirty(true);
  }
  function reloadFlow() {
    if (dirty && !window.confirm('Discard unsaved workflow changes and reload?')) return;
    setLoaded(false);
    setReload((value) => value + 1);
  }
  async function save() {
    if (busy) return;
    const flow: CampaignFlow = {
      nodes: nodes.map((node) => ({
        ...node.data.row,
        positionX: Math.round(node.position.x),
        positionY: Math.round(node.position.y),
        nextMessageSeekDelayMinutes: node.data.row.sendNextMessageOnSeen
          ? node.data.row.nextMessageSeekDelayMinutes
          : null,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        branchKey: edge.data?.branchKey ?? 'NOT_SEEN',
      })),
      entryNodeId,
      updatedAt,
    };
    try {
      for (const node of flow.nodes) {
        if (configDrafts[node.id] === undefined) continue;
        const value: unknown = JSON.parse(configDrafts[node.id]);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error(`${node.label || node.nodeKey}: config must be a JSON object`);
        node.config = value as Record<string, unknown>;
      }
    } catch (err) {
      setError(
        err instanceof SyntaxError ? 'Node config contains invalid JSON' : (err as Error).message,
      );
      return;
    }
    const validation = validateCampaignFlow(
      flow,
      new Set(templates.map((template) => template.id)),
    );
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await saveCampaignFlow(tenant, campaign.id, flow);
      setNodes(toNodes(data));
      setEdges(toEdges(data));
      setEntryNodeId(data.entryNodeId);
      setUpdatedAt(data.updatedAt);
      setConfigDrafts({});
      setDirty(false);
      onSaved(data.entryNodeId, data.updatedAt);
      toast.success('Workflow saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function removeSelected() {
    if (!selected || busy) return;
    if (selected.type === 'node') changeNodes([{ id: selected.id, type: 'remove' }]);
    else changeEdges([{ id: selected.id, type: 'remove' }]);
    setSelected(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to campaigns"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm('Discard unsaved workflow changes?')) onClose();
            }}
          >
            <ArrowLeftIcon />
          </Button>
          <div>
            <h1 className="text-xl font-semibold break-all">{campaign.name}</h1>
            <p className="text-muted-foreground text-sm">
              Workflow workspace · {dirty ? 'Unsaved changes' : 'Saved'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || !loaded} onClick={reloadFlow}>
            Reload
          </Button>
          <Button
            variant="outline"
            disabled={busy || !loaded || !!loadError || nodes.length >= 500}
            onClick={addNode}
          >
            <PlusIcon />
            Add node
          </Button>
          <Button disabled={busy || !loaded || !!loadError || !dirty} onClick={save}>
            <SaveIcon />
            {busy ? 'Saving...' : 'Save workflow'}
          </Button>
        </div>
      </div>
      <CampaignRuns
        tenant={tenant}
        campaignId={campaign.id}
        disabled={busy || dirty || !loaded || !!loadError}
      />
      {error && (
        <p role="alert" className="text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      {!loaded ? (
        <p className="text-muted-foreground p-8 text-sm">Loading workflow and saved templates...</p>
      ) : loadError ? (
        <div role="alert" className="space-y-3 rounded-lg border p-6">
          <p className="text-destructive">{loadError}</p>
          <Button variant="outline" onClick={reloadFlow}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {!templates.length && (
            <p className="bg-muted rounded-lg p-3 text-sm">
              Create a WhatsApp template in this tenant before saving message nodes.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Drag nodes to arrange them. Connect a Seen or Unseen output on the right of a node to
            the incoming handle on the left of another. Select a node or connection to edit it.
            Changes are stored when you save.
          </p>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div
              className="bg-muted/20 relative h-[720px] min-w-0 overflow-hidden rounded-xl border"
              aria-label="Campaign workflow canvas"
            >
              <ActionsContext.Provider value={{ templates, patch, busy }}>
                <ReactFlow<MessageNode, FlowEdge>
                  nodes={nodes.map((node) => ({
                    ...node,
                    data: {
                      ...node.data,
                      entry: node.id === entryNodeId,
                      branchKeys: edges
                        .filter((edge) => edge.source === node.id)
                        .map((edge) => edge.data?.branchKey ?? 'NOT_SEEN'),
                    },
                  }))}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={changeNodes}
                  onEdgesChange={changeEdges}
                  onConnect={connect}
                  onNodeClick={(_, node) => setSelected({ type: 'node', id: node.id })}
                  onEdgeClick={(_, edge) => setSelected({ type: 'edge', id: edge.id })}
                  onPaneClick={() => setSelected(null)}
                  nodesDraggable={!busy}
                  nodesConnectable={!busy}
                  edgesReconnectable={false}
                  deleteKeyCode={busy ? null : ['Backspace', 'Delete']}
                  fitView
                  minZoom={0.15}
                  maxZoom={1.8}
                  snapToGrid
                  snapGrid={[10, 10]}
                  colorMode="system"
                  isValidConnection={(connection) =>
                    canConnectBranch(
                      edges,
                      connection.source,
                      connection.target,
                      connection.sourceHandle,
                    )
                  }
                >
                  <Background gap={20} size={1} />
                  <Controls />
                  <MiniMap pannable zoomable />
                </ReactFlow>
              </ActionsContext.Provider>
              {nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                  <div className="bg-background/90 max-w-sm space-y-2 rounded-xl border p-6 text-center">
                    <WorkflowIcon className="text-primary mx-auto size-8" />
                    <p className="font-semibold">Build your campaign flow</p>
                    <p className="text-muted-foreground text-sm">
                      Add a message node, choose a saved template, then connect your next message.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <aside className="bg-card space-y-4 rounded-xl border p-4">
              <h2 className="font-semibold">
                {selectedNode
                  ? 'Node settings'
                  : selectedEdge
                    ? 'Connection settings'
                    : 'Workflow settings'}
              </h2>
              <fieldset disabled={busy} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flow-entry">Entry node</Label>
                  <select
                    id="flow-entry"
                    className={selectClass}
                    value={entryNodeId ?? ''}
                    onChange={(event) => {
                      setEntryNodeId(event.target.value || null);
                      setDirty(true);
                    }}
                  >
                    <option value="">
                      {nodes.length ? 'Select entry node' : 'Add a node first'}
                    </option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.data.row.label || node.data.row.nodeKey}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedNode && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="node-label">Label</Label>
                      <Input
                        id="node-label"
                        maxLength={255}
                        value={selectedNode.data.row.label ?? ''}
                        onChange={(event) => patch(selectedNode.id, { label: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="node-key">Node key</Label>
                      <Input
                        id="node-key"
                        required
                        maxLength={255}
                        value={selectedNode.data.row.nodeKey}
                        onChange={(event) =>
                          patch(selectedNode.id, { nodeKey: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="node-type">Node type</Label>
                      <select
                        id="node-type"
                        className={selectClass}
                        value={selectedNode.data.row.nodeType}
                        onChange={(event) =>
                          patch(selectedNode.id, {
                            nodeType: event.target.value as CampaignNodeType,
                          })
                        }
                      >
                        {nodeTypesList.map((type) => (
                          <option key={type} value={type}>
                            {type.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="node-config">Config (JSON object)</Label>
                      <Textarea
                        id="node-config"
                        className="font-mono text-xs"
                        rows={8}
                        value={
                          configDrafts[selectedNode.id] ??
                          JSON.stringify(selectedNode.data.row.config, null, 2)
                        }
                        onChange={(event) => {
                          setConfigDrafts((previous) => ({
                            ...previous,
                            [selectedNode.id]: event.target.value,
                          }));
                          setDirty(true);
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Position: {Math.round(selectedNode.position.x)},{' '}
                      {Math.round(selectedNode.position.y)}
                    </p>
                  </>
                )}
                {selectedEdge && (
                  <>
                    <p className="text-muted-foreground text-sm">
                      {nodes.find((node) => node.id === selectedEdge.source)?.data.row.label ||
                        selectedEdge.source}{' '}
                      →{' '}
                      {nodes.find((node) => node.id === selectedEdge.target)?.data.row.label ||
                        selectedEdge.target}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="edge-branch">Message outcome</Label>
                      <select
                        id="edge-branch"
                        className={selectClass}
                        value={selectedEdge.data?.branchKey ?? 'NOT_SEEN'}
                        onChange={(event) => {
                          const branchKey = event.target.value;
                          if (
                            !canConnectBranch(
                              edges.filter((edge) => edge.id !== selectedEdge.id),
                              selectedEdge.source,
                              selectedEdge.target,
                              branchKey,
                            )
                          ) {
                            toast.error('This node already has a connection for that outcome');
                            return;
                          }
                          if (branchKey === 'SEEN') {
                            const source = nodes.find((node) => node.id === selectedEdge.source)
                              ?.data.row;
                            if (source && !source.sendNextMessageOnSeen)
                              patch(selectedEdge.source, {
                                sendNextMessageOnSeen: true,
                                nextMessageSeekDelayMinutes: Math.min(
                                  5,
                                  Math.max(1, source.nextMessageDelayMinutes - 1),
                                ),
                              });
                          }
                          setEdges((previous) =>
                            previous.map((edge) =>
                              edge.id === selectedEdge.id
                                ? {
                                    ...edge,
                                    sourceHandle: branchKey,
                                    label: branchLabel(branchKey),
                                    style: { stroke: branchColor(branchKey) },
                                    data: { branchKey },
                                  }
                                : edge,
                            ),
                          );
                          setDirty(true);
                        }}
                      >
                        {messageBranches.map((branch) => (
                          <option key={branch.key} value={branch.key}>
                            {branch.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted-foreground text-xs">
                        Each outcome connects to one next node. Seen uses the shorter delay; unseen
                        / delivered uses the regular delay.
                      </p>
                    </div>
                  </>
                )}
                {(selectedNode || selectedEdge) && (
                  <Button variant="destructive" className="w-full" onClick={removeSelected}>
                    <Trash2Icon />
                    Delete {selectedNode ? 'node' : 'connection'}
                  </Button>
                )}
              </fieldset>
              {!selectedNode && !selectedEdge && (
                <p className="text-muted-foreground text-sm">
                  Select a node to edit its label, type, key, or config. Template and delay controls
                  are on each node.
                </p>
              )}
              <div className="text-muted-foreground space-y-2 border-t pt-4 text-xs">
                <p>
                  {nodes.length} nodes · {edges.length} connections
                </p>
                <p>All delays are saved in minutes. Seen delay uses nextMessageSeekDelayMinutes.</p>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
