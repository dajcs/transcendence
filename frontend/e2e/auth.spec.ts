import { expect, test } from "@playwright/test";

const PASSWORD = "Password123";

test("auth flow supports register, login, and logout", async ({ page, request }) => {
  const reset = await request.post("/api/test-support/reset");
  expect(reset.ok()).toBeTruthy();

  const unique = Date.now();
  const email = `e2e-auth-${unique}@example.com`;
  const username = `e2eauth${unique}`;

  await page.goto("/register");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  await page.waitForURL(/\/login\?registered=1$/);

  await page.locator('input[type="text"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  await page.waitForURL(/\/markets$/);
  await expect(page.getByRole("link", { name: `@${username}` })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL((url) => url.pathname === "/login");
  await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
});
