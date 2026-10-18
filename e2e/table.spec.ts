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
