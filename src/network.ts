import Peer, { type DataConnection } from "peerjs";
import { randomId } from "./randomId";

export type Handlers = {
  ready(): void;
  message(id: string, data: unknown): void;
  close(id: string): void;
  status(message: string): void;
  fatal(message: string): void;
};
export type Transport = {
  send(id: string, data: unknown): void;
  destroy(): void;
};
export function roomCode() {
  const chars = "ACDEFGHJKMNPQRTUVWXY2346789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(4)),
    (n) => chars[n % chars.length],
  ).join("");
}
export function mode(): "relay" | "peer" {
  if (import.meta.env.VITE_TRANSPORT === "peer") return "peer";
  return import.meta.env.DEV ||
    import.meta.env.VITE_RELAY_URL ||
    import.meta.env.VITE_TRANSPORT === "relay"
    ? "relay"
    : "peer";
}
export function connect(
  role: "host" | "client",
  code: string,
  key: string,
  h: Handlers,
): Transport {
  return mode() === "relay" ? relay(role, code, key, h) : peer(role, code, h);
}
function relay(
  role: "host" | "client",
  code: string,
  key: string,
  h: Handlers,
): Transport {
  let ws: WebSocket,
    stopped = false,
    retry: ReturnType<typeof setTimeout>,
    attempt = 0,
    lastPong = Date.now();
  const url =
    import.meta.env.VITE_RELAY_URL ||
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/rooms`;
  function open() {
    if (stopped) return;
    h.status(attempt ? "Reconnecting to the table…" : "Connecting…");
    ws = new WebSocket(url);
    ws.onopen = () => {
      lastPong = Date.now();
      ws.send(JSON.stringify({ t: "join", role, code, key }));
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.t === "ready") {
          attempt = 0;
          h.ready();
        } else if (m.t === "message") h.message(m.id ?? "host", m.data);
        else if (m.t === "close") h.close(m.id);
        else if (m.t === "pong") lastPong = Date.now();
      } catch {
        /* Ignore malformed frames. */
      }
    };
    ws.onclose = (e) => {
      if (stopped) return;
      h.close(role === "client" ? "host" : "*");
      if ([4000, 4001, 4003, 4009].includes(e.code)) {
        stopped = true;
        h.fatal(e.reason || "Unable to open this room.");
        return;
      }
      h.status(
        e.code === 4004
          ? "Waiting for the host. Check the room code or ask them to reopen the table."
          : "Connection lost. Reconnecting…",
      );
      retry = setTimeout(open, Math.min(1000 * 1.5 ** attempt++, 8000));
    };
    ws.onerror = () => {
      /* onclose handles retry. */
    };
  }
  const heartbeat = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      if (Date.now() - lastPong > 45000) ws.close();
      else ws.send(JSON.stringify({ t: "ping" }));
    }
  }, 10000);
  open();
  return {
    send(id, data) {
      if (ws.readyState !== WebSocket.OPEN)
        throw Error("Reconnecting. Try again when the table is online.");
      ws.send(JSON.stringify({ t: "send", id, data }));
    },
    destroy() {
      stopped = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      ws?.close();
    },
  };
}
function peer(role: "host" | "client", code: string, h: Handlers): Transport {
  let p: Peer,
    stopped = false,
    retry: ReturnType<typeof setTimeout>,
    connectionTimer: ReturnType<typeof setTimeout>,
    attempt = 0,
    generation = 0;
  const conns = new Map<string, DataConnection>();
  const hostId = `gather-table-v1-${code}`;
  const iceServers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
  ];
  if (
    import.meta.env.VITE_TURN_URLS &&
    import.meta.env.VITE_TURN_USERNAME &&
    import.meta.env.VITE_TURN_CREDENTIAL
  ) {
    iceServers.push({
      urls: import.meta.env.VITE_TURN_URLS.split(","),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  function register(c: DataConnection) {
    const current = generation;
    const id = role === "client" ? "host" : c.connectionId;
    c.on("open", () => {
      if (stopped || current !== generation) return;
      conns.set(id, c);
      attempt = 0;
      if (role === "client") {
        clearTimeout(connectionTimer);
        h.ready();
      }
    });
    c.on("data", (data) => {
      if (!stopped && current === generation) h.message(id, data);
    });
    c.on("close", () => {
      if (stopped || current !== generation) return;
      conns.delete(id);
      h.close(id);
      if (role === "client") reconnect();
    });
    c.on("error", () => {
      if (stopped || current !== generation) return;
      c.close();
      if (role === "client") reconnect();
    });
  }
  function reconnect() {
    if (stopped) return;
    clearTimeout(retry);
    clearTimeout(connectionTimer);
    h.status("Reconnecting to the table…");
    retry = setTimeout(open, Math.min(1500 * 1.5 ** attempt++, 8000));
  }
  function open() {
    if (stopped) return;
    generation++;
    if (p) {
      p.removeAllListeners();
      p.destroy();
    }
    conns.clear();
    h.status("Connecting peer to peer…");
    p = new Peer(role === "host" ? hostId : randomId(), {
      config: { iceServers },
    });
    connectionTimer = setTimeout(() => {
      reconnect();
      h.status(
        "Still trying to connect. Check the room code; restrictive networks may need a relay or a different Wi-Fi connection.",
      );
    }, 18000);
    p.on("open", () => {
      if (role === "host") {
        clearTimeout(connectionTimer);
        attempt = 0;
        h.ready();
      } else register(p.connect(hostId, { reliable: true }));
    });
    p.on("connection", (c) => {
      if (role === "host") register(c);
      else c.close();
    });
    p.on("disconnected", () => {
      h.close(role === "client" ? "host" : "*");
      reconnect();
    });
    p.on("error", (error) => {
      if (error.type === "unavailable-id" && attempt >= 4) {
        stopped = true;
        clearTimeout(connectionTimer);
        h.fatal("This room code is already in use. Start a new table.");
        return;
      }
      reconnect();
    });
  }
  open();
  return {
    send(id, data) {
      const c = conns.get(id);
      if (!c?.open) throw Error("This player is reconnecting.");
      c.send(data);
    },
    destroy() {
      stopped = true;
      clearTimeout(retry);
      clearTimeout(connectionTimer);
      p?.destroy();
      conns.clear();
    },
  };
}
