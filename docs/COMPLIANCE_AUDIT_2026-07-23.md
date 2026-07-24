# Scena Compliance Audit — API / Database / UI

**Date:** 2026-07-23
**Scope:** Full-surface compliance sweep of the manager portal and kiosk display —
API↔UI contract, database↔API contract, per-route element completeness, design-system
consistency, and WCAG 2.1 AA accessibility.
**Baseline commit at audit start:** `ac74683` (v1.0.16).
**Method:** five parallel read-only audits, every finding independently re-verified against
source or the live database before being recorded here. Findings that could not be
re-verified are marked as such.

> **Concurrency note.** A second session was committing to this repository during the
> audit window, shipping `v1.0.17` (18:18) and `v1.0.18` (18:47). Some fixes described
> below were authored during this audit but landed inside those commits. Line numbers
> cited are accurate as of the commit noted with each finding.

---

## 0. Correction to the prior session's handoff

The v1.0.16 handoff recorded a "critical runtime bug — `EditorShell.tsx` imports
`IconButton` from `Menu.tsx`, which does not export it," and recommended reverting
the release.

**This was not real.** `IconButton` is exported from `src/components/ui/Button.tsx:48`,
and `EditorShell.tsx:14` imports it from `../ui/Button` — not from `Menu.tsx`. No revert
was required and none was performed. v1.0.16 was sound.

---

## 1. Architecture — the two disconnected data models

This is the single most consequential finding of the audit.

The board editor and the kiosk display are **two separate object graphs with no code path
between them**:

| | Editor | Kiosk |
|---|---|---|
| Tables | `boards` → `board_scenes` → `scene_elements` | `display_sessions` → `display_layouts` → `display_layout_tiles` → `scenes` |
| Content model | 15 element types | `scene_type` of `menu` or `powerpoint` |
| Generated types | `src/shared/scena-database.types.ts` | `src/shared/database.types.ts` |

`src/display/DisplayRoute.tsx` `TileContent` renders only `scene_type === "menu"` and
`scene_type === "powerpoint"`, and returns `null` for everything else. **No Board element
of any of the 15 types can currently appear on a screen.**

This is disclosed honestly rather than faked: `SCENA_UI_API_CAPABILITIES.boards.publish`
is `false` (`src/services/scena-api/capabilities.ts:16`) and the landing page states
plainly that publishing a Board to a Display is still being built. That is the correct
posture — but it means the product's primary authoring surface currently produces output
nothing can consume.

**Recommendation:** treat "Board → Display publish path" as the top roadmap item. Until it
exists, the editor's value to a customer is zero.

---

## 2. Database ↔ API compliance

Verified directly against the live Supabase project via MCP.

### 2.1 Clean

- **All 38 public tables have RLS enabled.**
- The four tables flagged `rls_enabled_no_policy` (`billing_events`,
  `billing_notification_outbox`, `media_workers`, `screen_pairing_codes`) have **zero
  client references** — they are correctly service-role-only. The advisories are
  informational, not defects.
- The UI correctly supplies `scene_elements.render_mode` on every insert
  (`BoardEditorPage.tsx:133,158`), which matters because the column is `NOT NULL` with no
  default and a three-value CHECK.

### 2.2 The UI is far behind the schema

`scene_elements.config` is `jsonb` constrained only by `jsonb_typeof(config) = 'object'`.
**This is why shape variants and borders required no migration** — the schema was already
permissive enough.

Schema capability with no UI to reach it:

| Column / constraint | Allowed values | UI status |
|---|---|---|
| `board_scenes.duration_ms` | 1 000 – 86 400 000 | Displayed in the scene strip, **not editable** |
| `board_scenes.transition_type` | `none`, `fade`, `slide_left`, `slide_right`, `zoom`, `dissolve` | Displayed, **not editable** |
| `board_scenes.transition_config` | jsonb | No UI |
| `board_scenes.background` | jsonb | No UI |
| `board_scenes.is_hidden` | boolean | Displayed, **not editable** |
| `boards.archived_at` | timestamptz | Referenced only in generated types |
| `scene_elements.name` | text | No UI field |
| `scene_elements.render_mode` | `static`, `live`, **`interactive`** | `interactive` is never produced by any UI path |
| `display_automations.action_type` | 8 actions | Partially exposed |
| `assets.asset_kind` | 8 kinds incl. `video`, `audio`, `font` | Capabilities deliberately restrict uploads to image/pdf/powerpoint — consistent and documented |

### 2.3 Security advisories requiring a decision

- **6 `SECURITY DEFINER` functions are executable by the `authenticated` role**:
  `accept_team_invitation`, `board_snapshot`, `create_board_revision`,
  `create_team_invitation`, `revoke_team_invitation`, `save_board_draft`.
  These are reachable at `/rest/v1/rpc/<name>`. Confirm each is intended to be
  directly callable by any signed-in user; otherwise `REVOKE EXECUTE` or switch to
  `SECURITY INVOKER`.
- **Leaked-password protection is disabled** in Supabase Auth. Enabling it costs nothing
  and blocks known-compromised passwords.

*No database change was made during this audit. Per repository policy, Git operations
never imply schema changes.*

---

## 3. Edge Function deployment drift

The repository contains 16 function directories; **12 are deployed**.

| Function | Deployed | UI callers | Assessment |
|---|---|---|---|
| `automations-run` | **No** | n/a (worker) | **Automations never fire.** See §4.1 |
| `presentation-callback` | **No** | n/a (LXC callback) | Only path that moves a presentation to `ready`/`failed`; `presentation-upload` *is* deployed, so this pipeline is broken mid-way |
| `screen-credential-rotate` | **No** | **none** | Complete, orphaned in both directions |
| `marquee-sso` | n/a | none | **Empty, untracked directory** carrying the forbidden legacy product name — removed during this audit |

The three undeployed functions are complete implementations, not stubs.
`automations-run` documents its own non-deployment as pending `pg_cron` approval.

---

## 4. Truthfulness violations

The codebase generally holds a high standard here — the landing page, `MembersPage`,
`SettingsIndexPage`, and `BillingPage` all explicitly decline to render controls whose
backends don't exist. Two places break that standard.

### 4.1 Automations imply scheduling that never happens — **SEV1**

`src/pages/automations/AutomationsPage.tsx` is a full 417-line CRUD surface. A user can
create a cron or one-shot automation, see it listed as enabled, and reasonably believe it
will run. It will not: the `automations-run` worker is not deployed, and nothing else
executes automations.

**Fix:** either deploy the worker, or disclose the limitation in the UI as clearly as the
landing page discloses the publish gap.

### 4.2 Billing prices are hardcoded in the UI — **SEV2**

`src/pages/billing/BillingPage.tsx:21-26` hardcodes offering names and prices
(`"Plus Team Workspace — $15/month"`, etc.) as a literal, while `listActiveOfferings()` /
`listActivePlans()` in `src/domain/billing.ts` exist to read the live `plans` table and are
never called. The displayed price can silently diverge from the price actually charged by
Stripe.

**Fix:** render the catalog from `plans`.

---

## 5. Coverage: the Layouts gap

`src/domain/layouts.ts` implements a complete backend — `listLayouts`, `createLayout`,
`updateLayout`, `deleteLayout`, `duplicateLayout`, `getRenderableLayout`, `addTile`,
`updateTile`, `removeTile`, `reorderTileLayers`. **Nine of these ten had zero callers.**
There was no route, no nav entry, and no page. The only reference anywhere was a read-only
`<Select>` of layout names inside the automation modal.

This compounded into a total product failure:

- Layouts could not be created from the UI (`createLayout` — 0 call sites).
- `display_session_screens.layout_id` was never set by any UI.
- `display_sessions.shared_layout_id` was never set — `OFFERED_MODES` deliberately
  excluded `duplicate`/`extend` because shared-layout selection didn't exist.

Therefore `resolveDisplayState.ts:91` returned
`{ status: "standby", reason: "no_layout" }` for **every screen, always**. Combined with
§1, the conclusion is blunt: **no kiosk could display any content through any
UI-reachable action.**

Remediation was authorized and is described in §8.

Backend reachability measured across the audit: **82 total operations, ~53 UI-reachable
(≈65%)**, with the unreachable share concentrated in Layouts/Tiles.

---

## 6. Editor element completeness

### 6.1 Capability matrix

All 15 element types are insertable. Before this audit:

- **3 of 15** had any properties UI: `text` (content only), `shape` (fill only),
  `countdown` (target only).
- **12 of 15** had no way to configure their content at all.
- The canvas rendered **no real content for any type except text** — every element drew as
  a flat tinted box with a type-name label (`EditorCanvas.tsx:166-175`). An `image`
  element never rendered an image.
- `image` elements are inserted with `asset_id: null` and there is no UI to set one, so an
  `image` element was permanently blank. Only `asset_page` ever receives a real `asset_id`.

### 6.2 Shapes and borders — remediated

Confirmed original state: exactly one generic `shape` type, no variant concept anywhere,
and **no border, stroke, corner-radius, or shadow support on any element type** in the
type definitions, the canvas renderer, the properties panel, or the kiosk renderer.

Shipped in v1.0.17:

- `ShapeVariant` and `SHAPE_VARIANTS` in `src/services/scena-api/boards.ts` —
  rectangle, ellipse, triangle, diamond, hexagon, star, line, arrow.
- `DEFAULT_BORDER_CONFIG` with **`border_width: 0` as an explicit first-class
  "borderless" state**, plus `border_color`, `border_style`, `corner_radius`.
- `readShapeConfig()` normalizes legacy configs — an element saved as `{}` or
  `{ fill: "#…" }` still renders, defaulting to a borderless rectangle.
- Borders render via **SVG `<polygon>`/`<rect>` with a real `stroke`**, deliberately not
  CSS `clip-path` + `border` — clip-path clips a CSS border away, which would have made
  the border control silently do nothing on triangles, stars, and hexagons.
- Border is a **generic element property**, not shape-only.

No migration was needed (see §2.2).

### 6.3 Scene editing — still outstanding

`updateScene(sceneId, patch)` exists at `src/pages/boards/useBoardEditor.ts:139` and is
**never called** — it is dead code. There is no UI to rename, retime, change the
transition of, hide, or **delete** a scene. Once a second scene is added it cannot be
removed. Scene properties are frozen at whatever `handleAddScene` set.

### 6.4 Editor interactions

Present: drag, corner resize, rotate, center snap, keyboard nudge, keyboard delete,
z-order, undo/redo (50 steps), lock/hide.
Absent: multi-select, copy/paste, duplicate element, group/ungroup, zoom-to-fit,
element-to-element alignment guides.

---

## 7. Accessibility (WCAG 2.1 AA)

### 7.1 SEV1 — keyboard traps in the persistent app shell

`src/components/ui/Menu.tsx` wraps its trigger in `<span tabIndex={-1}>`, which is
survivable only when the trigger child is itself focusable. It is not for:

- `AccountMenu.tsx:28` — trigger is `<Avatar>`, which renders a plain `<span>`.
- `WorkspaceSwitcher.tsx:31` — trigger is a plain `<span>`.

Both render in the top bar of **every authenticated page**. A keyboard-only user could not
open the account menu or switch workspaces anywhere in the product. Remediation in §8.

### 7.2 SEV1 — board editor canvas is not keyboard operable

Canvas elements are `<div>` with `onPointerDown`/`onClick` and no `tabIndex`, `role`, or
key handler (`EditorCanvas.tsx:119-140`). Selection is mouse-only. Delete and arrow-nudge
handlers exist but are unreachable without first clicking with a pointer. Resize and rotate
have no keyboard equivalent at all. Scene thumbnails (`SceneStrip.tsx:17`) have the same
defect. **Outstanding.**

### 7.3 SEV2 — form labels unassociated app-wide

`Field` renders `<label htmlFor={htmlFor}>` with `htmlFor` optional; ~38 of ~40 call sites
omit it, so labels are not programmatically associated with their controls. Affects
essentially every form. Remediation in §8.

### 7.4 SEV2 — primary button contrast failure

`.scena-btn--primary` painted white text across
`linear-gradient(135deg, #3554e8 0%, #4a6cf5 55%, #7c9aff 100%)`.
Independently computed white-on-stop ratios: **5.86:1 / 4.42:1 / 2.65:1** against a
4.5:1 requirement — failing across roughly half the sweep of the app's only primary CTA
style.

**Fixed** by darkening the light end to
`#3554e8 → #4055ea → #4a63f0`, measured **5.86:1 / 5.67:1 / 4.85:1** — all passing.

**Still outstanding:** `--scena-gradient-primary` begins at `#7eb3ff`, which computes to
**2.15:1** against white, and carries white text on `.scena-docs__button--primary` and
`.scena-community__button--primary`. It cannot simply be darkened, because the same token
is used for `background-clip: text` on the landing stat cards where a light value is
required. These two buttons need a different token.

### 7.5 SEV2 — other

- **Tables**: zero `scope="col"` and zero `<caption>` across `DataTable` and all five
  hand-rolled tables. Remediation in §8.
- **Editor save state** (`EditorShell.tsx:66-71`) has no `role`/`aria-live`; save success,
  failure, and version conflict are silent to assistive tech. **Outstanding.**

### 7.6 Done correctly (no action)

- `:focus-visible` is handled properly — `outline: none` appears only alongside a
  replacement focus ring. No component overrides it.
- `Modal` and `Drawer` implement focus trap, Escape-to-close, and focus restore.
- Decorative graphics are correctly `aria-hidden`; meaningful images have real `alt`.
- Text color tokens pass comfortably: primary 18.6:1, secondary 12.1:1, muted 6.6:1.

---

## 8. Changes made during this audit

| Change | Files | Status |
|---|---|---|
| Shape variants + generic borders, borderless as `border_width: 0` | `boards.ts`, `EditorCanvas.tsx`, `EditorPanels.tsx`, `BoardEditorPage.tsx`, `editor.css` | Shipped in v1.0.17 |
| `HomePage` retry button made functional (was fully inert — never refetched, never cleared the error) | `HomePage.tsx` | Shipped |
| Unhandled `listLocations` rejections given error handling | `SessionsPage.tsx`, `NewSessionPage.tsx`, `PairScreenPage.tsx` | Shipped |
| Primary-gradient contrast fix | `tokens.css` | This audit |
| Removed empty legacy `marquee-sso/` directory | `supabase/functions/` | This audit |
| Layouts management UI: list page, tile editor, route, nav rail item, client-side mirrors of every DB CHECK constraint | `src/pages/layouts/*`, `src/domain/scenes.ts`, `router.tsx`, `AppShellRoute.tsx`, `route-metadata.ts`, `layouts.css` | This audit |
| Session-screen layout assignment; `duplicate`/`extend` modes re-enabled with required shared-layout selection | `SessionDetailPage.tsx` | This audit |
| Keyboard-reachable dropdown triggers (SEV1) | `Menu.tsx`, `AccountMenu.tsx`, `WorkspaceSwitcher.tsx`, `components.css` | This audit |
| `Field` label association via `useId` + `aria-describedby`/`aria-invalid` (SEV2) | `Field.tsx` | This audit |
| Table `scope="col"` and accessible names (SEV2) | `AssetsPage.tsx` (the other five were already compliant) | This audit |

**Verification of the combined tree:** `npx tsc -b` exit 0, `npm run build` exit 0,
`npm test` **141/141 passing across 22 files** — run from a clean sync at
`C:\Users\ogdev\scena-verify`, since the network share cannot execute the toolchain.

### Note on the §5 remediation

The Layouts work closes the *authoring* half of the kiosk gap: a Layout can now be
created, edited, and assigned to a session screen, and `duplicate`/`extend` modes are
usable again with a shared Layout. **It does not close §1.** A tile still requires a
`scene_id`, and this app has no Scene-creation flow, so `LayoutDetailPage` renders an
honest empty state and withholds the "Add tile" control entirely when a Location has no
Scenes — rather than shipping a button that cannot work.

A caveat worth recording: `LayoutsPage` reports a failed delete as "still in use" when it
sees `RESOURCE_NOT_FOUND`. That is correct today only because `mapPostgresError`
(`src/shared/errors.ts:206`) maps FK violation `23503` to that code and `deleteLayout` has
no other path to it. If a distinct FK-violation error code is ever introduced, revisit
this branch.

---

## 9. Outstanding, ranked

1. **Board → Display publish path** (§1) — the editor's output is unreachable by any screen. Unchanged by this audit and still the top item.
2. **Scene creation** — no UI anywhere creates a `scenes` row, so Layout tiles cannot be populated even now that the Layout editor exists. This is the immediate blocker on the kiosk actually showing content.
3. **Automations disclosure or worker deployment** (§4.1) — the product currently implies scheduling it does not perform.
4. **Board editor keyboard operability** (§7.2) — SEV1; canvas and scene strip are mouse-only.
4. **Scene editing**: rename, delete, duration, transition, hide (§6.3) — `updateScene` is dead code.
5. **Per-element properties** for the 12 unconfigurable element types, and real canvas rendering (§6.1).
6. **`image` element** cannot be given an `asset_id` — permanently blank (§6.1).
7. **Deploy** `presentation-callback` (broken pipeline) and `screen-credential-rotate`, or remove them (§3).
8. **Editor save-state `aria-live`** (§7.5).
9. **`--scena-gradient-primary` white-text contrast** on docs/community buttons (§7.4).
10. **Billing catalog from `plans`** rather than hardcoded literals (§4.2).
11. **Security advisories**: review the 6 `SECURITY DEFINER` grants; enable leaked-password protection (§2.3).
12. **Design-system debt**: ~150 inline `style={{}}` px/hex values across 43 files bypass existing tokens; `DataTable`, `Tabs`, `Pagination`, `Tooltip`, `Breadcrumbs`, `Radio` are dead outside the dev showcase while five pages hand-roll `<table>`.
