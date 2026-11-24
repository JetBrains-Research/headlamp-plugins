import {
  HoverInfoLabel,
  SectionBox,
  ShowHideLabel,
  SimpleTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import Event, { KubeEvent } from '@kinvolk/headlamp-plugin/lib/K8s/event';
import { localeDate, timeAgo } from '@kinvolk/headlamp-plugin/lib/Utils';
import { useEffect, useState } from 'react';

interface MultiObjectEventListProps {
  objects: KubeObject[];
}

/**
 * Fetches and displays Kubernetes events for multiple objects in a single table,
 * mirroring Headlamp's native ObjectEventList. Events are deduplicated by UID
 * and sorted by last occurrence (newest first).
 */
export default function MultiObjectEventList({ objects }: MultiObjectEventListProps) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      const results = await Promise.all(
        objects.map(obj => Event.objectEvents(obj).catch(() => [] as KubeEvent[]))
      );

      if (cancelled) return;

      // Deduplicate by UID
      const seen = new Set<string>();
      const merged: Event[] = [];
      for (const batch of results) {
        for (const raw of batch) {
          const uid = raw.metadata?.uid;
          if (uid && seen.has(uid)) continue;
          if (uid) seen.add(uid);
          merged.push(new Event(raw));
        }
      }

      // Sort newest first
      merged.sort(
        (a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
      );

      setEvents(merged);
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [objects]);

  return (
    <SectionBox title="Events">
      <SimpleTable
        columns={[
          {
            label: 'Type',
            getter: (item: Event) => item.type,
          },
          {
            label: 'Reason',
            getter: (item: Event) => item.reason,
          },
          {
            label: 'From',
            getter: (item: Event) => item.source.component,
          },
          {
            label: 'Message',
            getter: (item: Event) =>
              item && (
                <ShowHideLabel labelId={item?.metadata?.uid || ''}>
                  {item.message || ''}
                </ShowHideLabel>
              ),
          },
          {
            label: 'Age',
            getter: (item: Event) => {
              const eventDate = timeAgo(item.lastOccurrence, { format: 'mini' });
              let label: string;
              if (item.count > 1) {
                label = `${eventDate} (${item.count} times since ${timeAgo(item.firstOccurrence)})`;
              } else {
                label = eventDate;
              }
              return (
                <HoverInfoLabel
                  label={label}
                  hoverInfo={localeDate(item.lastOccurrence)}
                  icon="mdi:calendar"
                />
              );
            },
            sort: (item: Event) => -new Date(item.lastOccurrence).getTime(),
          },
        ]}
        data={events}
      />
    </SectionBox>
  );
}
