import { K8s } from '@kinvolk/headlamp-plugin/lib';
import {
  Link,
  Loader,
  SectionBox,
  SectionFilterHeader,
} from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { buildGpuNodes, GpuNode, gpuTotals, shortTopology, utilisation } from '../gpu';

const NO_TOPOLOGY = '__none__';

interface SubblockGroup {
  subblock: string;
  nodes: GpuNode[];
}

interface BlockGroup {
  block: string;
  subblocks: SubblockGroup[];
}

/** Group GPU nodes by topology block, then subblock, preserving insertion order. */
function groupByTopology(gpuNodes: GpuNode[]): BlockGroup[] {
  const blocks = new Map<string, Map<string, GpuNode[]>>();
  for (const gpuNode of gpuNodes) {
    const block = gpuNode.block ?? NO_TOPOLOGY;
    const subblock = gpuNode.subblock ?? NO_TOPOLOGY;
    if (!blocks.has(block)) blocks.set(block, new Map());
    const subblocks = blocks.get(block)!;
    if (!subblocks.has(subblock)) subblocks.set(subblock, []);
    subblocks.get(subblock)!.push(gpuNode);
  }
  return [...blocks.entries()].map(([block, subblocks]) => ({
    block,
    subblocks: [...subblocks.entries()].map(([subblock, nodes]) => ({ subblock, nodes })),
  }));
}

/** Single color-coded GPU node block, linking to the node's detail page. */
function GpuBlock({ gpuNode }: { gpuNode: GpuNode }) {
  const theme = useTheme();
  const ratio = utilisation(gpuNode);
  const palette =
    ratio >= 1 ? theme.palette.error : ratio >= 0.5 ? theme.palette.warning : theme.palette.success;

  return (
    <Tooltip
      placement="right"
      slotProps={{ tooltip: { sx: { maxWidth: 'none' } } }}
      title={<Box sx={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'nowrap' }}>{gpuNode.name}</Box>}
    >
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <Link kubeObject={gpuNode.node} tooltip={false} underline="none">
          <Paper
            variant="outlined"
            sx={{
              width: 56,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: palette.main,
              borderWidth: 2,
              backgroundColor: alpha(palette.main, 0.14),
              cursor: 'pointer',
              transition: 'transform 0.1s, box-shadow 0.1s',
              '&:hover': { transform: 'scale(1.08)', boxShadow: 3 },
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                color: palette.main,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {gpuNode.free}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>
              /{gpuNode.allocatable}
            </Typography>
            {!gpuNode.ready && (
              <Typography variant="caption" sx={{ color: theme.palette.error.main, lineHeight: 1 }}>
                !
              </Typography>
            )}
          </Paper>
        </Link>
      </Box>
    </Tooltip>
  );
}

/** Summary statistics card. */
function StatCard({
  label,
  value,
  caption,
  color,
}: {
  label: string;
  value: number;
  caption?: string;
  color?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 130 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {caption && (
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 0.5 }}>
            {caption}
          </Typography>
        )}
      </Typography>
    </Paper>
  );
}

/**
 * GPU topology dashboard: a block/subblock grid of GPU nodes plus
 * a summary of consumed vs available GPUs across the cluster.
 */
export default function GpuTopology() {
  const theme = useTheme();
  const [nodes] = K8s.ResourceClasses.Node.useList();
  const [pods] = K8s.ResourceClasses.Pod.useList();

  const gpuNodes = useMemo(() => (nodes && pods ? buildGpuNodes(nodes, pods) : []), [nodes, pods]);
  const groups = useMemo(() => groupByTopology(gpuNodes), [gpuNodes]);

  if (!nodes || !pods) {
    return <Loader title="Loading GPU topology..." />;
  }

  const { allocatable: totalGpus, allocated: allocatedGpus } = gpuTotals(gpuNodes);

  return (
    <SectionBox title={<SectionFilterHeader title="GPU Topology" noNamespaceFilter />} backLink="">
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', mb: 2 }}>
        <StatCard label="GPU Nodes" value={gpuNodes.length} />
        <StatCard
          label="Allocated GPUs"
          value={allocatedGpus}
          caption={`/ ${totalGpus}`}
          color={theme.palette.warning.main}
        />
      </Stack>

      {gpuNodes.length === 0 ? null : (
        <Stack spacing={3}>
          {groups.map(({ block, subblocks }) => (
            <Box key={block}>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                {block === NO_TOPOLOGY ? 'No topology block' : `Block ${shortTopology(block)}`}
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {subblocks.map(({ subblock, nodes: subblockNodes }) => (
                  <Stack
                    key={subblock}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    {subblock !== NO_TOPOLOGY && (
                      <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 56 }}>
                        {shortTopology(subblock)}
                      </Typography>
                    )}
                    {subblockNodes.map(gpuNode => (
                      <GpuBlock key={gpuNode.name} gpuNode={gpuNode} />
                    ))}
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </SectionBox>
  );
}
