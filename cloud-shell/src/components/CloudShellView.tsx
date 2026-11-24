import { Icon } from '@iconify/react';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../config';
import { deleteSession, ensureRunningSession, Session, SHELL_CONTAINER } from '../session';
import Terminal from './Terminal';

interface CloudShellViewProps {
  onClose: () => void;
}

type Phase =
  | {
      kind: 'connecting';
      message: string;
    }
  | {
      kind: 'ready';
      session: Session;
    }
  | {
      kind: 'error';
      message: string;
    };

/**
 * The cloud shell as a full-page activity, mirroring Headlamp's native pod terminal/debug views.
 * Rendered as the `content` of an `Activity`, so it owns only the in-view chrome (status bar and terminal);
 * the activity itself provides the window frame, title and close/minimize controls.
 */
export default function CloudShellView({ onClose }: CloudShellViewProps) {
  const { image, namespace, serviceAccountName } = useSettings();
  const [phase, setPhase] = useState<Phase>({
    kind: 'connecting',
    message: 'Starting the cloud shell...',
  });
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    const cluster = getCluster();
    if (!cluster) {
      setPhase({
        kind: 'error',
        message: 'Select a cluster before opening a cloud shell.',
      });
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    sessionRef.current = null;
    setPhase({
      kind: 'connecting',
      message: 'Starting the cloud shell...',
    });

    ensureRunningSession({
      namespace,
      image,
      serviceAccount: serviceAccountName,
      cluster,
      signal: controller.signal,
      onStatus: message => {
        if (!controller.signal.aborted) {
          setPhase({
            kind: 'connecting',
            message,
          });
        }
      },
    })
      .then(session => {
        if (controller.signal.aborted) return;
        sessionRef.current = session;
        setPhase({
          kind: 'ready',
          session,
        });
      })
      .catch((error: any) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setPhase({
          kind: 'error',
          message: error?.message || String(error),
        });
      });

    return () => controller.abort();
  }, [namespace, image, serviceAccountName]);

  const handleTerminate = async () => {
    abortRef.current?.abort();
    const session = sessionRef.current;
    if (session) {
      try {
        await deleteSession(session.jobName, namespace);
      } catch {
        // Best effort; the session may already be gone.
      }
    }
    onClose();
  };

  const subtitle = [namespace, phase.kind === 'ready' ? phase.session.username : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={theme => ({
          px: 2,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        })}
      >
        <Typography variant="body2" color="textSecondary" sx={{ flex: 1 }}>
          {subtitle}
        </Typography>
        <Button
          color="error"
          size="small"
          startIcon={<Icon icon="mdi:delete-outline" />}
          onClick={handleTerminate}
          disabled={phase.kind !== 'ready'}
        >
          Terminate session
        </Button>
      </Stack>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {phase.kind === 'connecting' && (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ width: '100%' }}>
            <CircularProgress />
            <Typography>{phase.message}</Typography>
          </Stack>
        )}
        {phase.kind === 'error' && (
          <Box sx={{ p: 2, width: '100%' }}>
            <Alert severity="error">{phase.message}</Alert>
          </Box>
        )}
        {phase.kind === 'ready' && (
          <Terminal
            namespace={namespace}
            name={phase.session.podName}
            container={SHELL_CONTAINER}
          />
        )}
      </Box>
    </Box>
  );
}
