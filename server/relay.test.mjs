import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { attachRelay } from "./relay.mjs";

test("relay routes privately, rejects room takeover, and supports host recovery", async () => {
  const server = createServer();
  const wss = attachRelay(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}/rooms`;
  const sockets = [];
  async function open(role, key = "host-secret-123456") {
    const ws = new WebSocket(url);
    sockets.push(ws);
    await once(ws, "open");
    ws.send(JSON.stringify({ t: "join", role, key, code: "TEST" }));
    return ws;
  }
  const message = async (ws) =>
    JSON.parse((await once(ws, "message"))[0].toString());
  try {
    const host = await open("host");
    assert.equal((await message(host)).t, "ready");
    const hostOpen = message(host);
    const client = await open("client");
    assert.equal((await message(client)).t, "ready");
    const { id } = await hostOpen;
    const got = message(host);
    client.send(JSON.stringify({ t: "send", data: { action: "draw" } }));
    assert.deepEqual(await got, { t: "message", id, data: { action: "draw" } });
    const reply = message(client);
    host.send(JSON.stringify({ t: "send", id, data: { hand: ["private"] } }));
    assert.deepEqual(await reply, {
      t: "message",
      data: { hand: ["private"] },
    });
    const attacker = await open("host", "different-secret-123456");
    assert.equal((await once(attacker, "close"))[0], 4001);
    const clientClose = once(client, "close");
    const hostClose = once(host, "close");
    host.close();
    await hostClose;
    assert.equal((await clientClose)[0], 4002);
    const resumed = await open("host");
    assert.equal((await message(resumed)).t, "ready");
  } finally {
    for (const ws of sockets) ws.terminate();
    wss.close();
    server.close();
  }
});
