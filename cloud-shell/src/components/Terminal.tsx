import '@xterm/xterm/css/xterm.css';
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Box } from '@mui/material';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

/** Kubernetes exec stream channels (the first byte of every frame). */
enum Channel {
  StdIn = 0,
  StdOut = 1,
  StdErr = 2,
  ServerError = 3,
  Resize = 4,
}

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

const SHELL_COMMAND = [
  '/bin/sh',
  '-c',
  'for s in zsh bash sh; do command -v "$s" >/dev/null 2>&1 && exec "$s"; done',
];

interface Connection {
  cancel: () => void;
  getSocket: () => WebSocket | null;
}

interface TerminalProps {
  namespace: string;
  name: string;
  container: string;
}

/** Normalize whatever the socket delivers into a byte view for frame parsing. */
async function toBytes(raw: ArrayBuffer | ArrayBufferView | Blob | string): Promise<Uint8Array> {
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw instanceof Blob) return new Uint8Array(await raw.arrayBuffer());
  return encoder.encode(raw);
}

export default function Terminal({ namespace, name, container }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const xterm = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      scrollback: 10000,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(element);
    xterm.focus();

    let connection: Connection | null = null;
    let connected = false;

    const fit = () => {
      try {
        fitAddon.fit();
      } catch {
        // Observer will retry because the container may not be laid out yet.
      }
    };

    const send = (channel: Channel, data: string | Uint8Array) => {
      const socket = connection?.getSocket();
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const payload = typeof data === 'string' ? encoder.encode(data) : data;
      socket.send(new Uint8Array([channel, ...payload]));
    };

    const sendResize = () => {
      send(Channel.Resize, JSON.stringify({ Width: xterm.cols, Height: xterm.rows }));
    };

    const handleFrame = (bytes: Uint8Array) => {
      if (bytes.length === 0) return;
      const channel = bytes[0] as Channel;
      const body = bytes.subarray(1);

      if (channel === Channel.ServerError) {
        try {
          const status = JSON.parse(decoder.decode(body));
          // A clean shell exit reports NonZeroExitCode/zero; only surface real errors.
          if (status?.status === 'Failure' && status?.reason !== 'NonZeroExitCode') {
            xterm.writeln(`\r\n\x1b[31m${status.message || 'Session error'}\x1b[0m`);
          }
        } catch {
          // Ignore anything that's not a status object.
        }
        return;
      }

      if (channel !== Channel.StdOut && channel !== Channel.StdErr) return;

      if (!connected) {
        connected = true;
        xterm.clear();
        sendResize();
      }
      xterm.write(body);
    };

    const onMessage = (raw: ArrayBuffer | ArrayBufferView | Blob | string) => {
      toBytes(raw).then(handleFrame);
    };

    const commandParams = SHELL_COMMAND.map(c => `command=${encodeURIComponent(c)}`).join('&');
    const url =
      `/api/v1/namespaces/${namespace}/pods/${name}/exec` +
      `?container=${encodeURIComponent(container)}&${commandParams}` +
      `&stdin=1&stdout=1&stderr=1&tty=1`;

    connection = ApiProxy.stream(url, onMessage, {
      isJson: false,
      additionalProtocols: [
        'v4.channel.k8s.io',
        'v3.channel.k8s.io',
        'v2.channel.k8s.io',
        'channel.k8s.io',
      ],
      cluster: getCluster() || undefined,
      failCb: () => {
        xterm.writeln('\r\n\x1b[31mLost connection to the cloud shell.\x1b[0m');
      },
    }) as Connection;

    const dataDisposable = xterm.onData(data => send(Channel.StdIn, data));
    const resizeDisposable = xterm.onResize(() => sendResize());

    const resizeObserver = new ResizeObserver(() => fit());
    resizeObserver.observe(element);
    window.addEventListener('resize', fit);
    fit();

    return () => {
      window.removeEventListener('resize', fit);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      try {
        connection?.cancel();
      } catch {
        // Already closed.
      }
      xterm.dispose();
    };
  }, [namespace, name, container]);

  return (
    <Box
      ref={containerRef}
      sx={{ width: '100%', height: '100%', backgroundColor: '#000', p: 0.5, overflow: 'hidden' }}
    />
  );
}
