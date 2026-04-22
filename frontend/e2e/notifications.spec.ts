import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="text"]').fill(identifier);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/markets$/);
}

test("notification bell opens seeded notifications and routes to the linked market", async ({ page, request }) => {
  const seeded = await request.post("/api/test-support/scenarios/notifications");
  expect(seeded.ok()).toBeTruthy();
  const scenario = await seeded.json();

  await login(page, scenario.users.bettor.email, scenario.users.bettor.password);

  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Review the proposer resolution for this market.")).toBeVisible();

  await page.getByText("Review the proposer resolution for this market.").click();
  await page.waitForURL(new RegExp(`/markets/${scenario.market.id}$`));
  await expect(page.getByRole("heading", { name: scenario.market.title })).toBeVisible();
});
