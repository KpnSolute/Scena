# SOP Amendment: Workspaces, Personal Free Access, and Asset Processing

**Service:** Scena  
**Company:** KpnSolute  
**Service Owner:** Miah  
**Version:** 1.2  
**Approved:** July 22, 2026  
**Status:** Approved product and architecture standard; implementation must be verified separately

---

## 1. Authority and supersession

This amendment is part of the Scena operating standard.

It supersedes any conflicting statement in `docs/sop/Purpose.md`, `docs/sop/Roadmap.md`, API documentation, code comments, or earlier planning material concerning:

- Personal accounts being unable to own Scena resources.
- Users being limited to zero or one workspace.
- Every workspace requiring a recurring paid plan.
- Personal being only a no-Team account state.
- Permanent Asset storage being hosted on a home or local processing machine.
- PowerPoint conversion occurring synchronously during a browser upload request.

Where this amendment conflicts with older documentation, this amendment controls until the older document is consolidated.

This document approves product behavior and target architecture. It does not by itself prove that the behavior is implemented or live.

---

## 2. Workspace model

A **Workspace** is the ownership and isolation boundary for Scena resources.

Each Workspace owns its own:

- Boards.
- Board Elements.
- Assets.
- Displays.
- Sessions.
- Usage counters.
- Preferences and settings.
- Billing state when billing applies.
- Members and roles when the Workspace is a Team Workspace.

Resources must never cross Workspace boundaries unless a separately approved transfer or copy operation is implemented.

The database may continue using legacy internal names such as `organizations` while the customer-facing product uses **Workspace**, **Personal Workspace**, and **Team Workspace**.

---

## 3. Account provisioning

Every authenticated Scena user receives one Personal Workspace automatically.

The initial flow is:

```text
Account created
→ profile and preferences created
→ first Personal Workspace provisioned idempotently
→ user becomes the sole Owner
→ Personal Free entitlements applied
→ Personal Workspace becomes active
```

Provisioning must be idempotent. Repeated sign-in, callback retries, or concurrent requests must not create duplicate free Personal Workspaces.

An account may temporarily exist without a Workspace only while provisioning is incomplete or failed. The application must provide a safe retry or recovery path rather than treating this as a permanent product state.

A user may own multiple Personal Workspaces and may own or belong to multiple Team Workspaces.

The application must provide an active-Workspace selector. Every Workspace-scoped query and mutation must use the selected Workspace and verify the user's access.

---

## 4. Personal Workspace

A Personal Workspace is a single-owner Scena workspace intended for individual use and product discovery.

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
- Paid Team-only collaboration features.
- Paid Team-only automation, grouping, or access-control capabilities unless separately approved.

### 4.1 First Personal Workspace

The first Personal Workspace is free and is automatically provisioned for every authenticated user.

### 4.2 Additional Personal Workspaces

Each additional Personal Workspace costs **$15 USD as a one-time purchase**.

The $15 charge is not monthly and does not create a recurring subscription.

Each successful one-time purchase provisions exactly one additional Personal Workspace with the standard Personal Free limits.

The browser success page is not proof of purchase. Only a verified Stripe webhook may finalize the additional Personal Workspace.

A failed, abandoned, expired, or unverified Checkout Session must not create the Workspace.

Replaying the same successful Stripe event must not create duplicate Workspaces.

---

## 5. Personal Free limits

Each Personal Workspace receives these limits:

- **2 Displays maximum.**
- **5 active Boards maximum.**
- **5 source Asset uploads per calendar month.**

### 5.1 Asset-upload quota accounting

For Personal Workspaces:

- A source upload counts after the source file has been successfully finalized and accepted for processing.
- Failed uploads that never finalize do not count.
- Derived slide images, thumbnails, previews, manifests, and other processing outputs do not count as additional uploads.
- Deleting an Asset does not restore the consumed monthly upload allowance.
- Usage resets at the beginning of each calendar month in UTC.
- Retries of the same processing job do not consume additional upload allowance.
- Duplicate finalization requests must be idempotent and must not consume quota twice.

The exact storage-byte limit, file-size limit, and retention period are not defined by this amendment and must not be invented in the UI or sales material.

### 5.2 Limit enforcement

Limits must be enforced server-side at the Workspace boundary.

The UI may display usage and block obvious invalid actions, but UI checks are not authoritative.

When a limit is reached:

- Existing resources remain available.
- New over-limit creation is blocked with a stable, safe error.
- The user is shown current usage and the applicable limit.
- The user may reduce active usage where that is meaningful or create/upgrade to an appropriate paid Workspace offering.

---

## 6. Team Workspace

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

The Team Workspace creation flow is:

```text
Authenticated user
→ chooses Plus, Pro, or Max
→ supplies Team Workspace details
→ completes recurring Stripe Checkout
→ verified webhook confirms subscription
→ Team Workspace is provisioned
→ purchaser becomes Owner
→ plan entitlements are applied
```

The browser must never mark the Workspace paid or provision it based only on the return URL.

A verified Stripe webhook remains the authority for Team Workspace subscription creation and synchronization.

---

## 7. Billing separation

Scena has three distinct Workspace-provisioning paths:

### 7.1 First Personal Workspace

- Price: free.
- Billing mode: none.
- Provisioning trigger: successful account provisioning.
- Recurring subscription: no.

### 7.2 Additional Personal Workspace

- Price: $15 USD.
- Billing mode: one-time Stripe payment.
- Provisioning trigger: verified successful payment webhook.
- Recurring subscription: no.

### 7.3 Team Workspace

- Price: selected Plus, Pro, or Max price.
- Billing mode: recurring Stripe subscription.
- Provisioning trigger: verified subscription Checkout webhook.
- Recurring subscription: yes.

Checkout Sessions, webhook events, and provisioning records must identify the intended billing mode and Workspace type unambiguously.

A one-time Personal Workspace purchase must never be interpreted as a Team subscription, and a Team subscription must never be interpreted as an additional Personal Workspace purchase.

---

## 8. Workspace switching and isolation

A user may have access to multiple Workspaces.

The application must:

- List every Workspace the authenticated user may access.
- Identify each Workspace as Personal or Team.
- Allow the user to choose one active Workspace.
- Persist the active selection safely as a preference where appropriate.
- Revalidate access whenever the active Workspace changes.
- Clear or refresh cached Workspace-scoped data after a switch.
- Prevent stale requests from mutating the previously active Workspace.

Every Workspace-scoped operation must verify:

- The authenticated user.
- The requested Workspace.
- Ownership or membership.
- The user's role when the Workspace is a Team.
- The Workspace type.
- The Workspace's current entitlements and limits.
- Ownership of every referenced Board, Asset, Display, and Session.

Client-supplied Workspace IDs, roles, plan codes, limits, and ownership claims are untrusted.

---

## 9. Asset storage and processing architecture

Supabase Storage is the canonical durable store for original Assets and processed Asset outputs.

The home processing machine is a compute worker and temporary cache. It is not the permanent source of truth for customer files.

The approved pipeline is:

```text
Authenticated upload request
→ Workspace access and quota checked
→ Asset record created in uploading state
→ short-lived signed upload URL issued
→ browser uploads original file to private Supabase Storage
→ upload finalization is verified
→ source-upload quota is consumed exactly once
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

If the worker is unavailable, successfully uploaded source files remain durable in Supabase Storage and jobs remain queued.

Customer uploads must not disappear or become unrecoverable because the home worker is offline.

---

## 10. Processing queue

Asset processing must use a durable queue represented by `asset_processing_jobs` or an approved equivalent.

The queue must support at least these states:

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

A job record must support the data required for safe processing, including:

- Workspace ID.
- Asset ID.
- Job type.
- Status.
- Attempt count.
- Maximum attempts or failure policy.
- Available-at time.
- Lease owner.
- Lease expiration.
- Heartbeat or updated-at time.
- Safe failure code and customer-safe failure message.
- Created and completed timestamps.
- Idempotency key or equivalent duplicate protection.

Workers must claim jobs atomically. Two workers must not process the same job concurrently unless the job type is explicitly designed for parallel work.

Expired leases must allow recovery after a worker crash.

Job retries must use bounded backoff and must not loop forever.

---

## 11. PowerPoint processing

PowerPoint files are processed asynchronously.

The home worker performs the CPU- and application-heavy work, including where supported:

- Opening or converting `.pptx` content.
- Extracting slides.
- Rendering each slide to an image.
- Generating thumbnails or previews.
- Creating an ordered manifest.
- Recording dimensions, slide count, and supported metadata.

The original PowerPoint remains stored in private Supabase Storage.

Processed slide images and manifests are uploaded back to private Supabase Storage and become the playback source used by Scena.

The browser request must not remain open while PowerPoint conversion runs.

The customer-facing states should be based on real Asset state, such as:

- Uploading.
- Queued.
- Processing.
- Ready.
- Failed.

The UI must not claim an Asset is ready before processed outputs are durable and the completion callback has been verified.

---

## 12. Home worker and ACH tunnel

The home worker connects outbound through the approved ACH tunnel or equivalent private network path.

The architecture must not require opening a public inbound port on the home network.

The worker must:

- Authenticate with a dedicated worker credential.
- Receive only the permissions needed to lease jobs and access short-lived file URLs.
- Avoid storing Supabase service-role or unrestricted storage credentials when a narrower credential is possible.
- Keep temporary files in a controlled cache directory.
- Delete or expire temporary files after successful upload or after an approved retention window.
- Report heartbeats and processing failures safely.
- Never expose customer files through an unauthenticated local service.

The worker may cache files for performance, but cache loss must not destroy the canonical Asset.

Before the worker is relied on for production, operations must define:

- Host monitoring.
- Disk-space alerts.
- Worker restart behavior.
- Queue-depth monitoring.
- Failed-job review.
- Software update procedure.
- Local cache cleanup.
- Recovery when the tunnel is unavailable.

A ZFS mirror or offsite backup is not required for canonical customer durability under this architecture because Supabase Storage is the source of truth. Local storage redundancy remains recommended for worker availability and cache resilience.

---

## 13. Storage security

Original and processed Assets must be stored in private buckets or private storage paths.

Access must use short-lived signed URLs or an equivalently scoped authenticated mechanism.

Storage paths should be Workspace-scoped and collision-resistant.

The application and worker must prevent:

- Cross-Workspace file access.
- Guessable public object URLs.
- Reuse of expired signed URLs.
- Arbitrary destination paths supplied by the browser.
- Uploading output files into another Workspace's prefix.
- Completion callbacks for the wrong Asset or job.
- Exposing internal storage keys unnecessarily to the UI.

The completion callback must be authenticated, signed, and idempotent.

Callback verification must bind the completion to the expected Workspace, Asset, job, and output manifest.

---

## 14. API implications

The API and domain layer must evolve from a single-active-Team assumption to a multi-Workspace model.

The authenticated context must be able to return:

- User summary.
- Available Workspaces.
- Active Workspace.
- Workspace type.
- Ownership or membership role.
- Effective entitlements.
- Current usage.
- Personal monthly upload usage where applicable.

Release APIs must support or plan for:

- Listing accessible Workspaces.
- Selecting the active Workspace.
- Creating an additional Personal Workspace through one-time Checkout.
- Creating a Team Workspace through plan selection and subscription Checkout.
- Returning Workspace-specific limits and usage.
- Creating signed Asset uploads.
- Finalizing uploads idempotently.
- Returning Asset processing status.
- Worker job lease, heartbeat, completion, and failure operations through a separate worker trust boundary.

The manager API, browser domain layer, upload function, worker API, and callback endpoint must not collapse into one unauthenticated surface.

---

## 15. Required implementation changes

This approved model requires implementation work before it may be represented as live.

At minimum, engineering must address:

- Workspace type representation for Personal and Team Workspaces.
- Idempotent first-Personal-Workspace provisioning.
- Multiple Workspace memberships or ownerships per account.
- Active Workspace selection.
- Removal of any rule that permanently limits a user to one active Team or Workspace.
- Personal Free entitlements.
- Server-side enforcement of 2 Displays, 5 Boards, and 5 monthly source uploads.
- Monthly usage accounting.
- One-time Stripe Checkout for additional Personal Workspaces.
- Webhook idempotency for one-time Workspace purchases.
- Clear separation from recurring Team subscriptions.
- Private Supabase Storage buckets or paths.
- Signed upload and download operations.
- Durable Asset processing jobs.
- Worker authentication and job leasing.
- PowerPoint rendering worker.
- Signed completion callback.
- Asset processing status in the UI.
- Queue and worker observability.
- Tests for Workspace isolation, quota enforcement, billing modes, queue leases, retries, and callback idempotency.

No migration, deployment, or billing configuration change is authorized merely by this SOP amendment.

---

## 16. Sales and representation rules

Scena may describe the approved product model as:

- Every account includes one Personal Workspace.
- Personal Free includes up to 2 Displays, 5 Boards, and 5 source Asset uploads per month.
- Additional Personal Workspaces cost $15 each as a one-time purchase.
- Team Workspaces use recurring Plus, Pro, or Max plans.

Until implementation and acceptance tests pass, sales and UI copy must clearly label this as pre-launch, beta, planned, or controlled testing as appropriate.

Personnel must not:

- Describe the $15 Personal Workspace purchase as monthly.
- Describe a Team plan as a one-time purchase.
- Claim extra Personal Workspaces are provisioned before the verified payment webhook succeeds.
- Claim the queue is operational merely because a table or worker source exists.
- Claim PowerPoint conversion is live without a successful upload-to-ready test.
- Claim home-worker storage is the durable source of truth.
- Manually bypass Workspace, quota, or billing checks.

Board editing capability claims must follow the capability matrix in `docs/sop/Purpose.md` §6.5. In particular, typography, scene timing/transitions, QR links, ticker/countdown behavior, and ready Asset previews are supported persisted Board features. Weather, video, music player, and live data text are configuration previews only until their respective live data or ingest providers are implemented; they must not be sold or rendered as live customer data.

---

## 17. Acceptance criteria

This amendment may be marked operational only when all applicable checks pass.

### Personal Workspace

- [ ] First sign-in provisions exactly one Personal Workspace.
- [ ] Repeated provisioning attempts create no duplicate Workspace.
- [ ] Personal Workspace can own Boards, Assets, Displays, and Sessions.
- [ ] Two-Display limit is enforced server-side.
- [ ] Five-Board limit is enforced server-side.
- [ ] Five-source-upload monthly limit is enforced server-side.
- [ ] Monthly usage resets correctly.
- [ ] Derived slide images do not consume additional upload quota.

### Additional Personal Workspace

- [ ] Stripe Checkout uses one-time payment mode.
- [ ] The price is exactly $15 USD.
- [ ] Successful verified payment creates exactly one Workspace.
- [ ] Failed or abandoned payment creates no Workspace.
- [ ] Webhook replay creates no duplicate Workspace.
- [ ] The additional Workspace has its own isolated resources and Personal limits.

### Team Workspace

- [ ] Plus, Pro, and Max use recurring subscription mode.
- [ ] Verified webhook provisions the Team Workspace.
- [ ] Purchaser becomes Owner.
- [ ] Team members and roles remain Workspace-scoped.
- [ ] Personal purchases cannot activate Team entitlements.

### Workspace switching

- [ ] User can list every accessible Workspace.
- [ ] User can switch among owned and joined Workspaces.
- [ ] Cached data refreshes after switching.
- [ ] Cross-Workspace resource access is rejected.
- [ ] Stale requests cannot mutate the previously active Workspace.

### Asset pipeline

- [ ] Original source uploads to private Supabase Storage.
- [ ] Finalization consumes quota exactly once.
- [ ] A durable processing job is created.
- [ ] Worker leases the job atomically.
- [ ] Worker downloads through a scoped, short-lived URL.
- [ ] PowerPoint is converted locally into ordered slide images.
- [ ] Outputs and manifest upload to private Supabase Storage.
- [ ] Signed callback marks the correct Asset ready exactly once.
- [ ] Worker outage leaves the Asset safely queued.
- [ ] Lease expiration recovers abandoned work.
- [ ] Retry limits prevent infinite processing loops.
- [ ] Cross-Workspace source and output access is rejected.

---

## 18. Immediate release impact

This amendment changes the previously documented assumption that Personal users cannot operate Scena resources.

Engineering and UI work must now treat a Personal Workspace as a real Workspace with limited entitlements, not as a dead-end account state.

Existing code, database constraints, billing logic, documentation, and UI that assume one active Team per user must be audited before public release.

The Asset upload pipeline must move toward private Supabase Storage plus durable queued processing. The home worker remains the processing engine, but it is not the canonical permanent store.

Implementation status must remain explicit:

- **Approved:** product and architecture decision in this amendment.
- **Implemented:** source and schema exist.
- **Deployed:** runtime is active.
- **Verified:** the complete customer journey passed acceptance testing.

These labels are not interchangeable.
