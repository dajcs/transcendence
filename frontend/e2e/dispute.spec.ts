import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="text"]').fill(identifier);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/markets$/);
}

test("dispute flow escalates a proposer resolution into community vote", async ({ page, request }) => {
  const seeded = await request.post("/api/test-support/scenarios/dispute");
  expect(seeded.ok()).toBeTruthy();
  const scenario = await seeded.json();

  await login(page, scenario.users.bettor.email, scenario.users.bettor.password);
  await page.goto(`/markets/${scenario.market.id}`);

  const resolutionSection = page.getByRole("heading", { name: "Resolution" }).locator("..");
  await expect(page.getByRole("heading", { name: scenario.market.title })).toBeVisible();
  await page.getByRole("button", { name: "Dispute Resolution (1 BP)" }).click();
  await page.getByRole("button", { name: "Yes" }).click();

  await expect(page.getByRole("heading", { name: "Community Vote" })).toBeVisible();
  await expect(resolutionSection).toContainText("Status:");
  await expect(resolutionSection).toContainText("disputed");
});
