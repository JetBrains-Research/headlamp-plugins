import '@xyflow/react/dist/style.css';
import { Icon } from '@iconify/react';
import { LabelSelector } from '@kinvolk/headlamp-plugin/lib/K8s/cluster';
import Namespace from '@kinvolk/headlamp-plugin/lib/K8s/namespace';
import {
  KubeNetworkPolicy,
  NetworkPolicyPeer,
} from '@kinvolk/headlamp-plugin/lib/K8s/networkpolicy';
import Pod from '@kinvolk/headlamp-plugin/lib/K8s/pod';
import { Box, Button, ButtonGroup, Chip, Stack, useTheme } from '@mui/material';
import { Theme } from '@mui/material/styles';
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
  Position,
  ReactFlow,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import { ReactNode, useMemo } from 'react';
import {
  Direction,
  effectivePolicyTypes,
  formatPorts,
  isSelectorEmpty,
  matchesSelector,
  NetworkPolicySpec,
  selectorLines,
} from '../policy';

const NODE_WIDTH = 300;
const NODE_GAP = 30;
const COLUMN_GAP = 210;
// Width available for node content: node padding plus the icon column.
const CONTENT_WIDTH = NODE_WIDTH - 24 - 26;

/** A group of label selector entries rendered as wrapping chips. */
interface ChipGroup {
  caption?: string;
  items: string[];
}

/** Content rendered inside a graph node. */
interface NodeContent {
  icon: string;
  title: string;
  subtitle?: string;
  /** Plain monospace lines, e.g. CIDRs. */
  lines?: string[];
  chips?: ChipGroup[];
  footer?: string;
  accent?: string;
}

/** A node in one of the side columns, plus the edge connecting it to the target. */
interface ColumnEntry {
  id: string;
  content: NodeContent;
  edgeLabel: string;
  blocked?: boolean;
}

interface PeerContext {
  policyNamespace: string;
  pods: Pod[] | null;
  namespaces: Namespace[] | null;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The name of the single namespace a selector matches when it only uses the
 * well-known `kubernetes.io/metadata.name` label, or null otherwise.
 */
function namespaceName(selector?: LabelSelector): string | null {
  if (selector?.matchExpressions?.length) {
    return null;
  }
  const labels = Object.entries(selector?.matchLabels ?? {});
  if (labels.length === 1 && labels[0][0] === 'kubernetes.io/metadata.name') {
    return labels[0][1];
  }
  return null;
}

/** Estimates how many rows a group of chips occupies once wrapped. */
function chipRows(items: string[]): number {
  let rows = 0;
  let x = 0;
  for (const item of items) {
    const width = (item.length + 2) * 6.6 + 14;
    if (width >= CONTENT_WIDTH) {
      rows += Math.ceil(width / CONTENT_WIDTH);
      x = 0;
    } else if (x === 0 || x + width > CONTENT_WIDTH) {
      rows += 1;
      x = width;
    } else {
      x += width + 4;
    }
  }
  return rows;
}

function estimateHeight(content: NodeContent): number {
  let height = 40; // vertical padding + title row
  if (content.subtitle) {
    height += 16;
  }
  for (const line of content.lines ?? []) {
    height += Math.ceil(Math.max(line.length, 1) / 38) * 17;
  }
  for (const group of content.chips ?? []) {
    if (group.caption) {
      height += 16;
    }
    height += chipRows(group.items) * 24;
  }
  if (content.footer) {
    height += 18;
  }
  return height;
}

/** Renders selector entries as `key: value` chips that wrap within the node. */
function SelectorChips({ items }: { items: string[] }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {items.map((item, index) => {
        const separator = item.indexOf('=');
        const key = separator > 0 ? item.slice(0, separator) : null;
        const value = separator > 0 ? item.slice(separator + 1) : item;
        return (
          <Box
            key={index}
            component="span"
            sx={{
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.5,
              px: 0.75,
              py: 0.25,
              borderRadius: '4px',
              backgroundColor: 'action.selected',
              wordBreak: 'break-word',
            }}
          >
            {key !== null && (
              <Box component="span" sx={{ opacity: 0.65 }}>
                {key}:{' '}
              </Box>
            )}
            {value}
          </Box>
        );
      })}
    </Box>
  );
}

function NodeLabel({ content }: { content: NodeContent }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', textAlign: 'left' }}>
      <Icon
        icon={content.icon}
        width={18}
        height={18}
        color={content.accent}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ fontWeight: 600, fontSize: 13 }}>{content.title}</Box>
        {content.subtitle && <Box sx={{ fontSize: 11, opacity: 0.7 }}>{content.subtitle}</Box>}
        {content.lines?.map((line, index) => (
          <Box key={index} sx={{ fontFamily: 'monospace', fontSize: 11.5, wordBreak: 'break-all' }}>
            {line}
          </Box>
        ))}
        {content.chips?.map((group, index) => (
          <Box key={index}>
            {group.caption && (
              <Box
                sx={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  opacity: 0.6,
                  mt: 0.75,
                }}
              >
                {group.caption}
              </Box>
            )}
            <SelectorChips items={group.items} />
          </Box>
        ))}
        {content.footer && (
          <Box sx={{ fontSize: 11, opacity: 0.7, fontStyle: 'italic', mt: '3px' }}>
            {content.footer}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Describes a single `from`/`to` peer. A `null` peer stands for a rule with no
 * peers listed, which per the Kubernetes spec allows all sources/destinations.
 */
function peerContent(
  peer: NetworkPolicyPeer | null,
  direction: Direction,
  ctx: PeerContext
): NodeContent {
  if (!peer) {
    return {
      icon: 'mdi:earth',
      title: direction === 'Ingress' ? 'All sources' : 'All destinations',
      subtitle: 'any pod or IP address',
    };
  }

  if (peer.ipBlock) {
    return {
      icon: 'mdi:ip-network-outline',
      title: 'IP block',
      lines: [peer.ipBlock.cidr, ...(peer.ipBlock.except ?? []).map(cidr => `except ${cidr}`)],
    };
  }

  const podLines = selectorLines(peer.podSelector);
  const podChips: ChipGroup[] = podLines.length ? [{ items: podLines }] : [];

  if (peer.namespaceSelector) {
    const singleNamespace = namespaceName(peer.namespaceSelector);
    const namespaceLines = selectorLines(peer.namespaceSelector);
    const matchedNamespaces = singleNamespace
      ? null
      : ctx.namespaces?.filter(namespace =>
          matchesSelector(namespace.metadata.labels, peer.namespaceSelector)
        );
    const namespaceChips: ChipGroup[] = singleNamespace
      ? []
      : [
          {
            caption: 'namespaces matching',
            items: namespaceLines.length ? namespaceLines : ['all namespaces'],
          },
        ];

    let footer: string | undefined;
    if (peer.podSelector && ctx.pods) {
      const namespaceNames = singleNamespace
        ? new Set([singleNamespace])
        : new Set((matchedNamespaces ?? []).map(namespace => namespace.getName()));
      const matchedPods = ctx.pods.filter(
        pod =>
          namespaceNames.has(pod.metadata.namespace ?? '') &&
          matchesSelector(pod.metadata.labels, peer.podSelector)
      );
      footer = singleNamespace
        ? `matches ${count(matchedPods.length, 'pod')}`
        : `matches ${count(matchedPods.length, 'pod')} in ${count(
            namespaceNames.size,
            'namespace'
          )}`;
    } else if (!peer.podSelector && matchedNamespaces) {
      footer = `matches ${count(matchedNamespaces.length, 'namespace')}`;
    }

    return {
      icon: peer.podSelector ? 'mdi:cube-outline' : 'mdi:folder-network-outline',
      title: podLines.length ? 'Pods' : 'All pods',
      subtitle: singleNamespace ? `in namespace ${singleNamespace}` : 'in matching namespaces',
      chips: [...podChips, ...namespaceChips],
      footer,
    };
  }

  const matchedPods = ctx.pods?.filter(
    pod =>
      pod.metadata.namespace === ctx.policyNamespace &&
      matchesSelector(pod.metadata.labels, peer.podSelector)
  );
  return {
    icon: 'mdi:cube-outline',
    title: podLines.length ? 'Pods' : 'All pods',
    subtitle: `in namespace ${ctx.policyNamespace}`,
    chips: podChips,
    footer: matchedPods ? `matches ${count(matchedPods.length, 'pod')}` : undefined,
  };
}

function makeNode(
  id: string,
  position: { x: number; y: number },
  content: NodeContent,
  theme: Theme
): Node {
  return {
    id,
    position,
    data: { label: <NodeLabel content={content} /> },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    connectable: false,
    style: {
      width: NODE_WIDTH,
      padding: '10px 12px',
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
      border: `1px solid ${content.accent ?? theme.palette.divider}`,
      borderRadius: 8,
      textAlign: 'left',
    },
  };
}

function directionChip(direction: Direction, applies: boolean, ruleCount: number) {
  if (!applies) {
    return (
      <Chip size="small" variant="outlined" label={`${direction}: not restricted by this policy`} />
    );
  }
  if (ruleCount === 0) {
    return (
      <Chip
        size="small"
        variant="outlined"
        color="error"
        label={`${direction}: all traffic blocked`}
      />
    );
  }
  return (
    <Chip
      size="small"
      variant="outlined"
      color="success"
      label={`${direction}: ${count(ruleCount, 'rule')} allow traffic`}
    />
  );
}

/** Same look as the buttons on Headlamp's resource map (GraphControls). */
function GraphControlButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children?: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      disabled={disabled}
      sx={{
        width: '32px',
        height: '32px',
        padding: 0,
        minWidth: '32px',
        borderRadius: '50%',
        '> svg': { width: '14px', height: '14px' },
        fontSize: 'x-small',
      }}
      color="primary"
      variant="contained"
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function GraphControls() {
  const minZoomReached = useStore(store => store.transform[2] <= store.minZoom);
  const maxZoomReached = useStore(store => store.transform[2] >= store.maxZoom);
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();

  return (
    <Box display="flex" gap={1} flexDirection="column">
      <ButtonGroup
        sx={{ borderRadius: '40px', '> .MuiButtonGroup-grouped': { minWidth: '32px' } }}
        orientation="vertical"
        aria-label="Zoom buttons"
        variant="contained"
      >
        <GraphControlButton disabled={maxZoomReached} title="Zoom in" onClick={() => zoomIn()}>
          <Icon icon="mdi:plus" />
        </GraphControlButton>
        <GraphControlButton disabled={minZoomReached} title="Zoom out" onClick={() => zoomOut()}>
          <Icon icon="mdi:minus" />
        </GraphControlButton>
      </ButtonGroup>
      <GraphControlButton title="Fit to screen" onClick={() => fitView({ padding: 0.15 })}>
        <Icon icon="mdi:fit-to-screen" />
      </GraphControlButton>
      <GraphControlButton title="Zoom to 100%" onClick={() => zoomTo(1)}>
        100%
      </GraphControlButton>
    </Box>
  );
}

export interface NetworkPolicyMapProps {
  policy: KubeNetworkPolicy;
}

export default function NetworkPolicyMap({ policy }: NetworkPolicyMapProps) {
  const theme = useTheme();
  const spec: NetworkPolicySpec = policy.spec ?? { podSelector: {} };
  const policyNamespace = policy.metadata.namespace ?? 'default';

  const types = effectivePolicyTypes(spec);
  const ingressApplies = types.includes('Ingress');
  const egressApplies = types.includes('Egress');
  const ingressRules = spec.ingress ?? [];
  const egressRules = spec.egress ?? [];

  // Counting pods matched by a peer with a namespaceSelector requires pods
  // from other namespaces; otherwise the policy's own namespace is enough.
  const needsAllPods = [
    ...(ingressApplies ? ingressRules.flatMap(rule => rule.from ?? []) : []),
    ...(egressApplies ? egressRules.flatMap(rule => rule.to ?? []) : []),
  ].some(peer => peer.namespaceSelector && peer.podSelector);

  const [pods] = Pod.useList(needsAllPods ? {} : { namespace: policyNamespace });
  const [namespaces] = Namespace.useList();

  const { nodes, edges, maxColumnHeight } = useMemo(() => {
    const ctx: PeerContext = { policyNamespace, pods, namespaces };
    const allowColor = theme.palette.success.main;
    const blockColor = theme.palette.error.main;

    function buildColumn(direction: Direction): ColumnEntry[] {
      const applies = direction === 'Ingress' ? ingressApplies : egressApplies;
      if (!applies) {
        return [];
      }
      const rules =
        direction === 'Ingress'
          ? ingressRules.map(rule => ({ ports: rule.ports, peers: rule.from }))
          : egressRules.map(rule => ({ ports: rule.ports, peers: rule.to }));
      const prefix = direction.toLowerCase();
      if (rules.length === 0) {
        return [
          {
            id: `${prefix}-blocked`,
            content: {
              icon: 'mdi:cancel',
              title: direction === 'Ingress' ? 'All ingress blocked' : 'All egress blocked',
              subtitle: `no ${direction === 'Ingress' ? 'inbound' : 'outbound'} traffic allowed`,
              accent: blockColor,
            },
            edgeLabel: 'no traffic',
            blocked: true,
          },
        ];
      }
      return rules.flatMap((rule, ruleIndex) => {
        const peers = rule.peers ?? [];
        const edgeLabel = formatPorts(rule.ports);
        const peerList: (NetworkPolicyPeer | null)[] = peers.length ? peers : [null];
        return peerList.map((peer, peerIndex) => ({
          id: `${prefix}-${ruleIndex}-${peerIndex}`,
          content: peerContent(peer, direction, ctx),
          edgeLabel,
        }));
      });
    }

    const left = buildColumn('Ingress');
    const right = buildColumn('Egress');

    const podsInNamespace = pods?.filter(pod => pod.metadata.namespace === policyNamespace);
    const selectsAllPods = isSelectorEmpty(spec.podSelector);
    const selectedPods = selectsAllPods
      ? podsInNamespace
      : podsInNamespace?.filter(pod => matchesSelector(pod.metadata.labels, spec.podSelector));
    let targetFooter: string | undefined;
    if (selectedPods && podsInNamespace) {
      targetFooter = selectsAllPods
        ? `${count(podsInNamespace.length, 'pod')} in namespace`
        : `matches ${selectedPods.length} of ${count(podsInNamespace.length, 'pod')}`;
    }
    const targetContent: NodeContent = {
      icon: 'mdi:cube',
      title: selectsAllPods ? 'All pods' : 'Selected pods',
      subtitle: `in namespace ${policyNamespace}`,
      chips: selectsAllPods ? [] : [{ items: selectorLines(spec.podSelector) }],
      footer: targetFooter,
      accent: theme.palette.primary.main,
    };

    const columnHeight = (entries: ColumnEntry[]) =>
      entries.reduce((sum, entry) => sum + estimateHeight(entry.content), 0) +
      Math.max(entries.length - 1, 0) * NODE_GAP;

    const targetHeight = estimateHeight(targetContent);
    const maxHeight = Math.max(columnHeight(left), columnHeight(right), targetHeight);

    function stackColumn(entries: ColumnEntry[], x: number): Node[] {
      let y = (maxHeight - columnHeight(entries)) / 2;
      return entries.map(entry => {
        const node = makeNode(entry.id, { x, y }, entry.content, theme);
        y += estimateHeight(entry.content) + NODE_GAP;
        return node;
      });
    }

    const centerX = NODE_WIDTH + COLUMN_GAP;
    const graphNodes: Node[] = [
      ...stackColumn(left, 0),
      makeNode('target', { x: centerX, y: (maxHeight - targetHeight) / 2 }, targetContent, theme),
      ...stackColumn(right, 2 * centerX),
    ];

    const makeEdge = (entry: ColumnEntry, direction: Direction): Edge => {
      const color = entry.blocked ? blockColor : allowColor;
      return {
        id: `edge-${entry.id}`,
        source: direction === 'Ingress' ? entry.id : 'target',
        target: direction === 'Ingress' ? 'target' : entry.id,
        label: entry.edgeLabel,
        type: 'smoothstep',
        style: {
          stroke: color,
          strokeWidth: 1.5,
          ...(entry.blocked ? { strokeDasharray: '6 4' } : {}),
        },
        labelStyle: { fill: theme.palette.text.primary, fontSize: 11 },
        labelBgStyle: { fill: theme.palette.background.default, fillOpacity: 0.9 },
        markerEnd: entry.blocked ? undefined : { type: MarkerType.ArrowClosed, color },
      };
    };

    const graphEdges: Edge[] = [
      ...left.map(entry => makeEdge(entry, 'Ingress')),
      ...right.map(entry => makeEdge(entry, 'Egress')),
    ];

    return { nodes: graphNodes, edges: graphEdges, maxColumnHeight: maxHeight };
  }, [policy, pods, namespaces, theme]);

  const graphHeight = Math.max(320, Math.min(640, maxColumnHeight + 100));

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        {directionChip('Ingress', ingressApplies, ingressRules.length)}
        {directionChip('Egress', egressApplies, egressRules.length)}
      </Stack>
      <Box
        sx={{
          height: graphHeight,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          // The nodes are informational; hide the connection handles.
          '& .react-flow__handle': { opacity: 0, pointerEvents: 'none' },
          // Match the resource map: bare buttons instead of the default panel.
          '& .react-flow__controls': {
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          },
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          colorMode={theme.palette.mode}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          preventScrolling={false}
        >
          <Background variant={BackgroundVariant.Dots} color={theme.palette.divider} size={2} />
          <Controls showInteractive={false} showFitView={false} showZoom={false}>
            <GraphControls />
          </Controls>
        </ReactFlow>
      </Box>
    </Box>
  );
}
