import { DetailsViewSectionProps, registerDetailsViewSection } from '@kinvolk/headlamp-plugin/lib';
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeNetworkPolicy } from '@kinvolk/headlamp-plugin/lib/K8s/networkpolicy';
import NetworkPolicyMap from './components/NetworkPolicyMap';

registerDetailsViewSection(({ resource }: DetailsViewSectionProps) => {
  if (resource?.kind !== 'NetworkPolicy') return null;
  else
    return (
      <SectionBox title="Traffic">
        <NetworkPolicyMap policy={resource.jsonData as KubeNetworkPolicy} />
      </SectionBox>
    );
});
