import { randomId } from "./randomId";

export type CardDef = {
  key: string;
  rank: string;
  suit: string;
  color: string;
  image?: string;
};
export type Pack = {
  id: string;
  name: string;
  description: string;
  backColor: string;
  cards: CardDef[];
  setup: { smallHand: number; largeHand: number };
  tokens: { label: string; color: string; count: number }[];
};
export const GO_FISH: Pack = {
  id: "go-fish",
  name: "Go Fish",
  description: "A familiar deck. A little friendly fishing.",
  backColor: "#c36947",
  cards: ["♠", "♥", "♣", "♦"].flatMap((suit, s) =>
    ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map(
      (rank) => ({
        key: `${s}-${rank}`,
        rank,
        suit,
        color: s % 2 ? "#b54e40" : "#243b36",
      }),
    ),
  ),
  setup: { smallHand: 7, largeHand: 5 },
  tokens: [],
};
export type Player = {
  id: string;
  name: string;
  secret: string;
  connected: boolean;
};
export type TablePiece = {
  id: string;
  x: number;
  y: number;
  faceUp: boolean;
  placedBy: string;
};
export type Token = {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
};
export type Room = {
  version: 1;
  code: string;
  hostId: string;
  pack: Pack;
  started: boolean;
  revision: number;
  players: Player[];
  deck: string[];
  hands: Record<string, string[]>;
  table: TablePiece[];
  tokens: Token[];
  log: { id: number; text: string }[];
  seen: string[];
};
export type Card = CardDef & { id: string };
export type View = {
  code: string;
  hostId: string;
  you: string;
  started: boolean;
  revision: number;
  pack: { id: string; name: string; description: string; backColor: string };
  players: { id: string; name: string; connected: boolean; count: number }[];
  hand: Card[];
  deckCount: number;
  table: (TablePiece & { card?: Card })[];
  tokens: Token[];
  log: Room["log"];
};
export type Action =
  | { type: "setup" | "shuffle" }
  | { type: "draw" }
  | { type: "play"; ids: string[]; faceUp: boolean }
  | { type: "give"; ids: string[]; to: string }
  | { type: "take" | "flip" | "return"; id: string }
  | { type: "move" | "moveToken"; id: string; x: number; y: number }
  | { type: "loadPack"; pack: unknown };

const hex = /^#[\da-f]{6}$/i;
export function parsePack(raw: unknown): Pack {
  if (!raw || typeof raw !== "object")
    throw Error("The pack must be a JSON object.");
  const p = raw as Pack;
  if (
    typeof p.id !== "string" ||
    p.id.length > 80 ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 50 ||
    typeof p.description !== "string" ||
    p.description.length > 250 ||
    !hex.test(p.backColor) ||
    !Array.isArray(p.cards) ||
    p.cards.length < 1 ||
    p.cards.length > 200 ||
    !p.setup ||
    ![p.setup.smallHand, p.setup.largeHand].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 20,
    )
  ) {
    throw Error(
      "Invalid pack. Use the example pack format (1–200 cards and hand sizes of 0–20).",
    );
  }
  const keys = new Set<string>();
  const cards = p.cards.map((c) => {
    if (
      !c ||
      typeof c.key !== "string" ||
      !/^[\w-]{1,60}$/.test(c.key) ||
      ["__proto__", "constructor", "prototype"].includes(c.key) ||
      keys.has(c.key) ||
      typeof c.rank !== "string" ||
      c.rank.length > 12 ||
      typeof c.suit !== "string" ||
      c.suit.length > 8 ||
      !hex.test(c.color) ||
      (c.image !== undefined &&
        (typeof c.image !== "string" ||
          c.image.length > 2000 ||
          !/^https:\/\//.test(c.image)))
    ) {
      throw Error(
        "Each card needs a unique key, short rank/suit, hex color, and optional HTTPS image URL.",
      );
    }
    keys.add(c.key);
    return {
      key: c.key,
      rank: c.rank,
      suit: c.suit,
      color: c.color,
      ...(c.image ? { image: c.image } : {}),
    };
  });
  const tokens = p.tokens ?? [];
  if (
    !Array.isArray(tokens) ||
    tokens.length > 20 ||
    tokens.some(
      (t) =>
        !t ||
        typeof t.label !== "string" ||
        t.label.length > 16 ||
        !hex.test(t.color) ||
        !Number.isInteger(t.count) ||
        t.count < 1 ||
        t.count > 10,
    )
  ) {
    throw Error(
      "Tokens need a label, hex color, and count from 1 to 10 (up to 20 types).",
    );
  }
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    backColor: p.backColor,
    cards,
    setup: { smallHand: p.setup.smallHand, largeHand: p.setup.largeHand },
    tokens: tokens.map((t) => ({
      label: t.label,
      color: t.color,
      count: t.count,
    })),
  };
}
export function createRoom(code: string, host: Player): Room {
  return {
    version: 1,
    code,
    hostId: host.id,
    pack: GO_FISH,
    started: false,
    revision: 0,
    players: [host],
    deck: GO_FISH.cards.map((c) => c.key),
    hands: { [host.id]: [] },
    table: [],
    tokens: [],
    log: [],
    seen: [],
  };
}
export function note(room: Room, text: string) {
  room.revision++;
  room.log = [{ id: room.revision, text }, ...room.log].slice(0, 40);
}
export function join(room: Room, id: string, secret: string, name: string) {
  if (
    typeof id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
    ["constructor", "prototype"].includes(id) ||
    typeof secret !== "string" ||
    secret.length < 16 ||
    secret.length > 100 ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 24
  )
    throw Error("Please enter a name of 1–24 characters.");
  const existing = room.players.find((p) => p.id === id);
  if (existing) {
    if (existing.secret !== secret)
      throw Error("This seat belongs to another player.");
    existing.connected = true;
  } else {
    if (room.players.length >= 8)
      throw Error("This table is full (8 players).");
    room.players.push({ id, secret, name: name.trim(), connected: true });
    room.hands[id] = [];
    note(room, `${name.trim()} joined the table.`);
  }
}
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    // Rejection sampling avoids modulo bias.
    const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    let n: number;
    do {
      n = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (n >= limit);
    const j = n % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function act(
  room: Room,
  who: string,
  requestId: string,
  raw: unknown,
): Room {
  if (typeof requestId !== "string" || requestId.length > 100 || !requestId)
    throw Error("Invalid action ID.");
  if (room.seen.includes(`${who}:${requestId}`)) return room;
  const player = room.players.find((p) => p.id === who);
  if (!player) throw Error("Join the table first.");
  if (!raw || typeof raw !== "object") throw Error("Invalid action.");
  const a = raw as Action;
  const r = structuredClone(room);
  const hand = r.hands[who];
  const host = () => {
    if (who !== r.hostId) throw Error("Only the host can set up the table.");
  };
  const selection = (ids: string[]) => {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 200 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== "string" || !hand.includes(id))
    )
      throw Error("Those cards are no longer in your hand.");
  };
  const remove = (ids: string[]) => {
    r.hands[who] = hand.filter((id) => !ids.includes(id));
  };
  const piece = (id: string) => {
    const p = r.table.find((p) => p.id === id);
    if (!p) throw Error("That card is no longer on the table.");
    return p;
  };
  const position = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw Error("Invalid position.");
    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(12, Math.min(88, y)),
    };
  };
  if (!r.started && a.type !== "setup" && a.type !== "loadPack")
    throw Error("The host needs to deal first.");
  switch (a.type) {
    case "setup": {
      host();
      r.deck = shuffle(r.pack.cards.map((c) => c.key));
      r.table = [];
      r.hands = {};
      (r as WithHandles).handles = {};
      const count =
        r.players.length <= 3 ? r.pack.setup.smallHand : r.pack.setup.largeHand;
      for (const p of r.players) r.hands[p.id] = [];
      for (let i = 0; i < count; i++)
        for (const p of r.players) {
          const card = r.deck.pop();
          if (card) r.hands[p.id].push(card);
        }
      r.tokens = r.pack.tokens.flatMap((t, n) =>
        Array.from({ length: t.count }, (_, i) => ({
          id: `token-${n}-${i}`,
          label: t.label,
          color: t.color,
          x: 12 + (n % 6) * 14,
          y: 20 + i * 5,
        })),
      );
      r.started = true;
      note(r, `${player.name} shuffled and dealt a new game.`);
      break;
    }
    case "loadPack":
      host();
      if (r.started)
        throw Error(
          "Choose a pack before dealing. Open a new table to switch packs.",
        );
      r.pack = parsePack(a.pack);
      r.deck = r.pack.cards.map((c) => c.key);
      note(r, `${player.name} loaded ${r.pack.name}.`);
      break;
    case "shuffle":
      r.deck = shuffle(r.deck);
      note(r, `${player.name} shuffled the draw pile.`);
      break;
    case "draw": {
      const card = r.deck.pop();
      if (!card) throw Error("The draw pile is empty.");
      hand.push(card);
      note(r, `${player.name} drew a card.`);
      break;
    }
    case "play":
      selection(a.ids);
      if (typeof a.faceUp !== "boolean")
        throw Error("Invalid card visibility.");
      remove(a.ids);
      a.ids.forEach((id, i) =>
        r.table.push({
          id,
          x: 34 + ((r.table.length * 9) % 54),
          y: 35 + (i % 3) * 12,
          faceUp: a.faceUp,
          placedBy: who,
        }),
      );
      note(
        r,
        `${player.name} played ${a.ids.length} card${a.ids.length === 1 ? "" : "s"} ${a.faceUp ? "face up" : "face down"}.`,
      );
      break;
    case "give":
      selection(a.ids);
      if (a.to === who || !r.players.some((p) => p.id === a.to))
        throw Error("Choose another player.");
      remove(a.ids);
      r.hands[a.to].push(...a.ids);
      note(
        r,
        `${player.name} gave ${a.ids.length} card${a.ids.length === 1 ? "" : "s"} to ${r.players.find((p) => p.id === a.to)!.name}.`,
      );
      break;
    case "take":
      piece(a.id);
      r.table = r.table.filter((p) => p.id !== a.id);
      hand.push(a.id);
      note(r, `${player.name} picked up a card.`);
      break;
    case "return":
      piece(a.id);
      r.table = r.table.filter((p) => p.id !== a.id);
      r.deck.push(a.id);
      note(r, `${player.name} returned a card to the top of the deck.`);
      break;
    case "flip": {
      const p = piece(a.id);
      p.faceUp = !p.faceUp;
      note(r, `${player.name} flipped a card.`);
      break;
    }
    case "move":
      Object.assign(piece(a.id), position(a.x, a.y));
      r.revision++;
      break;
    case "moveToken": {
      const t = r.tokens.find((t) => t.id === a.id);
      if (!t) throw Error("That token is missing.");
      Object.assign(t, position(a.x, a.y));
      r.revision++;
      break;
    }
    default:
      throw Error("Unknown action.");
  }
  r.seen = [...r.seen, `${who}:${requestId}`].slice(-500);
  return r;
}
export function viewFor(room: Room, who: string): View {
  if (!room.players.some((p) => p.id === who)) throw Error("Unknown player.");
  const card = (id: string): Card => ({
    ...room.pack.cards.find((c) => c.key === id)!,
    id,
  });
  return {
    code: room.code,
    hostId: room.hostId,
    you: who,
    started: room.started,
    revision: room.revision,
    pack: {
      id: room.pack.id,
      name: room.pack.name,
      description: room.pack.description,
      backColor: room.pack.backColor,
    },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      count: room.hands[p.id].length,
    })),
    hand: room.hands[who].map(card),
    deckCount: room.deck.length,
    // Opaque piece IDs prevent face-down cards revealing their rank through an ID.
    table: room.table.map((p) => ({
      ...p,
      id: `piece-${opaqueId(room, p.id)}`,
      ...(p.faceUp ? { card: card(p.id) } : {}),
    })),
    tokens: structuredClone(room.tokens),
    log: structuredClone(room.log),
  };
}

// Random public table handles do not encode the rank or suit. Mapping stays host-only.
function opaqueId(room: Room, id: string): string {
  // Use an independently generated map stored in the host session (see publicHandles below).
  return publicHandles(room)[id];
}
type WithHandles = Room & { handles?: Record<string, string> };
function publicHandles(room: Room): Record<string, string> {
  const r = room as WithHandles;
  r.handles ??= {};
  for (const c of room.pack.cards) r.handles[c.key] ??= randomId();
  return r.handles;
}
export function resolveAction(room: Room, raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const a = raw as Action;
  if (["take", "flip", "return", "move"].includes(a.type) && "id" in a) {
    const id = Object.entries(publicHandles(room)).find(
      ([, value]) => `piece-${value}` === a.id,
    )?.[0];
    if (!id) throw Error("That card is no longer on the table.");
    return { ...a, id };
  }
  return a;
}
