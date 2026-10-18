import { describe, expect, it } from "vitest";
import {
  act,
  createRoom,
  GO_FISH,
  join,
  parsePack,
  resolveAction,
  viewFor,
  type Room,
} from "./game";

function room(players = 2) {
  const r = createRoom("TEST", {
    id: "alice",
    secret: "alice-secret-123456",
    name: "Alice",
    connected: true,
  });
  for (let i = 1; i < players; i++)
    join(r, `player-${i}`, `secret-${i}-123456789`, `Player ${i}`);
  return r;
}
let n = 0;
const action = (r: Room, who: string, a: unknown) =>
  act(r, who, `action-${++n}`, a);
function allCards(r: Room) {
  return [
    ...r.deck,
    ...Object.values(r.hands).flat(),
    ...r.table.map((p) => p.id),
  ];
}

describe("shared table", () => {
  it.each([1, 2, 3, 4, 8])(
    "deals correctly for %i players without losing or duplicating cards",
    (count) => {
      const r = action(room(count), "alice", { type: "setup" });
      expect(r.hands.alice).toHaveLength(count <= 3 ? 7 : 5);
      expect(allCards(r)).toHaveLength(52);
      expect(new Set(allCards(r)).size).toBe(52);
    },
  );
  it("keeps other hands, deck order, and player secrets out of client views", () => {
    const r = action(room(), "alice", { type: "setup" });
    const view = viewFor(r, "alice");
    expect(view.hand.map((c) => c.id)).toEqual(r.hands.alice);
    expect(view).not.toHaveProperty("deck");
    expect(view).not.toHaveProperty("hands");
    expect(view.players[1]).not.toHaveProperty("secret");
    for (const card of r.hands["player-1"])
      expect(JSON.stringify(view)).not.toContain(`"${card}"`);
    for (const card of r.deck)
      expect(JSON.stringify(view)).not.toContain(`"${card}"`);
  });
  it("keeps face-down card identities out of public messages and resolves opaque handles", () => {
    let r = action(room(), "alice", { type: "setup" });
    const id = r.hands.alice[0];
    r = action(r, "alice", { type: "play", ids: [id], faceUp: false });
    const view = viewFor(r, "player-1");
    expect(view.table[0]).not.toHaveProperty("card");
    expect(JSON.stringify(view)).not.toContain(`"${id}"`);
    const resolved = resolveAction(r, { type: "flip", id: view.table[0].id });
    r = action(r, "player-1", resolved);
    expect(viewFor(r, "player-1").table[0].card?.id).toBe(id);
  });
  it("transfers cards privately and accepts free play without turn restrictions", () => {
    let r = action(room(), "alice", { type: "setup" });
    const ids = r.hands.alice.slice(0, 2);
    r = action(r, "alice", { type: "give", ids, to: "player-1" });
    expect(r.hands.alice).toHaveLength(5);
    expect(r.hands["player-1"]).toHaveLength(9);
    expect(r.log[0].text).toContain("gave 2 cards");
    r = action(r, "player-1", { type: "draw" });
    r = action(r, "player-1", { type: "play", ids, faceUp: true });
    r = action(r, "alice", { type: "take", id: ids[0] });
    r = action(r, "alice", { type: "return", id: ids[1] });
    expect(new Set(allCards(r)).size).toBe(52);
    expect(allCards(r)).toHaveLength(52);
  });
  it("rejects stealing, duplicate selections, invalid positions and non-host resets atomically", () => {
    const r = action(room(), "alice", { type: "setup" });
    const before = structuredClone(r);
    expect(() =>
      action(r, "alice", {
        type: "give",
        ids: [r.hands["player-1"][0]],
        to: "player-1",
      }),
    ).toThrow();
    expect(() =>
      action(r, "alice", {
        type: "play",
        ids: [r.hands.alice[0], r.hands.alice[0]],
        faceUp: true,
      }),
    ).toThrow();
    expect(() => action(r, "player-1", { type: "setup" })).toThrow();
    expect(() =>
      action(r, "alice", { type: "move", id: "fake", x: NaN, y: 0 }),
    ).toThrow();
    expect(r).toEqual(before);
  });
  it("deduplicates repeated requests and refuses a second pickup of the same card", () => {
    let r = action(room(), "alice", { type: "setup" });
    r = act(r, "alice", "repeat", { type: "draw" });
    expect(act(r, "alice", "repeat", { type: "draw" })).toBe(r);
    const id = r.hands.alice[0];
    r = action(r, "alice", { type: "play", ids: [id], faceUp: true });
    r = action(r, "alice", { type: "take", id });
    expect(() => action(r, "player-1", { type: "take", id })).toThrow();
  });
  it("reconnects a seat only with the matching secret and keeps its hand", () => {
    const r = action(room(), "alice", { type: "setup" });
    const before = [...r.hands["player-1"]];
    r.players[1].connected = false;
    expect(() =>
      join(r, "player-1", "wrong-secret-123456", "Imposter"),
    ).toThrow();
    join(r, "player-1", "secret-1-123456789", "Player 1");
    expect(r.players[1].connected).toBe(true);
    expect(r.hands["player-1"]).toEqual(before);
    expect(r.players).toHaveLength(2);
  });
  it("allows late joins with an empty hand, then includes them in a redeal", () => {
    let r = action(room(1), "alice", { type: "setup" });
    join(r, "late", "secret-late-123456", "Late");
    expect(r.hands.late).toEqual([]);
    r = action(r, "alice", { type: "setup" });
    expect(r.hands.late).toHaveLength(7);
  });
  it("reports an empty deck without changing state", () => {
    let r = action(room(), "alice", { type: "setup" });
    while (r.deck.length) r = action(r, "alice", { type: "draw" });
    expect(() => action(r, "player-1", { type: "draw" })).toThrow("empty");
    expect(new Set(allCards(r)).size).toBe(52);
  });
  it("loads declarative packs with tokens and rejects duplicate keys or unsafe images", () => {
    const pack = {
      ...GO_FISH,
      id: "test",
      tokens: [{ label: "Star", color: "#ddaa33", count: 2 }],
    };
    let r = action(room(), "alice", { type: "loadPack", pack });
    r = action(r, "alice", { type: "setup" });
    expect(r.tokens).toHaveLength(2);
    r = action(r, "player-1", {
      type: "moveToken",
      id: r.tokens[0].id,
      x: 50,
      y: 30,
    });
    expect(r.tokens[0].x).toBe(50);
    expect(() =>
      parsePack({ ...pack, cards: [pack.cards[0], pack.cards[0]] }),
    ).toThrow();
    expect(() =>
      parsePack({
        ...pack,
        cards: [{ ...pack.cards[0], image: "javascript:alert(1)" }],
      }),
    ).toThrow();
  });
});
