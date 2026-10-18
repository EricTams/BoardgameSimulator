# Gather — BoardgameSimulator

A small browser tabletop for friends. The app keeps the cards in sync; players decide whose turn it is and what the rules allow.

**Play:** https://erictams.github.io/BoardgameSimulator/

## Games and testing

The host can select **Go Fish**, **Capitalism Plus**, or **Garden Club** in the lobby. Capitalism Plus includes all 69 cards from the October 18, 2026 set with transparent original-pixel artwork and transcribed text. Ten Hens includes a thin frame around its cropped artwork. It starts with a shuffled deck and empty hands; players draw and set up as they prefer. Select a card in your hand, or tap a face-up table card, then choose **Read card** for its full text.

Under the deck, open **Deck options → Display all cards face up**. This host-controlled testing option is off by default and shows the full pack to every player in a searchable face-up spread. It does not move cards, reveal hand ownership, or expose draw order. Turning it off removes the spread from every screen. The setting survives a host reload.

To update prototype artwork/text, edit the source catalog, regenerate with `node scripts/extract-capitalism.mjs`, and then run `node scripts/build-capitalism-pack.mjs`. The last command copies the illustrations into the published app and generates its pack definition. Replace those illustration files and update the pack definition directly if new artwork is already prepared.

## First playable

- Create a table and invite friends with a room code, link, or QR code. Up to 8 seats; no accounts.
- Host plays at the same table. Deal Go Fish (7 cards each for up to 3 players, 5 for larger groups).
- Private hands, shared draw pile, and a freely arranged table.
- Select multiple cards to give to another player or play face up/down.
- Tap a table card to flip it, take it into your hand, or return it to the top of the deck.
- Drag table cards and tokens; focused pieces also move with the arrow keys.
- Shuffle the remaining draw pile, or have the host gather and redeal everything.
- Reconnect after a reload without losing your hand. Late joiners start with empty hands; draw manually or redeal together.
- Load declarative JSON game packs before dealing. An example is in `public/packs/garden.json`.

Talk across the room or on your usual voice call. There is no built-in chat, automatic scoring, turn enforcement, or verification of Go Fish requests.

## Run locally

Use Node.js 24 or later.

```sh
npm ci
npm run dev
```

Open the printed address. Local development includes a WebSocket relay, so multiple tabs and devices work without a third-party signaling service. For phones on the same Wi-Fi, use the printed **Network** URL on the host before creating/sharing an invitation. Allow Node through the host computer's firewall if prompted.

For a quick two-player test, create a table in one tab and open its invitation in a second tab. Each tab has its own identity. Create/join buttons require a name. You can also deal a practice hand with one player.

```sh
npm test                 # Game state, privacy, reconnect identity, packs
npm run test:relay       # Real WebSocket routing and host recovery
npm run build           # Type check and production bundle
```

Browser smoke tests use Playwright. Install its browser with `npx playwright install chromium`, start `npm run dev -- --port 5186 --strictPort`, and run `npm run test:e2e` in another terminal. Set `TEST_URL` (with a trailing slash for a subdirectory) to test another local or deployed build.

## Hosting and networking

Inspired by [ArtSlicer](https://github.com/EricTams/ArtSlicer): a host-owned room, code/QR invitations, filtered per-player views, and a replaceable transport. Clients send actions; the host processes them serially and sends each person their permitted view. Only the host knows all hands and deck order. The relay does not run game logic.

**GitHub Pages:** `.github/workflows/deploy.yml` tests, builds, and deploys `main`. Without a configured relay, it uses PeerJS's public signaling service and WebRTC data connections. Some cellular, corporate, and guest networks require TURN or the WebSocket relay. The UI reports the active transport. This version does not automatically switch between transports.

**Self-host with the included relay:**

```sh
VITE_TRANSPORT=relay npm run build
npm start
```

This serves the app and `/rooms` WebSocket endpoint on port 4173 (override with `PORT`). Put it behind HTTPS/WSS for public deployment. To use that relay from GitHub Pages, set the GitHub repository variable `RELAY_URL` to `wss://your-host/rooms` and rebuild. Alternatively configure TURN using the variables in `.env.example`. Client-side TURN credentials are visible in the bundle and should be limited-scope.

## Game packs

Before dealing, the host can use **Load a game pack** to select a JSON file. The pack is sent through the host; everyone gets the same artwork definitions for the cards they can see. No custom scripts execute.

Fields: `id`, `name`, `description`, `backColor`, `cards`, `setup`, and `tokens`. Each card has a unique `key`, a short `rank`/`suit`, hex `color`, and optional `name`, `text`, and `image`. Images can be HTTPS URLs or bundled paths such as `packs/capitalism-plus/lizard-pal.png`. Images must be hosted somewhere all players can reach. Setup defines `smallHand` (up to 3 players) and `largeHand` (4–8). Tokens define `label`, `color`, and `count` and can be freely moved. Limits: 200 cards, 20 token types, 10 copies per token type, and a 500 KB JSON file.

This first version supports card and token packs; custom board backgrounds, pack authoring UI, ZIP assets, complex setup scripts, and a marketplace are future work.

## Trust and persistence

- The host device is trusted and must stay open. Backgrounding or sleeping the host can interrupt everyone; use a laptop for longer games.
- Host snapshots and player seat secrets live in per-tab session storage. Reloading the same tab restores the room. Closing/leaving a tab or clearing browser data may lose that session; there is no automatic host migration or cloud save.
- Room codes are invitations, not passwords. Share them with your intended players.
- Other clients do not receive opponents' card identities or deck order. Face-down table pieces use opaque IDs. The host still knows all cards.
- Shared pieces can be moved by anyone. The app prevents duplicate card ownership, invalid messages, and unauthorized access to private hands, but deliberately leaves game rules to players.
- A disconnected player keeps their seat and cards. This prototype has no seat removal/reassignment UI.

## Layout

`src/game.ts` contains the pure action reducer and per-player view projection. `src/useTable.ts` owns sessions and host coordination. `src/network.ts` implements relay and PeerJS transports. `src/App.tsx` is the shared player interface. `server/relay.mjs` routes WebSocket messages and is reused by Vite and the production server.
