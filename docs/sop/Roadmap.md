# SOP: Scena Service Expansion and Product Roadmap Decision Procedure

**Service:** Scena
**Company:** KpnSolute
**Service Owner:** Miah
**Technical Delivery Support:** KpnCompute, where applicable
**Version:** 1.3
**Last Updated:** July 31, 2026
**Status:** Pre-launch operating standard
**Current Stage:** Stage 0, Foundation

---

## 1. Purpose

This Standard Operating Procedure defines how Scena decides:

* Which capabilities to build.
* Which capabilities to sell.
* When to introduce a new plan.
* When to enter a new customer vertical.
* When to add integrations.
* When to introduce agency, API, hardware, or white-label offerings.
* When to decline, defer, test, or retire a capability.

The purpose is to prevent Scena's product direction from being driven by:

* A single loud customer.
* An exciting technical idea.
* Competitor imitation.
* Investor pressure without customer evidence.
* Features that create support costs without revenue.
* Features that are sold before they are operational.
* Engineering work that does not improve acquisition, activation, retention, revenue, or reliability.

Scena expands only when evidence shows that the next expansion supports the business and can be delivered safely.

---

## 2. Scope

This procedure applies to decisions involving:

**Product capabilities** — New Board Element types, new Display modes, scheduling, analytics, proof of play, emergency takeover, interactive content, AI-assisted Board generation.

**Commercial plans** — Changes to Plus, Pro, or Max, annual billing, new plan limits, usage-based charges, agency plans, hardware bundles.

**Customer segments** — Restaurants, schools, churches, retail stores, healthcare waiting rooms, corporate offices, events, government or enterprise customers.

**Platform capabilities** — Public API access, API keys, webhooks, SDKs, white-label delivery, integration marketplace, agency account management.

**Delivery models** — Software-only, managed onboarding, hardware bundles, installation services, managed signage service, reseller partnerships.

This SOP governs the business decision to expand. Engineering implementation remains governed by:

* Scena API v2 Definition of Done.
* Scena Core Service Offering and Customer Delivery SOP.
* Scena Security and Deployment procedures.

---

## 3. Product and Expansion Principles

Every expansion decision must follow these principles.

### 3.1 Never sell an unavailable capability

A feature may be labeled: Available, Limited availability, Beta, Pilot, Planned, Under evaluation, or Unsupported. These labels must not be blurred.

A planned feature cannot be included in a paid promise unless:

* The customer receives a written limitation.
* The customer is explicitly enrolled in a pilot.
* The price reflects the incomplete state.
* There is a defined fallback if the feature cannot be delivered.

### 3.2 Current-plan promises take priority

Any capability already advertised as part of Plus, Pro, or Max must be completed before unrelated future expansion work.

For example, if Max advertises Display Groups, Session Groups, advanced automation, and resource-level access control, then those features are part of Max readiness, not a speculative future stage.

Scena must either complete those features before selling Max, or mark Max unavailable until that stage is reached.

### 3.3 Reliability before surface area

A smaller reliable service is more valuable than a broad service requiring manual database repairs.

Before expanding, Scena must confirm that existing customers can: sign in, pay, create or join a Team, pair Displays, publish content, recover from temporary failures, and receive support.

### 3.4 Evidence before complexity

A request is not validated demand merely because someone mentioned it.

Stronger evidence includes: a paying customer blocked by its absence, multiple customers requesting it independently, lost deals with documented reasons, churn or downgrade risk, customers attempting manual workarounds, willingness to pay, real usage reaching an existing limit.

### 3.5 Revenue is not the only signal

A capability may be necessary even when it does not directly generate revenue — security controls, audit trails, backups, monitoring, billing recovery, accessibility, customer data export, Display offline resilience. These are service-health investments, not optional roadmap decorations.

### 3.6 No hidden operational burden

Every feature must be evaluated for: support workload, infrastructure cost, security exposure, billing complexity, data-retention burden, hardware compatibility, monitoring requirements, failure recovery, documentation needs.

A feature is not finished when the demo works. It is finished when it can be supported repeatedly.

---

## 4. Definitions

### 4.1 Paying Team

A valid Stripe subscription, a verified subscription record, an active Plus/Pro/Max entitlement, and a customer who is not using an internal-only test subscription. Free internal Teams, founder tests, and manually inserted records do not count.

### 4.2 Unrelated external customer

Not Miah, not a KpnSolute internal workspace, not an MJCC internal project, not a close collaborator receiving indefinite free service, not a synthetic test account. A discounted pilot may count only when the customer is real, expectations are documented, they use Scena in normal operations, they provide meaningful feedback, and there is a path to paid continuation.

### 4.3 Active Team

Has completed a meaningful action during the measurement period — updated a Board, ran a Session, had a Display retrieve content, used automation, invited a member. Payment alone does not prove product adoption.

### 4.4 Live Display

Securely paired, belongs to the correct Team, has displayed real customer content, has reported recent heartbeats, does not require routine manual database intervention.

### 4.5 Organic upgrade

A customer moves to a higher plan because of real usage or capability need. Does not include a temporary test, an internal account change, a staff-performed upgrade without customer intent, a free promotional assignment, or a forced upgrade from an incorrect quota.

### 4.6 Validated feature request

Has an identified customer or prospect, a clear problem statement, a current workaround, business impact, frequency or volume, evidence of willingness to adopt or pay, and a responsible person who recorded it.

---

## 5. Expansion Categories

Every request must be classified before review.

| Category | Examples | Note |
| --- | --- | --- |
| A: Reliability and safety | Auth failures, billing defects, cross-Team access risk, Display offline recovery, backups, monitoring, audit events | May override normal roadmap sequencing |
| B: Existing service obligation | Capability already promised in Plus/Pro/Max, documented support commitment, published integration, paid pilot commitment | Treated as delivery work, not future expansion |
| C: Retention improvement | Better scheduling, proof of play, Display diagnostics, faster content updates, Team permissions | |
| D: Acquisition improvement | Templates, easier onboarding, better pricing pages, demo environments, vertical starter packs | |
| E: Revenue expansion | Annual billing, usage-based fees, agency tier, API access, hardware margin, premium integrations | |
| F: New market or vertical | Restaurants, schools, churches, retail, healthcare, events | |
| G: Experimental capability | AI-assisted layouts, interactive kiosks, computer vision, dynamic audience targeting | Must not displace service obligations without explicit authorization |

---

## 6. Current Plan Availability Rule

Scena's public availability must be maintained separately from plan design.

| Plan | Designed | May be publicly sold when |
| --- | --- | --- |
| Plus | Yes | Checkout, Team provisioning, Boards, Displays, and one concurrent Session work |
| Pro | Yes | Plus is stable and Pro limits plus daily/weekly automation work |
| Max | Yes | Pro is stable and Max groups, advanced automation, ACL, and higher limits work |

Until all conditions are met, a plan must be marked: Waitlist, Invite only, Pilot, Coming later, or Unavailable.

**A Stripe price existing in the database does not prove the plan is ready to sell.**

Since 2026-07-31 this rule is enforced as data rather than as a convention.
`public.plan_entitlements.availability` carries each plan's commercial
availability — `generally_available`, `limited`, `pilot`, `waitlist` or
`unavailable` — alongside a note stating what must be true before it changes.

Current values:

| Plan | `availability` |
|---|---|
| Personal Free | `generally_available` |
| Plus | `limited` |
| Pro | `limited` |
| Max | `unavailable` |

Changing this field is a stage decision, not an engineering one. It requires a
recorded Stage Transition (§12). **Max having working schema and enforcement for
Groups, ACL and advanced automation is not the same as Max being deliverable.**
The manager UI for those capabilities does not exist yet, so Max stays
`unavailable`.

---

## 7. Roadmap Stages

Stages must be completed in order unless a security, legal, or service-continuity issue requires immediate work.

### Stage 0: Foundation and First External Delivery

**Objective:** Prove that Scena can complete its entire core service loop for one unrelated customer without manual backend intervention.

**Entry condition:** None.

**Required work — Commercial foundation:**
Complete Plus Checkout end to end; complete Pro Checkout end to end before public Pro availability; complete Max obligations or keep Max unavailable; verify Stripe webhook processing; verify Team provisioning; verify Owner membership; verify entitlement provisioning; verify Billing Portal; define failed-payment behavior; define cancellation and downgrade behavior.

**Required work — Product foundation:**
Complete Board creation; complete Display registration and pairing; complete one live Session workflow; verify Display offline cache; provide a usable customer dashboard; provide clear plan comparison; provide basic customer support contact.

**Required work — Operational foundation:**
Logging; request IDs; GitHub Actions; backups; security checks; customer onboarding record; support escalation path; capability register.

**Exit condition** — Stage 0 is complete only when:

* One unrelated paying Team is active.
* At least one real Display shows customer content.
* Customer completed payment without staff inserting billing records.
* Team was provisioned by verified webhook.
* Customer completed at least one normal operation themselves.
* Display remained operational for an agreed observation period.
* No manual database intervention was required after onboarding began.
* Customer understands their plan and support path.
* No unresolved Priority 1 issue exists.

Recommended observation period: at least 14 consecutive days for initial validation, preferably 30 days before declaring repeatability proven.

**Stage 0 non-goals:** Do not prioritize white-label service, enterprise SSO, public developer API monetization, AI Board generation, large integration catalogs, or international expansion.

---

### Stage 1: Repeatability and Category Proof

**Objective:** Prove that Scena solves a repeatable problem for more than one type of customer.

**Entry condition:** Stage 0 exit condition has been documented.

**Primary work — Self-service onboarding:** Reduce staff dependence across sign-up, plan selection, checkout, Team provisioning, Display pairing, Board creation, first Session.

**Primary work — Starter content:** Create three to five starter templates for each vertical with actual paying customers (e.g. food service: daily menu, specials, allergen notice, event announcement, closing screen; churches: welcome, announcements, event calendar, message slide, lobby info; retail: promotion, price board, product highlight, hours, seasonal campaign). Do not build full vertical packs without paying-customer evidence.

**Primary work — Proof of play:** Team, Display, Board, Session, start time, end time or heartbeat period, content version. Must distinguish intended assignment from confirmed Display retrieval.

**Primary work — Support repeatability:** Troubleshooting guide, supported hardware matrix, onboarding checklist, common-error reference, customer handoff template.

**Recommended metrics:** Sign-up to Checkout rate, Checkout completion rate, Checkout-to-live-Display time, median onboarding time, pairing success rate, number of manual interventions, weekly active Teams, active Displays, Board updates per Team, Sessions started, support requests per Team, upgrade reasons, cancellation reasons.

**Exit condition** — Stage 1 is complete when:

* At least three unrelated paying Teams are active.
* Those Teams represent at least two genuine verticals or use cases.
* At least two Teams complete most onboarding without database intervention.
* At least one organic upgrade occurs.
* At least one customer remains active for a meaningful retention period.
* Core support issues are documented.
* No recurring onboarding failure remains unresolved.
* Proof-of-play records are being generated reliably.

Recommended retention evidence: at least 60 days of continued use for one Team, at least 30 days for the remaining Teams.

---

### Stage 2: Retention, Orchestration, and Full Max Readiness

**Objective:** Deepen customer value through scheduling, grouping, live operations, analytics, and reliability.

**Entry condition:** Stage 1 exit condition is met; multiple customers demonstrate scheduling or multi-Display needs; at least one customer has stated willingness to pay for advanced orchestration; existing Plus and Pro workflows are stable.

**Important Max rule:** If Max has not already been completed, this stage is where Max becomes generally available. Before this point, Max must remain unavailable, invite-only, or pilot-only, and sales must not promise full Max behavior.

**Primary work — Automation:** Daily/weekly/hourly/custom schedules where approved, timezone-aware execution, retry history, failure reporting, idempotent scheduler execution.

**Primary work — Display Groups:** Up to four Displays per group, reusable group targeting, Team isolation, group health and status.

**Primary work — Session Groups:** Up to three Sessions, up to twelve Displays, Sessions count against normal concurrent-Session limits, atomic group start where possible, defined partial-failure behavior.

**Primary work — Live operations:** Preview, Program, Take, Swap, Duplicate, Extend, Standby, Emergency takeover.

**Primary work — Analytics:** Expand proof of play into Display uptime, content exposure duration, Session history, failed Display retrieval, automation success, Board usage, Display health trends. Analytics must not claim audience measurement unless Scena actually collects audience evidence.

**Exit condition** — Stage 2 is complete when:

* Max has paying customers.
* Max revenue is tied to actual use of groups, automation, ACL, or advanced Session controls.
* At least one customer uses automation repeatedly.
* At least one customer uses multiple Displays in coordinated operation.
* Advanced features reduce real manual work.
* Advanced features do not create unsustainable support load.
* Max customers retain or expand usage.

---

### Stage 3: Platform, Agency, and Integration Expansion

**Objective:** Allow other businesses, agencies, developers, and systems to build on or distribute Scena.

**Entry condition:** Stage 2 exit condition is met; Scena has stable internal APIs; at least one external developer, agency, or integration partner requests programmatic access with a concrete use case; core customer operations no longer depend on frequent founder intervention.

**Primary work — Developer platform:** API keys, scoped permissions, revocation, rate limits, usage records, developer documentation, OpenAPI, webhooks, sandbox environment, integration examples. Manager Supabase JWT APIs and external developer API keys must remain separate trust models.

**Primary work — Agency offering (possible capabilities):** Manage multiple customer Teams, switch between customer accounts, agency billing, client-level permissions, template sharing, approval workflows, consolidated reporting. An agency must never gain access to a customer Team without explicit authorization.

**Primary work — White-label evaluation:** Custom domain, branding, email branding, player branding, customer-owned billing, support responsibilities, minimum pricing, security implications. White-label should not be introduced merely because CSS branding is easy — it changes support, billing, identity, and customer ownership.

**Primary work — Integration expansion:** Prioritize using actual demand (Google Slides, Canva export, YouTube, Google Drive, OneDrive, calendar sources, restaurant POS, menu-management systems, emergency alert systems, generic REST/webhook feeds).

**Primary work — Hardware offering (possible models):** Recommended hardware list, affiliate links, preconfigured playback device, device lease, full hardware bundle, installation partner network. Before selling hardware, define warranty, returns, replacement, remote support, device ownership, shipping, failure responsibility, and margin.

**Exit condition** — Stage 3 is complete when at least one additional revenue stream is operational (API usage, integration fee, agency fee, white-label fee, hardware margin, managed onboarding fee, installation-partner revenue), and that stream has a real customer, documented pricing, support ownership, billing records, a delivery procedure, and measured operating cost.

---

### Stage 4: Category Expansion

**Objective:** Expand Scena beyond standard managed digital signage only after the platform and business model are stable.

**Entry condition:** Stage 3 produces meaningful recurring or repeatable revenue; core signage revenue is not dependent on one internal customer; support operations are documented; product usage demonstrates clear expansion opportunities; expansion will not destabilize core signage customers.

"Meaningful revenue" must be defined before entering this stage. Recommended measurements: percentage of total recurring revenue, number of paying customers using the platform offering, gross margin, retention, support cost.

**Potential directions:**
- **AI-assisted design** — Board layout suggestions, content resizing, brand-aware templates, copy suggestions, accessibility checks, automatic variants. AI-generated content must remain reviewable before publication.
- **Interactive and kiosk mode** — Touch interactions, wayfinding, forms, product browsing, visitor check-in, queue status. Introduces new security, accessibility, and hardware requirements.
- **Deeper vertical packs** — Restaurant menu operations, school announcements, church communications, retail promotions, event venue signage, corporate dashboards, healthcare waiting rooms. A vertical pack should solve a repeated workflow, not just add decorative templates.
- **Marketplace** — Templates, integrations, data sources, widgets, agency services, approved hardware, paid content packs.
- **Enterprise evaluation** — Only after a separate review of SSO, SCIM, audit exports, dedicated environments, data residency, contracted service levels, procurement requirements, legal/security questionnaires, enterprise support.

**Exit condition:** Not defined in advance. Upon reaching Stage 4, this SOP must be rewritten based on the company and customer evidence available at that time.

---

## 8. Feature Request Intake Procedure

Every request must be recorded with: date, requester, customer or prospect, paying status, current plan, vertical, problem, requested solution, current workaround, frequency, business impact, revenue opportunity, churn risk, number of similar requests, stage alignment, estimated complexity, security or compliance implications, decision, decision date, review date.

**Do not record only the requested feature. Record the underlying problem.**

Weak request: *"Customer wants an AI feature."*

Useful request: *"Restaurant owner spends 45 minutes daily converting one menu into landscape and portrait Boards. They would pay for automatic resizing that preserves editable text."*

---

## 9. Expansion Scoring Framework

Score each proposal from 0 to 5.

| Criterion | Question |
| --- | --- |
| Customer evidence | How many real customers have demonstrated the need? |
| Revenue impact | Will it generate or protect meaningful revenue? |
| Retention impact | Will it reduce churn or increase repeated use? |
| Stage alignment | Does it belong to the current stage? |
| Strategic fit | Does it strengthen Scena's core position? |
| Differentiation | Does it create a meaningful advantage? |
| Delivery confidence | Can it be built and supported reliably? |
| Operational cost | How much ongoing support and infrastructure does it require? |
| Security risk | Does it significantly expand the attack surface? |
| Reusability | Will several customers benefit, or only one? |

```text
Priority score =
  (customer evidence × 3)
  + revenue impact
  + retention impact
  + stage alignment
  + strategic fit
  + reusability
  - operational cost
  - security risk
```

The score supports judgment. It does not replace judgment.

---

## 10. Decision Outcomes

Every reviewed proposal receives one of these outcomes:

* **Approved** — authorized for planning and delivery. Must include scope, customer problem, success metric, owner, target stage, dependencies, commercial treatment, Definition of Done.
* **Experiment** — a limited, time-boxed test. Must define hypothesis, duration, maximum engineering effort, participants, success metric, failure metric, whether it may reach production customers, cleanup plan.
* **Deferred** — the problem may be valid, but entry conditions aren't met, evidence is insufficient, higher-priority obligations remain, or operational risk is too high. Set a review trigger, not merely "later."
* **Rejected** — inconsistent with product direction, customer safety, security, economics, current service model, or legal responsibilities. Record the reason.
* **Needs discovery** — the problem is unclear and requires customer interviews, usage analysis, prototype, technical investigation, or pricing research.

---

## 11. Stage Review Procedure

Conduct a formal stage review: monthly during pre-launch, at least quarterly after launch, whenever a stage exit condition may have been reached, before announcing a new plan or major capability.

**Review steps:** Confirm current stage → review paying Team count → review active Team count → review active Display count → review revenue by plan → review upgrades and downgrades → review churn and cancellations → review onboarding time → review support incidents → review feature requests → review infrastructure and support cost → review current-plan obligation gaps → check current stage exit conditions → check next stage entry conditions → decide (remain in stage / begin an experiment / transition stage / roll back an expansion) → record the evidence and decision.

---

## 12. Stage Transition Record

Every stage transition must document: previous stage, new stage, decision date, decision owner, evidence for every exit condition, evidence for every entry condition, paying Team count, active Team count, active Display count, monthly recurring revenue, churn, customer-request evidence, operational readiness, security readiness, support readiness, capabilities authorized, capabilities still prohibited, next review date.

**A stage transition discussed verbally but not recorded is not authorized.**

---

## 13. Exceptions

* **Security or legal issue** — may interrupt the staged roadmap immediately (cross-Team data access, payment errors, credential leaks, data-loss risk, fraud, legal takedown).
* **Customer-specific contract** — approved outside the stage sequence only when the work is separately priced, ownership is clear, it doesn't weaken the core product, support obligations are documented, it doesn't create a secret fork, reusability has been evaluated, and the service owner explicitly approves it.
* **Strategic partnership** — may justify earlier work only when the partner provides real distribution or revenue, commitments are written, scope is limited, opportunity cost is documented, and Scena retains control of its core platform.
* **Competitor pressure** — not enough evidence by itself. Investigate whether Scena customers care, whether the feature drives purchase, whether it creates retention, whether Scena can support it, and whether copying it harms focus.

---

## 14. Capacity Allocation

While Scena remains early stage, use this operating default:

* **60%** current-stage delivery and reliability.
* **25%** customer-requested improvements.
* **15%** experiments and research.

During an outage, launch blocker, or security issue, reliability may temporarily consume all available capacity.

Future-stage experiments must not prevent: checkout from working, Displays from staying online, customers from receiving support, or current-plan obligations from being fulfilled.

---

## 15. Sunset and Rollback Procedure

Expansion includes the ability to stop supporting an unsuccessful feature.

A capability may be considered for retirement when: almost no customers use it, it creates disproportionate support cost, it has unresolved security risk, a replacement exists, it no longer fits the product, or the provider dependency is ending.

**Before retirement:** identify affected Teams → identify stored customer data → provide notice → provide export or migration where appropriate → stop new adoption → preserve existing behavior for a transition period → update pricing and documentation → remove safely → verify no broken Boards, Sessions, or Displays remain → record the decision.

**Never silently remove a paid capability.**

---

## 16. Roadmap Status Labels

Every roadmap item must have one status: Researching, Proposed, Approved, In design, In development, Internal testing, Customer pilot, Limited availability, Generally available, Paused, Rejected, Retiring, Retired.

**"Planned" by itself is too vague.**

---

## 17. Current Roadmap Snapshot

**Current stage:** Stage 0, Foundation and First External Delivery.

**Current verified capabilities:** Google authentication, profile provisioning, Personal no-Team state, plan listing, API v2 foundation, GitHub Actions CI, Stripe webhook reachability for at least one test event.

**Stage 2 groundwork completed early (2026-07-31).** The database layer for
Display Groups, Session Groups, resource-level access control, advanced
automation tiers with execution history, Session lifecycle, readiness, health
and history was implemented and verified. This was authorised as Category A/B
work: it closes current-plan obligations (§3.2) and removes the "two
disconnected content models" defect that blocked Board-to-Display delivery.

It does **not** advance the stage. Stage 0 exit conditions are unchanged and
unmet, and Max remains unavailable. See
`docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md`.

**Current blockers:** billing-checkout configuration or Stripe connectivity failure; no completed real Checkout Session; no webhook-provisioned Team; no verified paid entitlements; no fully verified Billing Portal; Display registration and pairing not fully verified; Board-to-Display first-customer workflow not fully verified; Max availability conflicts with unfinished advanced capabilities.

**Immediate priorities:** Fix billing-checkout → complete one Plus sandbox purchase → verify Team provisioning → verify Owner membership → verify Plus entitlements → verify webhook replay safety → verify Billing Portal → verify subscription cancellation and payment-failure behavior → complete Display registration and pairing → complete first Board and Session workflow → deliver one external paying Team → observe normal operation before authorizing Stage 1.

**Capabilities not yet authorized for general sale (until verified):** Full Max, Display Groups, Session Groups, advanced automation, resource-level access control, public developer API keys, white-label service, hardware bundles, enterprise SSO or SCIM, AI-assisted Board generation, interactive kiosk mode.

---

## 18. Definition of Done

**A roadmap stage is complete only when:**

* [ ] Every exit condition is supported by recorded evidence.
* [ ] Current-plan obligations are fulfilled.
* [ ] No unresolved Priority 1 blocker exists.
* [ ] Support can handle the stage's capabilities.
* [ ] Security boundaries are tested.
* [ ] Billing treatment is defined.
* [ ] Documentation reflects actual availability.
* [ ] Sales language reflects actual availability.
* [ ] Customer-facing pricing reflects actual availability.
* [ ] The next stage's entry conditions are met.
* [ ] The transition decision is recorded.
* [ ] The next review date is recorded.

**A capability expansion is complete only when:**

* [ ] The capability has a clear customer problem.
* [ ] The capability has a defined owner.
* [ ] The capability has an implementation Definition of Done.
* [ ] Security and privacy implications were reviewed.
* [ ] Billing and entitlement behavior are defined.
* [ ] Plan availability is updated.
* [ ] Customer documentation exists.
* [ ] Support documentation exists.
* [ ] Analytics or usage evidence exists.
* [ ] Rollback behavior is defined.
* [ ] The capability has passed customer acceptance.
* [ ] It is labeled accurately as pilot, limited availability, or generally available.

---

## 19. Related Documents

* Scena Core Service Offering and Customer Delivery (`purpose.md`)
* Scena API v2 Definition of Done
* Scena Service Capability Register
* Scena Customer Feature Request Register
* Scena Stage Transition Record
* Scena Pricing and Plan Policy
* Scena Billing and Subscription Policy
* Scena Supported Hardware Matrix
* Scena Support and Incident Escalation Policy
* Scena Data Retention and Feature Retirement Policy
* Scena Security Incident Response Procedure
* Scena Customer Onboarding Record
