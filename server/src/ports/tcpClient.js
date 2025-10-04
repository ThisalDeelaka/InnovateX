import net from 'net';

export function startTCP({ host, port, onFrame }) {
  function connect() {
    const sock = net.createConnection({ host, port });
    let buffer = '';
    sock.setEncoding('utf8');

    sock.on('connect', () => {
      console.log(`[TCP] connected ${host}:${port}`);
    });

    sock.on('data', chunk => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const frame = JSON.parse(line);
          onFrame?.(frame);
        } catch {
          // ignore bad lines
        }
      }
    });

    sock.on('error', (err) => {
      console.error('[TCP] error', err.message);
      setTimeout(connect, 1000);
    });

    sock.on('close', () => {
      console.warn('[TCP] closed, retrying…');
      setTimeout(connect, 1000);
    });
  }
  connect();
}
