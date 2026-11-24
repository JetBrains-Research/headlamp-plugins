import { K8s } from '@kinvolk/headlamp-plugin/lib';
import {
  LightTooltip,
  PercentageBar,
  TooltipIcon,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeNode } from '@kinvolk/headlamp-plugin/lib/K8s/node';
import { KubePod } from '@kinvolk/headlamp-plugin/lib/K8s/pod';
import { Box, Typography } from '@mui/material';
import { useMemo } from 'react';
import { allocatedGpusByNode, nodeAllocatableGpus, podGpuLimits, podGpuRequest } from '../gpu';

export function AbbreviatedValue({
  value,
  transformFunc,
}: {
  value: string;
  transformFunc: (value: string) => string;
}) {
  return (
    <LightTooltip title={value} interactive>
      <Typography>{transformFunc(value)}</Typography>
    </LightTooltip>
  );
}

export function NodeGpuCell({ node }: { node: KubeNode }) {
  const [pods] = K8s.ResourceClasses.Pod.useList();
  const allocatedByNode = useMemo(() => (pods ? allocatedGpusByNode(pods) : null), [pods]);

  const allocatable = nodeAllocatableGpus(node);
  if (allocatable <= 0) {
    return null;
  }

  const allocated = allocatedByNode?.get(node.metadata.name) ?? 0;
  const percent = Math.round((allocated / allocatable) * 100);

  return (
    <PercentageBar
      data={[{ name: 'GPU', value: allocated }]}
      total={allocatable}
      tooltipFunc={() => (
        <Typography>
          {allocated} of {allocatable} GPUs ({percent}%)
        </Typography>
      )}
    />
  );
}

export function PodGpuCell({ pod }: { pod: KubePod }) {
  const request = podGpuRequest(pod);
  const limit = podGpuLimits(pod);
  if (request === 0 && limit === 0) return null;

  const lines = [];
  if (request > 0) {
    lines.push(`Request: ${request}`);
  }
  if (limit > 0) {
    lines.push(`Limit: ${limit}`);
  }

  return (
    <Box display="flex" alignItems="center" width="100%">
      <span style={{ whiteSpace: 'nowrap' }}>{limit || request}</span>
      {lines.length > 0 && (
        <Box component="span" sx={{ display: 'inline-flex', ml: 'auto' }}>
          <TooltipIcon>
            <span style={{ whiteSpace: 'pre-line' }}>{lines.join('\n')}</span>
          </TooltipIcon>
        </Box>
      )}
    </Box>
  );
}
