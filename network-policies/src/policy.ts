import { LabelSelector } from '@kinvolk/headlamp-plugin/lib/K8s/cluster';
import {
  NetworkPolicyEgressRule,
  NetworkPolicyIngressRule,
  NetworkPolicyPort,
} from '@kinvolk/headlamp-plugin/lib/K8s/networkpolicy';

export type Direction = 'Ingress' | 'Egress';

export interface NetworkPolicySpec {
  podSelector: LabelSelector;
  policyTypes?: string[];
  ingress?: Partial<NetworkPolicyIngressRule>[];
  egress?: Partial<NetworkPolicyEgressRule>[];
}

/**
 * Resolves the policy types that actually apply. Per the Kubernetes spec, when
 * `policyTypes` is omitted it defaults to Ingress, plus Egress if the policy
 * has an egress section.
 */
export function effectivePolicyTypes(spec: NetworkPolicySpec): Direction[] {
  if (spec.policyTypes?.length) {
    return spec.policyTypes as Direction[];
  }
  return spec.egress !== undefined ? ['Ingress', 'Egress'] : ['Ingress'];
}

/** Renders a label selector as `key=value` / set-based requirement strings. */
export function selectorLines(selector?: LabelSelector): string[] {
  if (!selector) {
    return [];
  }
  const lines = Object.entries(selector.matchLabels ?? {}).map(([key, value]) => `${key}=${value}`);
  for (const expression of selector.matchExpressions ?? []) {
    switch (expression.operator) {
      case 'In':
        lines.push(`${expression.key} in (${(expression.values ?? []).join(', ')})`);
        break;
      case 'NotIn':
        lines.push(`${expression.key} notin (${(expression.values ?? []).join(', ')})`);
        break;
      case 'Exists':
        lines.push(expression.key);
        break;
      case 'DoesNotExist':
        lines.push(`!${expression.key}`);
        break;
    }
  }
  return lines;
}

export function isSelectorEmpty(selector?: LabelSelector): boolean {
  return selectorLines(selector).length === 0;
}

/** Client-side equivalent of Kubernetes label selector matching. */
export function matchesSelector(
  labels: { [key: string]: string } | undefined,
  selector?: LabelSelector
): boolean {
  const resourceLabels = labels ?? {};
  for (const [key, value] of Object.entries(selector?.matchLabels ?? {})) {
    if (resourceLabels[key] !== value) {
      return false;
    }
  }
  for (const expression of selector?.matchExpressions ?? []) {
    const value = resourceLabels[expression.key];
    switch (expression.operator) {
      case 'In':
        if (value === undefined || !(expression.values ?? []).includes(value)) {
          return false;
        }
        break;
      case 'NotIn':
        if (value !== undefined && (expression.values ?? []).includes(value)) {
          return false;
        }
        break;
      case 'Exists':
        if (value === undefined) {
          return false;
        }
        break;
      case 'DoesNotExist':
        if (value !== undefined) {
          return false;
        }
        break;
      default:
        return false;
    }
  }
  return true;
}

/**
 * Formats a rule's port list. An empty or missing list means the rule applies
 * to all ports. The protocol defaults to TCP and `endPort` denotes a range.
 */
export function formatPorts(ports?: NetworkPolicyPort[]): string {
  if (!ports?.length) {
    return 'all ports';
  }
  return ports
    .map(port => {
      const protocol = port.protocol ?? 'TCP';
      if (port.port === undefined) {
        return `${protocol}/*`;
      }
      if (typeof port.port === 'number' && port.endPort !== undefined) {
        return `${protocol}/${port.port}-${port.endPort}`;
      }
      return `${protocol}/${port.port}`;
    })
    .join(', ');
}
