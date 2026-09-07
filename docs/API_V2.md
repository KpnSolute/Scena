# Scena API v2 and Live UI API Index

This index separates production capabilities from planned contracts. The product
authority remains `docs/sop/Purpose.md`.

## Verification vocabulary

- **source-verified**: implementation exists in the repository.
- **database-verified**: checked against the live Supabase schema.
- **live-backend-verified**: deployed and exercised directly.
- **end-to-end verified**: completed through the customer-facing path.
- **planned**: contract only, not a deployed capability.

A deployment alone is not end-to-end verification.

## Current account and Workspace model

Every authenticated account receives one free Personal Workspace. Accounts may
own additional Personal Workspaces and may own or join multiple Team
Workspaces. Every Workspace has:

- explicit `owner_user_id`
- active memberships and roles
- isolated entitlements and resources
- a persisted selected-Workspace preference

The database keeps compatibility names such as `organizations`; the product and
new API use Workspace terminology.

## Production manager UI endpoints

| Endpoint | Status | Purpose |
|---|---|---|
| `workspace-context` | deployed; capacity extension source-only | Profile, all authorized Workspaces, effective entitlements, current resource usage, selection |
| `content-source` | deployed; generic-webhook and multi-event/bootstrap extensions source-only | Tenant-scoped incoming webhook addresses, signed CloudEvents ingestion, last-known-good snapshots, provider refresh |
| `asset-upload` | end-to-end verified | Private source upload, queue finalization, list/detail/read/archive |
| `board-interaction` | end-to-end verified | Board draft create/load/save/version/revision/archive |
| `billing-checkout` | live-backend-verified | Personal one-time or Team subscription Checkout |
| `billing-portal` | live-backend-verified | Stripe customer portal |
| `screen-claim` | live-backend-verified | Manager Display pairing claim |

The browser clients for the first three endpoints live under
`src/services/scena-api`.

Generic incoming webhooks receive a unique HTTPS address containing only the
opaque source id. Scena reveals the associated bearer secret once at creation
or rotation; the sending system posts an event id, configured event type,
timestamp, and JSON `data` object. KpnSolute menu feeds use the same snapshot
store but replace bearer ingestion with managed Standard Webhooks signatures
and CloudEvents envelopes.

## Asset and media worker status

The production path is verified through:

```text
public Scena website
→ authenticated Asset API
→ private Supabase Storage
→ processing queue
→ outbound-only Proxmox worker
→ processed Variants
→ Asset ready
→ signed read
```

Worker-backed source types:

- image
- PDF
- PowerPoint

Video, audio, font, and scene-render controls remain disabled.

## Board status

Board draft create, list, load, save, optimistic conflict, revision, and archive
are verified. Static and live Element snapshots persist through the API.

Publication tables exist, but no manager publication endpoint is deployed.
Publication is therefore not a UI capability.

## Billing offerings

| Offering | Workspace | Billing |
|---|---|---|
| `personal_free` | Personal | automatic, free |
| `personal_additional` | Personal | $15 one-time |
| `plus` | Team | $15/month |
| `pro` | Team | $25/month |
| `max` | Team | $40/month |

Only a verified Stripe webhook provisions a paid Workspace.

## Display and legacy boundary

The kiosk/display stack remains separate from the new Asset and Board editor
stack. `display-gateway`, `screen-register`, and `screen-claim` are deployed.
The old `presentation-upload` endpoint is retained only for compatibility and
must not be used by new Asset UI work.

The central `scena-api/v2/*` router in `docs/api/v2/openapi.json` is still
planned and must not be called by production UI code.

## Contract files

| File | Meaning |
|---|---|
| `docs/api/v2/ui-integration.openapi.json` | Production first-UI contract |
| `docs/api/v2/media-and-boards.openapi.json` | Asset, Board, worker foundation |
| `docs/api/v2/consumer-billing.openapi.json` | Consumer billing contract |
| `docs/api/v2/openapi.json` | Planned central v2 router |
| `docs/UI_API_INTEGRATION.md` | Frontend integration rules and capability gates |

## Remaining product gates

- Build the Asset Library and Board editor against the typed clients.
- Add and accept a manager publication endpoint before exposing Publish.
- Complete Stripe-hosted browser Checkout acceptance before live-mode billing.
- Continue display playback integration without routing new Assets through the
  legacy presentation path.
