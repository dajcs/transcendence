---
status: fixing
trigger: "chat-route-404: Navigating to /chat/[userId] returns 404 even though the route file exists"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T10:25:00Z
---

## Current Focus

hypothesis: CONFIRMED — Turbopack dev cache missing chat/[userId] route registration
test: clear Turbopack cache in container and restart dev server
expecting: after cache clear and restart, Turbopack rescans routes and compiles chat/[userId]
next_action: clear /app/.next/dev/cache/turbopack in container and restart frontend container

## Symptoms

expected: Clicking a friend opens /chat/[uuid] and shows the chat interface
actual: /chat/4aa5c8aa-70aa-4473-b0f3-f939e68d0e08 returns 404
errors: "GET /chat/4aa5c8aa-70aa-4473-b0f3-f939e68d0e08 404 in 84ms" in frontend logs
reproduction: Go to /friends, click on a friend to start a chat, gets redirected to /chat/[uuid] → 404
started: Route file exists (frontend/src/app/(protected)/chat/[userId]/page.tsx) but returns 404

## Eliminated

- hypothesis: middleware blocking the route
  evidence: with Cookie: access_token=fake, /markets/[id] returns 200 but /chat/[userId] returns 404 — middleware is not the differentiator
  timestamp: 2026-03-30T10:10:00Z

- hypothesis: route file missing or misconfigured
  evidence: routes-manifest.json correctly registers /chat/[userId] regex; page file exists in container; build artifacts present in .next/server/app/(protected)/chat/[userId]/
  timestamp: 2026-03-30T10:12:00Z

- hypothesis: production build issue
  evidence: container runs npm run dev (Turbopack), NOT npm start — it uses dev build in .next/dev/
  timestamp: 2026-03-30T10:15:00Z

## Evidence

- timestamp: 2026-03-30T10:10:00Z
  checked: curl with auth cookie to /chat/UUID vs /markets/UUID
  found: /chat/UUID → 404, /markets/UUID → 200 (both dynamic UUID routes under (protected))
  implication: issue is specific to chat/[userId] route, not general dynamic routing

- timestamp: 2026-03-30T10:15:00Z
  checked: docker inspect + container logs
  found: container runs "npm run dev" (next dev with Turbopack 16.2.1), not npm start
  implication: routing is handled by Turbopack dev server, not production build

- timestamp: 2026-03-30T10:18:00Z
  checked: /app/.next/dev/server/app-paths-manifest.json
  found: "/(protected)/chat/[userId]/page" is ABSENT from the manifest; "/(protected)/markets/[id]/page" IS present
  implication: Turbopack never registered/compiled the chat/[userId] route

- timestamp: 2026-03-30T10:20:00Z
  checked: /app/.next/dev/cache/turbopack (LevelDB .sst files)
  found: Turbopack cache exists with SST files from prior sessions; stale cache likely missing or corrupting chat/[userId] route entry
  implication: Clearing the Turbopack cache will force full route rescan

- timestamp: 2026-03-30T10:22:00Z
  checked: RSC payload of 404 response for /chat/test-user-123
  found: route tree shows _not-found rendered for third segment; "c":["","chat","test-user-123"] resolved to /_not-found
  implication: Confirms Turbopack has no knowledge of [userId] segment under chat/

## Resolution

root_cause: Turbopack dev server (Next.js 16.2.1) has a stale route cache (.next/dev/cache/turbopack) that does not include the chat/[userId] route in the app-paths-manifest. As a result, any request to /chat/[UUID] falls through to _not-found (404). The production build routes-manifest correctly registers the route, but the dev server ignores it and uses its own compiled route graph, which is incomplete.
fix: clear Turbopack cache by deleting .next/dev/cache/turbopack and restart the dev server so it rescans all routes from source
verification:
files_changed: []
