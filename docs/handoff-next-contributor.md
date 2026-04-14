# Healthspan Project Handoff (Next Contributor)

Last updated: 2026-04-10  
Repo: `Crowreport/healthspan.report`  
Prepared from branch + commit history and current codebase state.

## 1) Current Snapshot

1. Active remote `main` commit is `8f7c1fd` (`feat: fix article centering`).
2. `devarth-preview` is currently `27` commits behind `origin/main` and `1` commit ahead.
3. The `1` ahead commit is `ad2188e` (`chore: trigger PR for devarth-preview`) and is an empty operational commit used to make PR comparison non-empty.
4. Most functional UI work from `figma-step-by-step-implementation` is already in `origin/main` via merge flow (including PR #11 merge commit `01b1226`).

## 2) What Was Delivered (Devarth Work)

Main design and frontend delivery window: 2026-03-15 to 2026-03-30.

1. `0f2efc8` implemented Figma-aligned redesign for articles/videos plus footer redesign.
2. `34e2976` rebalanced footer/form layout proportions.
3. `7bfed18` advanced article page structure and added implementation strategy doc.
4. `7aa80f6` shifted homepage to a media-first feed model and refined desktop article flow.
5. `d8186cf` unified typography and styling across routes (about/research/topics/videos/home/articles).
6. `6aabd95` introduced appearance system with light/dark/system theme toggle and global styling hooks.
7. `943083f` added alignment polish after teammate sync feedback.
8. `812d6d6` merged teammate `homepage-dev` changes into `figma-step-by-step-implementation`.
9. `32a1c96` resolved lint blockers after homepage merge.
10. `ec3d9d4` hardened thumbnail/image fallback behavior across cards and homepage feed rendering.

## 3) Key Files And Systems

### UI/UX Repositioning Foundation

1. `docs/healthspan-ui-repositioning-gameplan.md` contains product direction and design-to-code workflow.
2. `app/page.tsx` and `app/page.module.css` hold homepage feed composition and source mapping.
3. `app/articles/page.tsx` and `app/articles/page.module.css` hold article feed page with lead-story + latest coverage layout.
4. `components/ui/ThemeToggle.tsx` and `components/ui/ThemeToggle.module.css` implement appearance preferences.
5. `components/layout/Header.tsx` and `components/layout/MobileMenu.tsx` integrate theme controls in desktop/mobile nav.
6. `components/layout/Footer.tsx` and `components/layout/Footer.module.css` implement redesigned footer/subscription/suggestions areas.

### RSS And Data Pipeline

1. `app/api/rss/route.ts` serves RSS with database-first, cache fallback, and direct feed fallback behavior.
2. `app/api/rss/items/route.ts` serves persisted normalized RSS items from DB.
3. `app/api/rss/ingest/route.ts` triggers ingestion process and supports cron/webhook/admin-style triggers.
4. `app/api/rss/seed/route.ts` seeds sources from `data/feeds.json`.
5. `app/api/rss/status/route.ts` returns operational ingestion stats/log snapshots.
6. `data/feeds.json` defines source catalog (video/topic/article/research feeds).

### Auth And User Flows

1. `utils/supabase/client.ts` and `utils/supabase/server.ts` are the Supabase client/server entry points.
2. `app/signup/page.tsx`, `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` are core auth pages.
3. `app/api/auth/confirm/route.ts` handles email verification callbacks.

## 4) Required Environment Variables

No `.env.example` exists yet. Current code expects:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `NEXT_PUBLIC_SITE_URL`
4. `CRON_SECRET` (required for non-dev authorized calls to `/api/rss/ingest` and `/api/rss/seed`)

## 5) Local Runbook

1. Install deps: `npm install`
2. Start app: `npm run dev`
3. Lint: `npm run lint`
4. Open app: `http://localhost:3000`
5. Verify feeds: `GET /api/rss?type=article` and `GET /api/rss/status`
6. Trigger seed (dev): `POST /api/rss/seed`
7. Trigger ingestion (dev): `POST /api/rss/ingest`

## 6) Branch/PR Notes

1. `figma-step-by-step-implementation` remote currently points to `214a70b` and is behind `origin/main`.
2. `devarth-preview` contains only the empty PR-trigger commit beyond `main` ancestry.
3. For real feature work, branch from up-to-date `origin/main` before implementing.
4. Avoid opening PRs from stale branches that are already fully contained in `main`.

## 7) Known Issues / Risks

1. `types/rss.ts` includes `RSSContentType = "article" | "video" | "topic" | "research"`, while `types/database.ts` restricts DB `RSSContentType` to `"article" | "video" | "topic"`. This type mismatch can create ingestion or query drift for research feeds.
2. `app/forgot-password/page.tsx` has mojibake text for the back arrow (`â†`) and should be normalized to a clean character/string.
3. `.env.example` is missing, making onboarding slower and increasing setup error risk.
4. Local `main` branch may lag behind `origin/main` if not frequently fetched/rebased.

## 8) Recommended First 2 Hours For The Next Contributor

1. Sync to latest `origin/main` and create a fresh feature branch.
2. Add `.env.local` with required keys and verify auth flow endpoints.
3. Run and verify `GET /api/rss/status` plus one manual ingestion trigger.
4. Resolve the `RSSContentType` mismatch decision (either support `research` end-to-end in DB types/queries, or remove/transform it consistently).
5. Fix the mojibake arrow text in forgot-password UI.
6. Add a minimal `.env.example` documenting required variables.

## 9) Suggested Next PR Scope

1. Add `.env.example` and setup notes.
2. Normalize `RSSContentType` across `types/rss.ts` and `types/database.ts` with matching ingestion logic.
3. Patch text encoding issue in forgot-password page.
4. Add a short QA checklist for RSS fallback + theme toggle regression checks.
