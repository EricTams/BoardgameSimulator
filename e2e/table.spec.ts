import { expect, test } from "@playwright/test";

test("three players draw, give, play, flip, pick up, and reconnect", async ({
  browser,
}) => {
  const contexts = [
    await browser.newContext(),
    await browser.newContext(),
    await browser.newContext(),
  ];
  const host = await contexts[0].newPage(),
    bob = await contexts[1].newPage(),
    cara = await contexts[2].newPage();
  const errors: string[] = [];
  for (const page of [host, bob, cara])
    page.on("pageerror", (e) => errors.push(e.message));
  try {
    await host.goto("./");
    await host.getByLabel("First, what should we call you?").fill("Alice");
    await host.getByRole("button", { name: "Create a table" }).click();
    await expect(host.getByText("Table online")).toBeVisible();
    const code = await host.locator(".room-code").innerText();
    for (const [page, name] of [
      [bob, "Bob"],
      [cara, "Cara"],
    ] as const) {
      await page.goto(`./#/join/${code}`);
      await page.getByLabel("First, what should we call you?").fill(name);
      await page.getByRole("button", { name: "Join table" }).click();
      await expect(page.getByText("Table online")).toBeVisible();
    }
    await expect(host.locator(".seat")).toHaveCount(3);
    await host
      .getByRole("button", { name: "Shuffle & deal", exact: true })
      .click();
    for (const page of [host, bob, cara])
      await expect(page.locator(".hand-card")).toHaveCount(7);
    await bob
      .getByRole("button", { name: "Draw a card, 31 remaining" })
      .click();
    await expect(bob.locator(".hand-card")).toHaveCount(8);
    await expect(
      host.getByRole("button", { name: "Draw a card, 30 remaining" }),
    ).toBeVisible();
    await bob.locator(".hand-card").nth(0).click();
    await bob.locator(".hand-card").nth(1).click();
    await bob
      .getByLabel("Give cards to player")
      .selectOption({ label: "Cara" });
    await bob.getByRole("button", { name: "Give", exact: true }).click();
    await expect(bob.locator(".hand-card")).toHaveCount(6);
    await expect(cara.locator(".hand-card")).toHaveCount(9);
    await cara.locator(".hand-card").first().click();
    await cara.getByRole("button", { name: "Face down", exact: true }).click();
    await expect(
      host.getByRole("button", { name: "Face-down card on table" }),
    ).toBeVisible();
    await host.getByRole("button", { name: "Face-down card on table" }).click();
    await host.getByRole("button", { name: "Flip", exact: true }).click();
    await expect(bob.locator(".table-card .suit-center")).toBeVisible();
    await host.getByRole("button", { name: "To my hand", exact: true }).click();
    await expect(host.locator(".hand-card")).toHaveCount(8);
    await expect(cara.locator(".table-card")).toHaveCount(0);
    const handBefore = await bob
      .locator(".hand-card")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
    await bob.reload();
    await expect(bob.locator(".hand-card")).toHaveCount(6);
    expect(
      await bob
        .locator(".hand-card")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label"))),
    ).toEqual(handBefore);
    await host.reload();
    await expect(host.locator(".hand-card")).toHaveCount(8);
    await expect(bob.getByText("Table online")).toBeVisible({ timeout: 20000 });
    await expect(cara.getByText("Table online")).toBeVisible({
      timeout: 20000,
    });
    await expect(host.locator(".seat")).toHaveCount(3);
    await host.screenshot({
      path: "test-results/table-desktop.png",
      fullPage: true,
    });
    await cara.setViewportSize({ width: 390, height: 844 });
    await cara.screenshot({
      path: "test-results/table-mobile.png",
      fullPage: true,
    });
    expect(
      await cara.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for (const c of contexts) await c.close();
  }
});

test("custom pack loads, deals and shows movable tokens", async ({ page }) => {
  await page.goto("./");
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("First, what should we call you?").fill("Gardener");
  await page.getByRole("button", { name: "Create a table" }).click();
  await expect(page.getByText("Table online")).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/packs/garden.json");
  await expect(page.locator(".room-heading h1")).toContainText("Garden Club");
  await page.getByRole("button", { name: "Deal a practice hand" }).click();
  await expect(page.locator(".hand-card")).toHaveCount(4);
  await expect(page.locator(".token")).toHaveCount(4);
  await page.locator(".token").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".token").first()).toHaveCSS("left", /.+/);
});

test("host selects Capitalism Plus and displays prototype cards face up for everyone", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  try {
    await host.goto("./");
    await host
      .getByLabel("First, what should we call you?")
      .fill("Prototype host");
    await host.getByRole("button", { name: "Create a table" }).click();
    await expect(host.getByText("Table online")).toBeVisible();
    await host.getByLabel("Choose a game").selectOption("capitalism-plus");
    await expect(host.locator(".room-heading h1")).toContainText(
      "Capitalism Plus",
    );
    const code = await host.locator(".room-code").innerText();
    await guest.goto(`./#/join/${code}`);
    await guest
      .getByLabel("First, what should we call you?")
      .fill("Prototype guest");
    await guest.getByRole("button", { name: "Join table" }).click();
    await expect(guest.locator(".room-heading h1")).toContainText(
      "Capitalism Plus",
    );
    await expect(guest.getByLabel("Choose a game")).toHaveCount(0);
    await expect(host.locator(".deck-spread")).toHaveCount(0);
    await host.getByText("Deck options", { exact: true }).click();
    await host.getByLabel("Display all cards face up", { exact: true }).check();
    await expect(host.locator(".spread-card")).toHaveCount(69);
    await expect(guest.locator(".spread-card")).toHaveCount(69);
    await expect(guest.locator(".spread-card .card-title")).toHaveCount(69);
    await expect(guest.locator(".spread-card .card-rules")).toHaveCount(69);
    await expect(guest.locator(".spread-card > strong, .spread-card > p")).toHaveCount(0);
    for (const [name, symbol] of [["Coin", "¢"], ["Ten Hens", "F"], ["Lizard Pal", "I"], ["Heist", "S"]]) {
      await expect(guest.getByRole("button", { name: `Read ${name}`, exact: true }).locator(".card-title > span")).toHaveText(symbol);
    }
    await guest
      .locator(".spread-card img")
      .evaluateAll((images) =>
        Promise.all(images.map((i) => (i as HTMLImageElement).decode())),
      );
    expect(
      await guest
        .locator(".spread-card img")
        .evaluateAll((images) =>
          images.every((i) => (i as HTMLImageElement).naturalWidth > 0),
        ),
    ).toBe(true);
    await guest.getByLabel("Search face-up cards").fill("Lizard Pal");
    await expect(guest.locator(".spread-card")).toHaveCount(1);
    await guest
      .getByRole("button", { name: "Read Lizard Pal", exact: true })
      .click();
    await expect(guest.locator("dialog")).toContainText(
      "Block a targeted card or steal 2 cards.",
    );
    await expect(guest.locator("dialog").getByText("Lizard Pal", { exact: true })).toHaveCount(1);
    await expect(guest.locator("dialog .card-rules")).toHaveCount(1);
    await expect(guest.locator("dialog .card-title > span")).toHaveText("I");
    const artworkWidth = await guest.locator("dialog .named-card").evaluate(card => {
      return card.querySelector("img")!.getBoundingClientRect().width / card.getBoundingClientRect().width;
    });
    expect(artworkWidth).toBeGreaterThan(.85);
    await guest.getByRole("button", { name: "Close dialog" }).click();
    await guest.getByLabel("Search face-up cards").fill("");
    await host.getByText("Deck options", { exact: true }).click();
    await host.getByRole("button", { name: "Shuffle & open table" }).click();
    await expect(
      guest.getByRole("button", { name: "Draw a card, 69 remaining" }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "Draw a card, 69 remaining" })
      .click();
    await expect(guest.locator(".hand-card")).toHaveCount(1);
    await expect(guest.locator(".spread-card")).toHaveCount(69);
    await guest.locator(".hand-card").click();
    await guest.getByRole("button", { name: "Read card", exact: true }).click();
    await expect(guest.locator(".card-detail img")).toBeVisible();
    await guest.getByRole("button", { name: "Close dialog" }).click();
    await guest
      .getByRole("button", { name: "Play to table", exact: true })
      .click();
    await expect(host.locator(".table-card .named-card")).toHaveCount(1);
    await host.screenshot({
      path: "test-results/capitalism-game-desktop.png",
      fullPage: true,
    });
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.screenshot({
      path: "test-results/capitalism-game-mobile.png",
      fullPage: true,
    });
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await host.reload();
    await expect(host.locator(".spread-card")).toHaveCount(69);
    await expect(guest.getByText("Table online")).toBeVisible({
      timeout: 20000,
    });
    await host.getByText("Deck options", { exact: true }).click();
    await host
      .getByLabel("Display all cards face up", { exact: true })
      .uncheck();
    await expect(guest.locator(".deck-spread")).toHaveCount(0);
    await expect(
      guest.getByRole("button", { name: "Draw a card, 68 remaining" }),
    ).toBeVisible();
    await expect(guest.locator(".table-card")).toHaveCount(1);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
