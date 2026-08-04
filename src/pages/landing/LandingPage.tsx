// Public marketing site — mounted at "/" for everyone, signed in or not.
// A signed-in visitor sees a "Dashboard" link instead of "Sign in" / "Start
// free"; there is no forced redirect away from the marketing page, matching
// how most SaaS marketing sites behave when visited while authenticated.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SquaresFour, Images, Monitor, CalendarBlank, UsersThree, Check, CaretDown,
  Rocket, ShieldCheck, Lightning as LightningIcon,
} from "@phosphor-icons/react";
import { Button } from "../../components/ui/Button";
import { ScenaMark } from "../../components/brand/ScenaMark";
import { Accordion } from "../../components/ui/Accordion";
import { HeroEditorDemo } from "./HeroEditorDemo";
import { supabase } from "../../services/supabase/client";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#faq" },
];

const VALUE_PROPS = [
  { icon: <SquaresFour size={22} />, title: "Boards", desc: "Design Scenes from text, images, Assets, and live data Elements on a real canvas." },
  { icon: <Images size={22} />, title: "Assets", desc: "Upload images, PDFs, and PowerPoint files — Scena renders pages and previews automatically." },
  { icon: <Monitor size={22} />, title: "Displays", desc: "Pair physical screens with a six-digit code and see Board changes reach them." },
  { icon: <CalendarBlank size={22} />, title: "Scheduling", desc: "Run Sessions across Displays with per-screen layout, rotation, and viewport control." },
  { icon: <UsersThree size={22} />, title: "Workspace collaboration", desc: "Personal and Team Workspaces with Owner, Admin, Operator, Designer, and Viewer roles." },
];

const CAPABILITY_STATS = [
  { value: "3", label: "supported Asset types — image, PDF, PowerPoint" },
  { value: "10", label: "live Board Element types, from clocks to tickers" },
  { value: "2", label: "Displays included on Personal Free" },
  { value: "4", label: "plans, from Free to Max" },
];

const STEPS = [
  { title: "Sign in", desc: "Continue with Google, or a one-time email link. No password to remember." },
  { title: "Upload Assets", desc: "Drag in images, PDFs, or a PowerPoint deck. Scena processes pages automatically." },
  { title: "Build a Board", desc: "Arrange Scenes and Elements on a real canvas, sized to your Display." },
  { title: "Pair a Display", desc: "Enter the six-digit pairing code shown on the screen to connect it to your Workspace." },
];

// `availability` mirrors public.plan_entitlements.availability, which SOP §6
// treats as data rather than convention. A plan that is not
// `generally_available` must not be presented as an ordinary purchase: SOP §3.1
// forbids selling an unavailable capability without a written limitation.
const PRICING = [
  { code: "personal_free", name: "Personal Free", price: "$0", cadence: "forever", availability: "generally_available", features: ["1 Personal Workspace", "2 Displays", "5 Boards", "5 source uploads / month", "1 member"] },
  { code: "personal_additional", name: "Additional Personal", price: "$15", cadence: "one-time", availability: "generally_available", features: ["One more Personal Workspace", "Same Personal Free limits", "No recurring charge"] },
  { code: "plus", name: "Plus", price: "$15", cadence: "/month", availability: "limited", features: ["Team Workspace", "2 Displays", "10 Boards", "5 members", "1 concurrent Session"], featured: true },
  { code: "pro", name: "Pro", price: "$25", cadence: "/month", availability: "limited", features: ["Team Workspace", "5 Displays", "30 Boards", "10 members", "Basic automation"] },
  // Max stays unavailable until Display Groups, Session Groups, resource access
  // control and templates are reachable from the manager UI. Working schema is
  // not a shipped product (SOP §6).
  { code: "max", name: "Max", price: "$40", cadence: "/month", availability: "unavailable", features: ["Team Workspace", "15 Displays", "50 Boards", "25 members", "Advanced automation, groups"] },
];

const AVAILABILITY_NOTE: Record<string, string> = {
  limited: "Limited availability — onboarding is reviewed before your Workspace is provisioned.",
  unavailable: "Not yet available. Groups and advanced automation are still in development.",
};

const FAQ = [
  { key: "what", question: "What is Scena?", answer: "Scena is a digital signage platform for building Boards and playing them on paired Displays, backed by real Workspace, Asset, and Board APIs." },
  { key: "free", question: "Is there a free plan?", answer: "Yes. Personal Free includes one automatically-provisioned Workspace with 2 Displays, 5 Boards, and 5 source uploads a month, for one member." },
  { key: "files", question: "What can I upload as an Asset?", answer: "Images, PDFs, and PowerPoint presentations up to 250 MB. Scena generates page thumbnails and previews automatically." },
  { key: "teams", question: "Can I collaborate with a Team?", answer: "Yes — Team Workspaces (Plus, Pro, Max) support multiple members with Owner, Admin, Operator, Designer, and Viewer roles." },
  { key: "publish", question: "Can I publish a Board to a Display right now?", answer: "Board drafts, revisions, and Display pairing are live today. Publishing a Board directly to a Display is being built next — the control stays disabled in the product until it's ready, rather than pretending it works." },
];

export function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase?.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="scena-landing">
      <div className="scena-landing__nav-wrap">
        <nav className="scena-landing__nav scena-glass-medium">
          <Link to="/" className="scena-landing__logo">
            <span className="scena-landing__logo-mark" aria-hidden="true"><ScenaMark size={18} color="#fff" /></span>
            Scena
          </Link>
          <div className="scena-landing__nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href}>{link.label}</a>
            ))}
            <Link to="/docs">Docs</Link>
          </div>
          <div className="scena-landing__nav-actions">
            {signedIn ? (
              <Link to="/app/home"><Button variant="primary" size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/login"><Button variant="primary" size="sm">Start free</Button></Link>
              </>
            )}
          </div>
        </nav>
      </div>

      <header className="scena-hero">
        <span className="scena-pill scena-glass-soft">
          <Rocket size={14} /> Personal Workspaces are free, forever
        </span>
        <h1>The Board editor for real digital signage.</h1>
        <p>
          Scena turns Assets, live data, and a real canvas into Boards that play on paired Displays —
          with versioned saves, revision history, and a Workspace model built for teams.
        </p>
        <div className="scena-hero__actions">
          <Link to="/login"><Button variant="primary" size="lg">Start free</Button></Link>
          <a href="#how-it-works"><Button variant="secondary" size="lg">See how it works</Button></a>
        </div>

        <HeroEditorDemo />
      </header>

      <section className="scena-section" id="product">
        <div className="scena-section__eyebrow">What you get</div>
        <h2 className="scena-section__title">Everything a Board needs, in one Workspace</h2>
        <div className="scena-value-grid">
          {VALUE_PROPS.map((item) => (
            <div className="scena-value-card" key={item.title}>
              <div className="scena-value-card__icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="scena-section">
        <div className="scena-section__eyebrow">Built, not promised</div>
        <h2 className="scena-section__title">Real capability, not a demo</h2>
        <div className="scena-stats-grid">
          {CAPABILITY_STATS.map((stat) => (
            <div className="scena-stat-card" key={stat.label}>
              <div className="scena-stat-card__value">{stat.value}</div>
              <div className="scena-stat-card__label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="scena-section" id="how-it-works">
        <div className="scena-section__eyebrow">How it works</div>
        <h2 className="scena-section__title">From sign-in to a screen playing content</h2>
        <div className="scena-steps">
          {STEPS.map((step, index) => (
            <div className="scena-step" key={step.title}>
              <div className="scena-step__num">{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="scena-section" id="pricing">
        <div className="scena-section__eyebrow">Pricing</div>
        <h2 className="scena-section__title">Start free. Upgrade your Workspace when you need to.</h2>
        <div className="scena-pricing-grid">
          {PRICING.map((plan) => (
            <div className={`scena-price-card${plan.featured ? " scena-price-card--featured" : ""}`} key={plan.code}>
              <h3>{plan.name}</h3>
              <div className="scena-price-card__price">
                {plan.price} <span>{plan.cadence}</span>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={16} weight="bold" />
                    {feature}
                  </li>
                ))}
              </ul>
              {AVAILABILITY_NOTE[plan.availability] ? (
                <p className="scena-price-card__availability">{AVAILABILITY_NOTE[plan.availability]}</p>
              ) : null}
              {plan.availability === "unavailable" ? (
                <Button variant="secondary" block disabled>
                  Coming later
                </Button>
              ) : (
                <Link to="/login">
                  <Button variant={plan.featured ? "primary" : "secondary"} block>
                    {plan.code === "personal_free" ? "Start free" : "Choose plan"}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="scena-section" id="faq">
        <div className="scena-section__eyebrow">FAQ</div>
        <h2 className="scena-section__title">Frequently asked questions</h2>
        <div style={{ maxWidth: 720, margin: "var(--scena-space-10) auto 0" }}>
          <Accordion items={FAQ.map((item) => ({ key: item.key, question: item.question, answer: item.answer }))} />
        </div>
      </section>

      <section className="scena-final-cta">
        <ShieldCheck size={36} style={{ color: "#fff", marginBottom: 16 }} />
        <h2>Your first Board is a sign-in away.</h2>
        <p>Personal Workspaces are provisioned automatically — no credit card required.</p>
        <Link to="/login"><Button variant="secondary" size="lg" icon={<LightningIcon size={18} />}>Start free</Button></Link>
      </section>

      <footer className="scena-footer">
        <div className="scena-footer__grid">
          <div className="scena-footer__col">
            <div className="scena-landing__logo" style={{ marginBottom: 12 }}>
              <span className="scena-landing__logo-mark" aria-hidden="true"><ScenaMark size={18} color="#fff" /></span>
              Scena
            </div>
            <p style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-muted)", maxWidth: 260, lineHeight: 1.6 }}>
              Boards, Assets, and Displays for real digital signage.
            </p>
          </div>
          <div className="scena-footer__col">
            <h4>Product</h4>
            <ul>
              <li><a href="#product">Boards</a></li>
              <li><a href="#product">Assets</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>
          <div className="scena-footer__col">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/docs">Customer docs</Link></li>
              <li><Link to="/community">Community forum</Link></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div className="scena-footer__col">
            <h4>Company</h4>
            <ul>
              <li><Link to="/login">Sign in</Link></li>
            </ul>
          </div>
          <div className="scena-footer__col">
            <h4>Legal</h4>
            <ul>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="scena-footer__bottom">
          <span>© {new Date().getFullYear()} Scena, a KpnSolute product.</span>
          <span>All systems operational</span>
        </div>
      </footer>
    </div>
  );
}
