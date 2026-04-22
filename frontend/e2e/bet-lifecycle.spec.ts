import { expect, test } from "@playwright/test";

async function login(page, identifier: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="text"]').fill(identifier);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/markets$/);
}

test("bet lifecycle supports place and withdraw on a seeded open market", async ({ page, request }) => {
  const seeded = await request.post("/api/test-support/scenarios/bet-lifecycle");
  expect(seeded.ok()).toBeTruthy();
  const scenario = await seeded.json();

  await login(page, scenario.users.bettor.email, scenario.users.bettor.password);
  await page.goto(`/markets/${scenario.market.id}`);

  await expect(page.getByRole("heading", { name: scenario.market.title })).toBeVisible();
  await page.getByRole("button", { name: "YES" }).click();
  await page.locator("select").selectOption("2");
  await page.getByRole("button", { name: "Place Bet" }).click();

  await expect(page.getByRole("heading", { name: "Your Position" })).toBeVisible();
  await expect(page.locator("section")).toContainText("2 BP");

  await page.getByRole("button", { name: "Withdraw" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("heading", { name: "Place your bet" })).toBeVisible();
});
