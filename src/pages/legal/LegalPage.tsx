// Public legal pages. Reached from the landing footer, which previously
// pointed both links back at the homepage.
//
// The factual sections below describe what Scena actually does today and were
// written against the live schema and Edge Functions. The items marked
// REVIEW_REQUIRED are commercial and jurisdictional decisions, not engineering
// ones — they must be settled and replaced before Scena accepts live payments.

import { Link } from "react-router-dom";
import { ScenaMark } from "../../components/brand/ScenaMark";

export const LEGAL_REVIEW_REQUIRED = [
  "Governing law and jurisdiction",
  "Refund, cancellation and proration terms",
  "Limitation of liability and warranty disclaimer",
  "Data retention periods per record type",
  "Sub-processor list and international transfer basis",
  "Registered business entity name and contact address",
] as const;

interface Section {
  heading: string;
  body: string[];
}

const TERMS: Section[] = [
  {
    heading: "The service",
    body: [
      "Scena is a digital signage platform operated by KpnSolute. It lets you build Boards, upload Assets, pair Displays, and run Sessions that play content on those Displays.",
      "Scena is offered as-is during its current release. Capability labelled Limited availability or Not yet available on the pricing page is not part of any paid promise.",
    ],
  },
  {
    heading: "Accounts and Workspaces",
    body: [
      "You sign in with Google or a one-time email link. You are responsible for the security of the account you sign in with.",
      "Content belongs to a Workspace. Team Workspaces have Owner, Admin, Operator, Designer and Viewer roles, and access is enforced per Workspace at the database level.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not upload content you lack the rights to display, content that is unlawful, or content that would breach the rights of others when shown in a public place.",
      "Do not attempt to access another Workspace's data, interfere with Display pairing, or disrupt the service for others.",
    ],
  },
  {
    heading: "Plans and billing",
    body: [
      "Paid plans are billed through Stripe. Scena does not receive or store your card details.",
      "Plan limits — Displays, Boards, members, concurrent Sessions and automation — are enforced by the service and are listed on the pricing page.",
    ],
  },
  {
    heading: "Availability and changes",
    body: [
      "Scena is pre-launch and does not currently carry a contractual service level.",
      "Capability may change while Scena is in its current release. A paid capability will not be removed without notice.",
    ],
  },
];

const PRIVACY: Section[] = [
  {
    heading: "What Scena collects",
    body: [
      "Account data: your email address, display name and avatar as provided by your sign-in provider, plus your timezone, locale and interface preferences.",
      "Content you create: Boards, Scenes, Elements, and the Assets you upload (images, PDFs and PowerPoint files), together with the generated page previews.",
      "Operational data: Display pairing state, heartbeats, health and sync status, and a Session event history recording lifecycle actions.",
      "Billing data: your Stripe customer and subscription identifiers, plan, and billing period. Card details are handled by Stripe and never reach Scena.",
    ],
  },
  {
    heading: "What Scena does not collect",
    body: [
      "Scena does not perform audience measurement. Displays report their own health and playback state; they do not collect information about the people who see them.",
      "Scena does not use cameras, microphones, or any form of sensing on paired Displays.",
    ],
  },
  {
    heading: "How it is used",
    body: [
      "Your data is used to operate the service: authenticating you, showing your Workspace, delivering content to your paired Displays, enforcing plan limits, and billing paid plans.",
      "Scena does not sell your data and does not use your content to train models.",
    ],
  },
  {
    heading: "Who processes it",
    body: [
      "Supabase provides authentication, database and file storage. Stripe processes payments. Both act as processors for Scena.",
      "Weather Elements are resolved server-side so your Displays are not exposed to third-party endpoints directly.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can update your profile and preferences in Scena, and manage or cancel a paid plan through the Stripe billing portal.",
      "To request export or deletion of your Workspace data, contact Scena using the address below.",
    ],
  },
];

function LegalShell({ title, updated, sections }: { title: string; updated: string; sections: Section[] }) {
  return (
    <div className="scena-legal">
      <header className="scena-legal__head">
        <Link to="/" className="scena-legal__logo">
          <span className="scena-legal__logo-mark" aria-hidden="true"><ScenaMark size={18} color="#fff" /></span>
          Scena
        </Link>
        <Link to="/" className="scena-legal__back">Back to Scena</Link>
      </header>

      <main className="scena-legal__body">
        <h1>{title}</h1>
        <p className="scena-legal__updated">Last updated {updated}</p>

        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section>
          <h2>Contact</h2>
          <p>
            Questions about this page can be sent to{" "}
            <a href="mailto:support@kpnsolute.com">support@kpnsolute.com</a>.
          </p>
        </section>
      </main>

      <footer className="scena-legal__foot">
        <span>© {new Date().getFullYear()} Scena, a KpnSolute product.</span>
        <Link to={title.startsWith("Terms") ? "/privacy" : "/terms"}>
          {title.startsWith("Terms") ? "Privacy Policy" : "Terms of Service"}
        </Link>
      </footer>
    </div>
  );
}

export function TermsPage() {
  return <LegalShell title="Terms of Service" updated="2 August 2026" sections={TERMS} />;
}

export function PrivacyPage() {
  return <LegalShell title="Privacy Policy" updated="2 August 2026" sections={PRIVACY} />;
}
