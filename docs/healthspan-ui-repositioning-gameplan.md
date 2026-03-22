# Healthspan UI Repositioning Gameplan

## 1) Objective
Reposition the product from a "health service" feel to a "healthspan news and research publication" feel, while preserving current data ingestion and scalability.

## 2) Inputs Reviewed
- `Healthspan.report Plan.docx` (Phase 1 scope, feed strategy, wireframe phases, roadmap)
- `Health Span Final Deliverable Report (1).pdf` (report structure, source ecosystem, YouTube/podcast direction)
- Current Next.js codebase in this repo (component and route structure)
- Target Figma wireframe: `https://www.figma.com/design/CPKTvinjrI0g4FnEd0BGyT/Health-Span-Report-Plan?node-id=0-1&t=9G1H7YDqFRwuUuLK-1`
- Target Figma prototype: `https://www.figma.com/proto/CPKTvinjrI0g4FnEd0BGyT/Health-Span-Report-Plan?node-id=0-1&t=9G1H7YDqFRwuUuLK-1`

## 3) Strategic Repositioning
Current perception risk: the homepage and auth-prominent layout can read like a wellness product/service funnel.

Target perception:
- Editorial first
- Evidence and source transparency first
- Discovery and recirculation first
- Optional account features second

Brand voice shift:
- From: "Optimize your life with us"
- To: "Track the most important healthspan developments"

## 4) UX Direction (What Must Change)
### Homepage
- Lead with top stories, not service-style hero claims.
- Introduce newsroom patterns: "Latest", "Most Discussed", "Explainers", "Research Watch".
- De-emphasize signup CTAs above the fold.
- Keep ad placements, but align with editorial rhythm and avoid interrupting first content block.

### Article Cards
- Prioritize metadata: source, publish date, read time, evidence level.
- Add editorial labels: "Research", "Protocol", "Opinion", "Policy", "Podcast", "Video".
- Reduce marketing copy density.

### Article Detail Page
- Add source citation module and "What this means" summary block.
- Add related stories and topic cluster links.
- Add comments/discussion area (phase-gated).

### Global Navigation
- Nav taxonomy should reflect a publication.
- `Latest`, `Research`, `Protocols`, `Supplements`, `Lifestyle`, `Policy`, `Videos`, `Podcasts`.
- Move account actions to utility-level prominence (header right / mobile drawer footer).

## 5) Content and Source Plan
Based on provided plan/report, use a hybrid model:
- 80% automated ingestion via RSS and media feeds.
- 20% manual editorial curation and quality control.

Source onboarding phases:
- Phase A (MVP): 20-30 high-authority feeds.
- Phase B: add podcast and YouTube channels with quality thresholds.
- Phase C: introduce scorecards for source reliability and recency.

Editorial safeguards:
- Every article card shows original source.
- Duplicate/syndicated content suppression.
- Outdated content demotion after configurable time windows.

## 6) Figma <> Codex Workflow Plan (Core of Implementation)
### A. Figma to Codex (Design-to-Code)
1. Finalize frame-level wireframes for homepage, category page, article page, topic page, and mobile nav/cards.
2. In Figma, copy link to each target frame/node.
3. In Codex, run implementation prompts per frame:
   `Help me implement this Figma design in code, reusing existing components where possible.`
4. Use MCP `get_design_context` for layout/style/component extraction.
5. Generate in vertical slices (one route at a time), not a full-site rewrite.

### B. Codex to Figma (Code-to-Canvas Validation)
1. Run app locally and capture implemented screens with MCP `generate_figma_design`.
2. Push captures into a dedicated validation file in Figma.
3. Compare against target prototype.
4. Annotate deltas in Figma.
5. Pull deltas back into Codex for final refinements.

### C. Roundtrip Cadence
- Daily design-engineering sync with one locked checkpoint.
- 5:00 PM ET snapshot for "implemented vs intended" comparison.

## 7) Repo-Specific Execution Plan
This plan reuses existing structure and minimizes churn.

Likely primary touchpoints:
- `app/page.tsx` and `app/page.module.css` for homepage hierarchy shift
- `components/sections/HeroBanner.tsx` for editorial hero conversion
- `components/sections/ArticleGrid.tsx` and `components/ui/ArticleCard.tsx` for metadata-first card treatment
- `components/layout/Header.tsx` and `components/layout/MobileMenu.tsx` for nav taxonomy changes
- `app/articles/page.tsx` and `app/topics/[slug]/page.tsx` for category/topic experience upgrades

Data/ingestion pipeline appears ready for this pivot:
- Existing RSS routes and services under `app/api/rss/*` and `lib/rss/*`
- Existing topic and channel models under `lib/actions/*` and `supabase/migrations/*`

## 8) Delivery Phases with Calendar Dates
Assuming kickoff on Monday, March 9, 2026.

### Phase 0: Alignment and Audit (March 9-10, 2026)
- Lock IA, tone, and non-goals.
- Capture baseline UX metrics and screenshots.
- Confirm final Figma frames for build order.

### Phase 1: Editorial Homepage and Nav (March 11-17, 2026)
- Implement homepage structural shift.
- Update desktop/mobile navigation taxonomy.
- Replace service-forward hero with editorial top-story module.

### Phase 2: Article and Category System (March 18-24, 2026)
- Implement article detail template improvements.
- Implement category and topic listing alignment.
- Add source transparency components.

### Phase 3: Engagement Layer (March 25-31, 2026)
- Add comments/discussion placeholders and recirculation modules.
- Add save/read-later UX if in-scope.
- Tune ad placement and feed rhythm.

### Phase 4: QA, Accessibility, Handoff (April 1-4, 2026)
- Responsive QA and accessibility sweep.
- Figma/code parity review.
- Final handoff packet and launch checklist.

## 9) Presentation Deck Structure (Recommended)
Use this as the gameplan presentation outline.

1. Problem statement and business risk
2. Target positioning and editorial principles
3. Current-state UX audit (before screenshots)
4. Target-state wireframes/prototype walkthrough
5. Figma<>Codex workflow (roundtrip model)
6. Delivery phases and timeline (dated)
7. Technical approach in current repo
8. Risks and mitigations
9. Success metrics and launch gates
10. Decisions required from stakeholders

## 10) Risks and Mitigations
- Risk: UI stays too service-like due to hero copy and auth prominence.
- Mitigation: editorial hierarchy gate in design review checklist.

- Risk: Figma-code drift during rapid iteration.
- Mitigation: daily code-to-canvas checkpoint with MCP capture.

- Risk: content quality inconsistency from automated feeds.
- Mitigation: source whitelist + manual curation lane + duplicate filtering.

- Risk: scope expansion (AI summaries, premium, social) before MVP UX is stable.
- Mitigation: strict phase gates; advanced features remain roadmap items.

## 11) Success Metrics (MVP Stage)
- Editorial discovery
- Home-to-article click-through rate
- Pages/session
- Return visitor rate

- Engagement
- Average engaged time per session
- Comments or interactions per 100 visits
- Save/read-later usage (if launched)

- Content reliability
- Feed freshness SLA
- Source coverage by category
- Duplicate rate

## 12) Decisions Needed Before Build Starts
- Final category taxonomy approval
- Comment system decision (placeholder now vs integrated now)
- Ad density limits on homepage and article pages
- MVP definition for March-April 2026 launch window
- Who owns editorial curation workflow

## 13) Non-Goals for This Planning Cycle
- Full monetization architecture rollout
- Full AI summarization production rollout
- Full premium tier implementation
- Complete CMS migration

These remain post-MVP roadmap items after editorial UX repositioning is validated.
