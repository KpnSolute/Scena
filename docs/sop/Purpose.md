# SOP: Scena Core Service Offering and Customer Delivery

**Service:** Scena  
**Company:** KpnSolute  
**Service Owner:** Miah  
**Technical Delivery Support:** KpnCompute, where applicable  
**Version:** 1.3  
**Last Updated:** July 22, 2026  
**Status:** Pre-launch operating standard

---

## 1. Purpose

This Standard Operating Procedure defines the Scena service that may be presented, provisioned, sold, onboarded, supported, and handed over to a customer.

It is the primary operating standard for Scena's account, Workspace, billing, content, Asset-processing, Display, and customer-delivery model.

Its purpose is to ensure that:

- Every authenticated user receives the same initial Scena experience.
- Every user receives one free Personal Workspace.
- Personal and Team Workspaces are isolated correctly.
- Additional Personal Workspaces are created only after verified one-time payment.
- Team Workspaces are created only after verified recurring subscription payment.
- Boards, Assets, Displays, Sessions, and usage limits are enforced at the Workspace boundary.
- Customer Assets remain durably stored even when the home processing worker is offline.
- Sales describes the same product engineering has built.
- No employee or contractor promises unreleased capabilities.
- Customers can operate Scena without routine manual backend intervention.

This SOP governs the journey from first sign-in through the first successfully operating live Display.

---

## 2. Product Definition

Scena is a digital-signage management service provided by KpnSolute.

Scena allows authorized users to:

- Create and manage digital content.
- Organize content into Boards.
- Upload and process Assets.
- Pair physical Displays.
- Assign Boards to Displays through Sessions.
- Operate one or more Workspaces.
- Invite Team members when using a Team Workspace.
- Control live signage according to Workspace type, role, and plan.
- Schedule supported actions when the selected plan includes automation.
- Continue showing the last valid content during temporary connectivity loss.

Scena does not sell the customer's television, monitor, network connection, or general-purpose computer unless a separate written agreement states otherwise.

---

## 3. Core Terminology

### 3.1 Account

A Scena account belongs to one authenticated person.

Every authenticated account receives one Personal Workspace automatically.

An account may temporarily exist without a Workspace only when automatic provisioning is incomplete or failed. That is an error or recovery state, not the normal product state.

### 3.2 Workspace

A Workspace is the ownership, billing, entitlement, and data-isolation boundary for Scena resources.

Each Workspace owns its own:

- Boards.
- Board Elements.
- Assets.
- Displays.
- Sessions.
- Preferences and settings.
- Usage counters.
- Billing state when billing applies.
- Members and roles when the Workspace is a Team Workspace.

A user may own multiple Personal Workspaces and may own or belong to multiple Team Workspaces.

The application must provide an active-Workspace selector. Every Workspace-scoped operation must verify the authenticated user's access to the selected Workspace.

The database may continue using internal names such as `organizations`, `screens`, `scenes`, and `display_layouts`. Customer-facing communication must use Workspace, Display, Board, and Board Element.

### 3.3 Personal Workspace

A Personal Workspace is a single-owner Scena Workspace intended for individual use and product discovery.

A Personal Workspace may own and operate:

- Boards.
- Assets.
- Displays.
- Sessions.
- Workspace settings.

A Personal Workspace does not include:

- Additional members.
- Team invitations.
- Shared Team roles.
- Team-only collaboration features.
- Team-only automation, grouping, or access-control capabilities unless separately approved.

### 3.4 Team Workspace

A Team Workspace is a collaborative Workspace using a recurring Plus, Pro, or Max subscription.

A Team Workspace may include:

- Owners.
- Admins.
- Operators.
- Designers.
- Viewers.
- Invitations.
- Team billing.
- Plan-based limits and features.

### 3.5 Display

Display is Scena's public term for a physical signage endpoint.

A Display may consist of:

- A smart display running a supported Scena player.
- A compatible computer or signage device connected to a television or monitor.
- Another approved device capable of running the Scena Display application.

### 3.6 Board

A Board is designed content or a visual canvas intended for presentation on one or more Displays.

### 3.7 Asset

An Asset is uploaded source content or processed content used by a Board.

Examples include images, videos, PowerPoint source files, rendered slide images, thumbnails, and manifests.

### 3.8 Session

A Session is the live-control relationship that determines which Board or content state is shown on one or more Displays.

---

## 4. Standard Account Provisioning

Every authenticated Scena user receives one free Personal Workspace.

The normal first-use flow is:

```text
Account created
→ profile and preferences created
→ first Personal Workspace provisioned idempotently
→ user becomes the sole Owner
→ Personal Free entitlements applied
→ Personal Workspace becomes active
```

Provisioning must be idempotent. Repeated sign-in, callback retries, concurrent requests, or application refreshes must not create duplicate free Personal Workspaces.

The first Personal Workspace must not require Stripe Checkout.

The application must provide a safe retry or recovery path when automatic provisioning fails.

---

## 5. Workspace Offerings

### 5.1 First Personal Workspace

**Price:** Free.

**Billing mode:** None.

**Provisioning trigger:** Successful authenticated account provisioning.

Includes:

- 2 Displays maximum.
- 5 active Boards maximum.
- 5 source Asset uploads per calendar month.
- One Owner only.
- Basic Board, Asset, Display, and Session operation.
- No Team invitations or shared roles.

### 5.2 Additional Personal Workspace

**Price:** $15 USD as a one-time purchase for each additional Personal Workspace.

The $15 charge is not monthly and does not create a recurring subscription.

Each successful purchase provisions exactly one additional Personal Workspace with the same standard Personal Free limits.

The browser success page is not proof of purchase. Only a verified Stripe webhook may finalize the additional Personal Workspace.

A failed, abandoned, expired, or unverified Checkout Session must not create a Workspace.

Replaying the same successful Stripe event must not create duplicate Workspaces.

### 5.3 Team Workspace

A Team Workspace requires a recurring Plus, Pro, or Max subscription.

The purchaser becomes the initial Owner after the verified webhook provisions the Workspace.

The browser must never mark a Team Workspace paid or active based only on the Stripe return URL.

---

## 6. Approved Team Plans

### 6.1 Plus

**Price:** $15 USD per month.

Includes:

- 2 Displays.
- 10 Boards.
- 5 Team members.
- 1 concurrent Session.
- Up to 4 Displays in one Session.
- No automation.
- No Display Groups.
- No Session Groups.
- No resource-level access control.

Plus is intended for small organizations needing basic signage management.

### 6.2 Pro

**Price:** $25 USD per month.

Includes:

- 5 Displays.
- 30 Boards.
- 10 Team members.
- 2 concurrent Sessions.
- Up to 4 Displays in each Session.
- Daily automation.
- Weekly automation.
- No Display Groups.
- No Session Groups.
- No resource-level access control.

Pro is intended for organizations needing more signage capacity and basic scheduling.

### 6.3 Max

**Price:** $40 USD per month.

Includes:

- 15 Displays.
- 50 Boards.
- 25 Team members.
- 4 concurrent Sessions.
- Up to 4 Displays in each Session.
- Hourly automation.
- Daily automation.
- Weekly automation.
- Approved custom scheduling.
- Display Groups.
- Session Groups.
- Resource-level access control.

Max is intended for organizations coordinating multiple Displays, Sessions, schedules, and users.

### 6.4 Universal Session limit

Every Session is limited to four active Displays regardless of Workspace plan.

Session Groups do not provide additional concurrent-Session capacity.

### 6.5 Board editing capability matrix

Board editing is a persisted Workspace capability. Board scenes, element geometry, element configuration, scene duration, scene transitions, revisions, and optimistic version checks are stored through the canonical Board API and must never be represented as editor-only state.

| Board editing capability | Personal Free | Plus | Pro | Max |
|---|---:|---:|---:|---:|
| Text, image, shape, Asset page, QR, clock, date, countdown, ticker | Yes | Yes | Yes | Yes |
| Typography: Scena font families, weight, size, alignment, color, decoration | Yes | Yes | Yes | Yes |
| Scene duration and transitions | Yes | Yes | Yes | Yes |
| Asset-backed image/PDF/PowerPoint previews | Yes | Yes | Yes | Yes |
| Carousel/gallery using ready Assets | Yes | Yes | Yes | Yes |
| Revisions and version-conflict recovery | Yes | Yes | Yes | Yes |
| Weather, video, music player, live data text | Preview only | Preview only | Preview only | Preview only |
| Board publication workflow | Not available | Not available | Not available | Not available |

Weather, video, music player, and live data text controls may save configuration and render designed previews, but they must state that no live data source is connected. Scena must not display invented weather, media playback, or data values on a customer Display. Time, date, countdown, ticker, QR, scene transitions, and ready Asset previews are supported Board behavior and are pushed to active Sessions when the Board is saved.

---

## 7. Personal Free Quota Rules

Each Personal Workspace receives:

- 2 Displays maximum.
- 5 active Boards maximum.
- 5 source Asset uploads per calendar month.

Quota rules:

- Limits must be enforced server-side at the Workspace boundary.
- The UI may show usage and prevent obvious invalid actions, but UI checks are not authoritative.
- A source upload counts only after the source file is successfully finalized and accepted for processing.
- Failed uploads that never finalize do not count.
- Derived slide images, thumbnails, previews, and manifests do not count as additional uploads.
- Deleting an Asset does not restore the consumed monthly upload allowance.
- Usage resets at the beginning of each calendar month in UTC.
- Retrying the same processing job does not consume another upload.
- Duplicate finalization requests must be idempotent and must not consume quota twice.

When a limit is reached:

- Existing resources remain available.
- New over-limit creation is blocked with a stable, safe error.
- Current usage and the applicable limit are shown to the user.
- The user may reduce active usage, purchase another Personal Workspace, or create a Team Workspace.

The exact storage-byte limit, file-size limit, and retention period must not be invented in the UI or sales material until separately approved.

---

## 8. Workspace Switching and Isolation

The application must:

- List every Workspace the authenticated user may access.
- Identify each Workspace as Personal or Team.
- Allow the user to select one active Workspace.
- Persist the active selection safely where appropriate.
- Revalidate access whenever the active Workspace changes.
- Clear or refresh cached Workspace-scoped data after a switch.
- Prevent stale requests from mutating a previously active Workspace.

Every Workspace-scoped operation must verify:

- Authenticated user identity.
- Requested Workspace.
- Ownership or membership.
- Team role when applicable.
- Workspace type.
- Effective entitlements and limits.
- Ownership of every referenced Board, Asset, Display, and Session.

Client-supplied Workspace IDs, roles, plan codes, limits, and ownership claims are untrusted.

Resources must never cross Workspace boundaries unless a separately approved transfer or copy operation is implemented.

---

## 9. Team Roles

### 9.1 Owner

The Owner may:

- Manage billing.
- Open the Billing Portal for a Team Workspace.
- Change Team plans.
- Manage Workspace settings.
- Invite and remove Team members.
- Change Team member roles.
- Transfer Team ownership.
- Delete the Workspace using the approved deletion procedure.
- Manage all content and Displays.
- Control all Sessions.

Every Team Workspace must retain at least one active Owner.

A Personal Workspace has exactly one Owner and no additional members.

### 9.2 Admin

An Admin may manage members, Boards, Assets, Displays, Sessions, supported automations, and most Team settings, subject to Owner protection.

### 9.3 Operator

An Operator may pair and monitor Displays, start and stop Sessions, assign approved content, place Displays into standby, and use approved live-control operations.

### 9.4 Designer

A Designer may upload approved Assets, create and edit Boards, import PowerPoint content when supported, and preview content.

A Designer does not control live Displays by default.

### 9.5 Viewer

A Viewer may view permitted Boards, Display status, Session status, and allowed Team information. A Viewer may not change Team resources.

---

## 10. Billing and Provisioning Paths

Scena has three distinct Workspace-provisioning paths.

### 10.1 First Personal Workspace

- Price: free.
- Billing mode: none.
- Provisioning trigger: successful account provisioning.
- Recurring subscription: no.

### 10.2 Additional Personal Workspace

- Price: $15 USD.
- Billing mode: one-time Stripe payment.
- Provisioning trigger: verified successful payment webhook.
- Recurring subscription: no.

### 10.3 Team Workspace

- Price: selected Plus, Pro, or Max price.
- Billing mode: recurring Stripe subscription.
- Provisioning trigger: verified subscription Checkout webhook.
- Recurring subscription: yes.

Checkout Sessions, webhook events, and provisioning records must identify the intended billing mode and Workspace type unambiguously.

A one-time Personal Workspace purchase must never be interpreted as a Team subscription. A Team subscription must never be interpreted as an additional Personal Workspace purchase.

Stripe webhook processing must be signature-verified and idempotent.

Manual Workspace creation must not be used to hide a failed paid Checkout flow.

---

## 11. Asset Storage and Processing

Supabase Storage is the canonical durable store for original Assets and processed Asset outputs.

The home processing machine is a compute worker and temporary cache. It is not the permanent source of truth for customer files.

The approved pipeline is:

```text
Authenticated upload request
→ Workspace access and quota checked
→ Asset record created in uploading state
→ short-lived signed upload URL issued
→ browser uploads original file to private Supabase Storage
→ upload finalization verified
→ source-upload quota consumed exactly once
→ asset_processing_jobs row created with status queued
→ home worker polls over the ACH tunnel using an outbound-only connection
→ worker securely leases one job
→ worker downloads the source using a short-lived signed URL
→ worker performs PowerPoint extraction and rendering locally
→ worker uploads slide images, thumbnails, and manifest to private Supabase Storage
→ worker sends a signed, idempotent completion callback
→ Asset becomes ready
→ UI changes from processing to ready
```

When the worker is unavailable, successfully uploaded source files remain durable and processing jobs remain queued.

Customer uploads must not disappear because the worker is offline.

The browser request must not remain open while PowerPoint conversion runs.

---

## 12. Processing Queue Standard

Asset processing must use a durable queue represented by `asset_processing_jobs` or an approved equivalent.

Minimum states:

```text
queued
→ leased
→ processing
→ ready
```

Retry flow:

```text
processing
→ retry_wait
→ queued
```

Terminal failure flow:

```text
processing
→ failed
```

The queue must support:

- Workspace ID.
- Asset ID.
- Job type.
- Status.
- Attempt count.
- Maximum-attempt or failure policy.
- Available-at time.
- Lease owner.
- Lease expiration.
- Heartbeat or updated-at time.
- Safe failure code and customer-safe failure message.
- Created and completed timestamps.
- Idempotency protection.

Workers must claim jobs atomically. Two workers must not process the same job concurrently unless the job type is explicitly designed for parallel work.

Expired leases must allow recovery after a worker crash.

Retries must use bounded backoff and must not loop forever.

---

## 13. Home Worker Security and Operations

The home worker connects outbound through the approved ACH tunnel or an equivalent private network path.

The architecture must not require opening a public inbound port on the home network.

The worker must:

- Authenticate with a dedicated worker credential.
- Receive only the permissions needed to lease jobs and use short-lived file URLs.
- Avoid storing unrestricted service-role or storage credentials when narrower credentials are possible.
- Keep temporary files in a controlled cache directory.
- Delete or expire temporary files after successful processing or an approved retention window.
- Report heartbeats and failures safely.
- Never expose customer files through an unauthenticated local service.

Operations must define host monitoring, disk-space alerts, worker restart behavior, queue-depth monitoring, failed-job review, software updates, cache cleanup, and tunnel recovery before production reliance.

Supabase Storage remains the canonical durable store. Local redundancy improves worker availability but is not the primary customer-file backup.

---

## 14. Storage Security

Original and processed Assets must use private buckets or private storage paths.

Access must use short-lived signed URLs or an equivalently scoped authenticated mechanism.

Storage paths must be Workspace-scoped and collision-resistant.

The application and worker must prevent:

- Cross-Workspace file access.
- Guessable public object URLs.
- Reuse of expired signed URLs.
- Arbitrary destination paths supplied by the browser.
- Uploading outputs into another Workspace's prefix.
- Completion callbacks for the wrong Asset or job.
- Unnecessary exposure of internal storage keys.

Completion callbacks must be authenticated, signed, and idempotent, and must bind the completion to the expected Workspace, Asset, job, and output manifest.

---

## 15. Customer Delivery Procedure

### Stage 1: Account creation and first Workspace

1. Customer opens Scena.
2. Customer signs in using an approved authentication method.
3. Scena creates or updates the Auth user, profile, and preferences.
4. Scena provisions the first free Personal Workspace idempotently.
5. The user becomes the sole Owner.
6. Personal Free limits are applied.
7. The Personal Workspace becomes active.

Verification:

- User can sign out and sign back in.
- Exactly one initial Personal Workspace exists.
- Repeated sign-in does not create duplicates.
- User can access the Workspace dashboard.
- Limits display correctly.

### Stage 2: Workspace choice

The user may:

- Continue using the free Personal Workspace.
- Purchase an additional Personal Workspace for $15 once.
- Create a Team Workspace by choosing Plus, Pro, or Max.
- Accept an eligible Team invitation.
- Switch among accessible Workspaces.

### Stage 3: Paid Checkout

For an additional Personal Workspace:

1. Scena validates the authenticated user and one-time product.
2. Scena creates a Stripe payment-mode Checkout Session.
3. The customer completes payment.
4. A verified webhook provisions exactly one additional Personal Workspace.

For a Team Workspace:

1. Scena validates the authenticated user and selected recurring plan.
2. Scena validates proposed Team Workspace details.
3. Scena creates a Stripe subscription-mode Checkout Session.
4. The customer completes payment.
5. A verified webhook provisions the Team Workspace and Owner membership.

The browser success page is never authoritative proof of payment.

### Stage 4: Workspace configuration

The Owner confirms Workspace name, timezone, locale, and available settings.

For Team Workspaces, the Owner also confirms plan, subscription state, billing access, and member roles.

### Stage 5: Asset upload and processing

1. Authorized user selects an approved file.
2. Scena checks Workspace access and quota.
3. Browser uploads through a short-lived signed URL.
4. Scena finalizes the upload idempotently.
5. A processing job enters the durable queue.
6. UI shows queued or processing state.
7. Worker processes the Asset and uploads durable outputs.
8. Signed callback marks the Asset ready or failed.

Verification:

- Source file exists in private canonical storage.
- Monthly quota is consumed exactly once when applicable.
- Derived slides do not consume additional upload quota.
- Worker downtime leaves the job queued safely.
- No other Workspace can access the Asset.

### Stage 6: Display registration and pairing

1. Display opens the Scena Display application.
2. Display registers and receives a device credential and short pairing code.
3. Display stores its credential securely.
4. Pairing code appears on the physical Display.
5. Authorized user enters the code in Scena.
6. User selects the active Workspace and Display name.
7. Pairing code is consumed.
8. Display becomes associated with the selected Workspace.
9. Display begins retrieving authoritative state.

Verification:

- Pairing code expires and is single-use.
- Raw Display credential is not stored in plaintext.
- Display appears in the correct Workspace dashboard.
- Another Workspace cannot claim or access it.
- Personal and Team Display quotas are enforced server-side.

### Stage 7: First Board

1. Authorized user creates a Board.
2. User sets Board name, canvas size, orientation, and background.
3. User adds supported content.
4. User previews and saves the Board.
5. Board quota is enforced.

### Stage 8: First live Session

1. Authorized user creates or opens a Session.
2. User adds a paired Display.
3. User assigns the Board.
4. User previews the state.
5. User starts the Session or performs Take.
6. Display retrieves authoritative state.
7. Physical screen shows the correct content.

Verification:

- Correct Board and Display are targeted.
- Workspace isolation is preserved.
- Session and Display limits are enforced.
- Repeating an idempotent command does not execute it twice.

### Stage 9: Resilience and handoff

Where practical, verify cached last-valid content, temporary network interruption behavior, reconnection, and authoritative-state reconciliation.

The customer should complete at least one normal operation before handoff is accepted.

---

## 16. Billing Lifecycle

### 16.1 Personal Workspace purchase

A successful one-time purchase creates one additional Personal Workspace. It does not create a recurring subscription.

Refund, chargeback, and purchased-Workspace deletion behavior must be separately defined before public sale.

### 16.2 Team upgrade

When a Team upgrades, Stripe confirms the new price, subscription records synchronize, higher limits apply, and existing resources remain intact.

### 16.3 Team downgrade

Downgrading must not automatically delete Displays, Boards, members, Sessions, or Assets.

When current usage exceeds the new plan, existing resources remain preserved while new over-limit creation is blocked.

### 16.4 Failed Team payment

Team data remains preserved. The Owner is notified and directed to the Billing Portal. Existing signage must not suddenly display a raw billing error.

### 16.5 Team cancellation

A Team remains active through its paid period. After the paid period ends, the Team becomes inactive or restricted according to approved policy, while customer data remains preserved.

---

## 17. Sales and Representation Rules

Anyone representing Scena must:

- State that every authenticated user receives one free Personal Workspace.
- State Personal Free limits accurately.
- State that each additional Personal Workspace costs $15 once.
- State that Team Workspaces use recurring Plus, Pro, or Max plans.
- Clearly separate operational capabilities from approved but unfinished implementation.
- Avoid promising unsupported hardware, enterprise features, or uptime guarantees.
- Avoid manually creating paid Workspaces to hide Checkout failures.
- Avoid describing a Personal Workspace as a collaborative Team plan.
- Use approved customer-facing terminology.

The approved customer-facing terms are:

- Workspace, not organization.
- Personal Workspace and Team Workspace when distinction matters.
- Board, not display layout.
- Board Element, not tile.
- Display, not screen.
- Session, not display session.
- Asset, not presentation record.

---

## 18. Support and Troubleshooting

| Situation | Required action |
|---|---|
| Initial Personal Workspace is missing | Retry idempotent provisioning and inspect safe logs. Do not create duplicates manually. |
| Duplicate Personal Workspaces appear | Treat as a provisioning defect. Preserve evidence and reconcile without deleting customer data casually. |
| Additional Personal Checkout succeeds but Workspace is missing | Inspect Stripe event, signature verification, idempotency record, and one-time provisioning transaction. |
| Team Checkout succeeds but Team Workspace is missing | Inspect subscription event, signature verification, billing event record, and provisioning transaction. |
| Workspace switch shows stale data | Clear Workspace-scoped cache, revalidate access, and reload selected Workspace data. |
| Customer exceeds Personal quota | Show usage and limit. Do not manually increase entitlements. |
| Asset remains queued | Check worker heartbeat, queue lease state, available-at time, tunnel status, and retry policy. |
| Asset processing fails | Preserve source file, show a safe failure state, and retry only according to bounded policy. |
| Pairing code expired | Restart registration or issue a new code. Do not reuse an expired code. |
| Display is offline | Confirm power, network, last heartbeat, and cached last-valid content. |
| Suspected cross-Workspace access | Treat as Priority 1 and begin security escalation immediately. |

Personnel must not bypass quota, role, Workspace, billing, or pairing checks in the UI or database.

---

## 19. Service Delivery Definition of Done

### Account and Workspace

- [ ] Customer can authenticate.
- [ ] Profile and preferences exist.
- [ ] Exactly one first Personal Workspace was provisioned automatically.
- [ ] Customer is sole Owner of the Personal Workspace.
- [ ] Personal Free limits are correct.
- [ ] Repeated provisioning attempts create no duplicate Workspace.
- [ ] Workspace selector lists all permitted Workspaces.
- [ ] Workspace switching preserves isolation.

### Billing

- [ ] Additional Personal Workspace Checkout uses one-time payment mode.
- [ ] Verified webhook creates exactly one additional Personal Workspace.
- [ ] Team Checkout uses subscription mode.
- [ ] Verified webhook creates the Team Workspace and Owner membership.
- [ ] Billing modes cannot be confused.
- [ ] Webhook replay creates no duplicate Workspace.
- [ ] No manual paid-Workspace provisioning occurred.

### Content and Assets

- [ ] At least one valid Board exists.
- [ ] Board belongs to the correct Workspace.
- [ ] Personal Board quota is enforced.
- [ ] Signed upload succeeds.
- [ ] Source Asset is stored durably in private Supabase Storage.
- [ ] Processing job is queued durably.
- [ ] PowerPoint conversion completes asynchronously when applicable.
- [ ] Processed outputs return to private canonical storage.
- [ ] Monthly upload quota is consumed exactly once.
- [ ] Worker downtime does not lose customer uploads.

### Display and Session

- [ ] Display was registered securely.
- [ ] Pairing code was consumed once.
- [ ] Display is associated with the correct Workspace.
- [ ] Display quota is enforced.
- [ ] Display heartbeat is visible.
- [ ] Display shows the correct live content.
- [ ] Session limits are respected.
- [ ] No cross-Workspace Display or Board assignment occurred.

### Security and Handoff

- [ ] No secrets were shared.
- [ ] Roles and Workspace access were enforced.
- [ ] Private Asset storage remained private.
- [ ] Worker credential remained separate from manager and device credentials.
- [ ] Customer completed at least one normal operation.
- [ ] Customer understands Workspace type, limits, billing, and support path.
- [ ] Known limitations were disclosed.

---

## 20. Current Readiness Rule

This SOP defines the approved Scena operating model.

Approval in this document does not prove the feature is implemented, deployed, configured, or verified.

Until the relevant acceptance tests pass, Scena must be described as pre-launch, controlled testing, beta, pilot, invite-only, or another accurate limited-availability label.

At minimum, public readiness requires verified:

- Automatic first Personal Workspace provisioning.
- Personal quota enforcement.
- Additional Personal one-time Checkout and webhook provisioning.
- Team subscription Checkout and webhook provisioning.
- Multi-Workspace switching and isolation.
- Asset signed upload, durable queue, worker processing, and signed completion.
- Display registration and full pairing.
- Board assignment and first live Session.
- Remote CI and production smoke testing.

---

## 21. Related Documents

- Scena Service Expansion and Product Roadmap Decision Procedure (`docs/sop/Roadmap.md`).
- Scena API v2 documentation.
- Scena Billing and Subscription Policy.
- Scena Display Deployment Guide.
- Scena Supported Hardware Matrix.
- Scena Customer Onboarding Record.
- Scena Support and Incident Escalation Policy.
- Scena Service Capability Register.
- Scena Data Retention and Workspace Deletion Policy.
- Scena Security Incident Response Procedure.
