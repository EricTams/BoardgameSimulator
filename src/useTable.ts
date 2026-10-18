import { useEffect, useRef, useState } from "react";
import { randomId } from "./randomId";
import {
  act,
  createRoom,
  join,
  resolveAction,
  viewFor,
  type Action,
  type Player,
  type Room,
  type View,
} from "./game";
import { connect, roomCode, type Transport } from "./network";

export type Session = {
  role: "host" | "client";
  code: string;
  identity: Player;
  key: string;
};
const SESSION = "gather.session.v1",
  SNAPSHOT = "gather.room.v1";
function read<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function initialSession(): Session | null {
  return read<Session>(SESSION);
}
export function newSession(
  role: Session["role"],
  name: string,
  code?: string,
): Session {
  return {
    role,
    code: code || roomCode(),
    key: randomId(),
    identity: {
      id: randomId(),
      secret: randomId(),
      name: name.trim(),
      connected: true,
    },
  };
}
export function useTable(session: Session | null) {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState("Connecting…");
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dispatch = useRef<(a: Action) => void>(() => {});
  useEffect(() => {
    setView(null);
    setError("");
    setOnline(false);
    setPending(false);
    if (!session) {
      sessionStorage.removeItem(SESSION);
      sessionStorage.removeItem(SNAPSHOT);
      return;
    }
    sessionStorage.setItem(SESSION, JSON.stringify(session));
    const s = session;
    let alive = true,
      transport: Transport,
      room: Room;
    let pendingTimer: ReturnType<typeof setTimeout>;
    const seats = new Map<string, string>();
    const saved = read<Room>(SNAPSHOT);
    if (s.role === "host") {
      room =
        saved?.version === 1 &&
        saved.code === s.code &&
        saved.hostId === s.identity.id
          ? saved
          : createRoom(s.code, s.identity);
      for (const p of room.players) p.connected = p.id === s.identity.id;
      setView(viewFor(room, s.identity.id));
    }
    function clearPending() {
      clearTimeout(pendingTimer);
      setPending(false);
    }
    function publish() {
      if (!alive) return;
      setView(viewFor(room, s.identity.id));
      for (const [conn, who] of seats) {
        try {
          transport.send(conn, { t: "state", view: viewFor(room, who) });
        } catch {
          /* Reconnect will resync. */
        }
      }
      try {
        sessionStorage.setItem(SNAPSHOT, JSON.stringify(room));
      } catch {
        setError("Browser storage is full; keep this host tab open.");
      }
    }
    function receive(conn: string, raw: unknown) {
      if (!alive || !raw || typeof raw !== "object") return;
      const m = raw as Record<string, any>;
      if (s.role === "client") {
        if (m.t === "state" && m.view?.you === s.identity.id) {
          setView(m.view);
          setOnline(true);
          setStatus("Connected");
          clearPending();
        } else if (m.t === "error") {
          setError(String(m.message));
          clearPending();
        }
        return;
      }
      try {
        if (m.t === "hello") {
          if (m.protocol !== 2)
            throw Error("Different app versions. Reload both browsers.");
          join(room, m.id, m.secret, m.name);
          for (const [old, who] of seats) if (who === m.id) seats.delete(old);
          seats.set(conn, m.id);
          publish();
        } else if (m.t === "action") {
          const who = seats.get(conn);
          if (!who) throw Error("Reconnect to reclaim your seat.");
          room = act(room, who, m.id, resolveAction(room, m.action));
          publish();
        }
      } catch (e) {
        try {
          transport.send(conn, { t: "error", message: (e as Error).message });
        } catch {
          /* closed */
        }
      }
    }
    transport = connect(s.role, s.code, s.key, {
      ready() {
        if (!alive) return;
        setStatus("Connected");
        setOnline(true);
        if (s.role === "host") publish();
        else transport.send("host", { t: "hello", protocol: 2, ...s.identity });
      },
      message: receive,
      close(conn) {
        if (!alive) return;
        if (s.role === "client") {
          setOnline(false);
          clearPending();
          return;
        }
        const ids = conn === "*" ? [...seats.keys()] : [conn];
        for (const id of ids) {
          const who = seats.get(id);
          seats.delete(id);
          const p = room.players.find((p) => p.id === who);
          if (p && ![...seats.values()].includes(p.id)) p.connected = false;
        }
        publish();
      },
      status(message) {
        if (alive) {
          setStatus(message);
          setOnline(false);
        }
      },
      fatal(message) {
        if (alive) {
          setError(message);
          setStatus("Unable to connect");
          setOnline(false);
        }
      },
    });
    dispatch.current = (action) => {
      setError("");
      try {
        const id = randomId();
        if (s.role === "host") {
          room = act(room, s.identity.id, id, resolveAction(room, action));
          publish();
        } else {
          transport.send("host", { t: "action", id, action });
          setPending(true);
          pendingTimer = setTimeout(() => {
            setPending(false);
            setError(
              "Still waiting for the host. Check the table before repeating your action.",
            );
          }, 10000);
        }
      } catch (e) {
        setError((e as Error).message);
        clearPending();
      }
    };
    return () => {
      alive = false;
      clearTimeout(pendingTimer);
      transport.destroy();
    };
  }, [session]);
  return {
    view,
    status,
    online,
    error,
    pending,
    clearError: () => setError(""),
    send: (a: Action) => dispatch.current(a),
  };
}
