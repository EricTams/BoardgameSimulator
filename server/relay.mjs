import { WebSocketServer, WebSocket } from "ws";

// This relay routes opaque messages. All game state lives in the host browser.
export function attachRelay(server) {
  const rooms = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });
  const send = (ws, value) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
  };
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/rooms") return;
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws) => {
    let room, code, role, id;
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    const timeout = setTimeout(() => ws.close(4000, "Join timeout"), 10000);
    ws.on("message", (data) => {
      try {
        const m = JSON.parse(data.toString());
        if (m.t === "ping") {
          send(ws, { t: "pong" });
          return;
        }
        if (!room) {
          if (
            m.t !== "join" ||
            !/^[A-Z2-9]{4}$/.test(m.code) ||
            !["host", "client"].includes(m.role)
          )
            throw Error("Invalid room");
          code = m.code;
          role = m.role;
          if (role === "host") {
            if (
              typeof m.key !== "string" ||
              m.key.length < 16 ||
              m.key.length > 100
            )
              throw Error("Invalid host key");
            const old = rooms.get(code);
            if (old && old.key !== m.key) {
              ws.close(4001, "Room code taken");
              return;
            }
            if (old?.host) old.host.close(4003, "Replaced by host reconnect");
            room = old ?? { key: m.key, clients: new Map() };
            clearTimeout(room.expiry);
            room.host = ws;
            rooms.set(code, room);
          } else {
            room = rooms.get(code);
            if (!room?.host || room.host.readyState !== WebSocket.OPEN) {
              room = null;
              ws.close(4004, "Host unavailable");
              return;
            }
            if (room.clients.size >= 16) {
              room = null;
              ws.close(4009, "Room full");
              return;
            }
            id = crypto.randomUUID();
            room.clients.set(id, ws);
            send(room.host, { t: "open", id });
          }
          clearTimeout(timeout);
          send(ws, { t: "ready" });
          return;
        }
        if (m.t !== "send") return;
        if (role === "host") {
          const target = room.clients.get(m.id);
          if (target) send(target, { t: "message", data: m.data });
        } else if (room.host)
          send(room.host, { t: "message", id, data: m.data });
      } catch {
        ws.close(4000, "Invalid message");
      }
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      clearTimeout(timeout);
      if (!room) return;
      if (role === "host" && room.host === ws) {
        room.host = null;
        for (const client of room.clients.values())
          client.close(4002, "Host disconnected");
        room.clients.clear();
        // Reserve the code briefly so the same host can recover its table.
        room.expiry = setTimeout(
          () => {
            if (!room.host) rooms.delete(code);
          },
          10 * 60 * 1000,
        );
        room.expiry.unref();
      } else if (role === "client" && room.clients.delete(id))
        send(room.host, { t: "close", id });
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  heartbeat.unref();
  server.on("close", () => {
    clearInterval(heartbeat);
    for (const room of rooms.values()) clearTimeout(room.expiry);
    wss.close();
  });
  return wss;
}
