import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("art/capitalism-plus/cards.json", root), "utf8"),
);
await mkdir(new URL("public/packs/capitalism-plus/", root), {
  recursive: true,
});
await mkdir(new URL("src/packs/", root), { recursive: true });
const pack = {
  id: "capitalism-plus",
  name: "Capitalism Plus",
  description:
    `${catalog.cards.length} cards from the October 18, 2026 set. Draw, trade, and play your way.`,
  backColor: "#557c69",
  cards: catalog.cards.map((card, i) => ({
    key: card.id,
    rank: String(i + 1),
    suit: card.marker === "character" ? "★" : card.marker || "",
    color: card.marker === "character" ? "#426780" : "#304f40",
    name: card.name,
    text: card.text,
    image: `packs/capitalism-plus/${card.id}.png`,
  })),
  // No inferred game rules: players draw their own starting hands.
  setup: { smallHand: 0, largeHand: 0 },
  tokens: [],
};
for (const card of catalog.cards)
  await copyFile(
    new URL(`art/capitalism-plus/${card.artwork}`, root),
    new URL(`public/packs/capitalism-plus/${card.id}.png`, root),
  );
await writeFile(
  new URL("src/packs/capitalism-plus.json", root),
  JSON.stringify(pack, null, 2) + "\n",
);
console.log(`Built Capitalism Plus pack: ${pack.cards.length} cards.`);
