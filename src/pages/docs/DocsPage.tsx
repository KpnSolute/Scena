import {
  ArrowRight, Browser, CheckCircle, ClipboardText, CloudArrowUp, Code, Cpu, Desktop,
  Gear, MonitorPlay, ShieldCheck, Sparkle, Television, WarningCircle,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ScenaMark } from "../../components/brand/ScenaMark";

type Player = {
  icon: ReactNode;
  title: string;
  eyebrow: string;
  description: string;
  bestFor: string;
  steps: string[];
  note: string;
};

const PLAYERS: Player[] = [
  {
    icon: <Cpu size={28} />,
    title: "Raspberry Pi player",
    eyebrow: "Low-cost, always-on",
    description: "Turn a Raspberry Pi 4 or 5 into a dedicated player for stores, classrooms, offices, and multi-location networks.",
    bestFor: "Best for: reliable installations where you want a small, serviceable device behind every display.",
    steps: ["Install Raspberry Pi OS with a desktop environment.", "Connect the Pi to Wi-Fi or Ethernet and set the display resolution.", "Open the Scena display URL in Chromium and enable kiosk mode.", "Pair the six-digit code with your Workspace."],
    note: "Use a quality power supply, disable screen blanking, and enable automatic restart after power loss.",
  },
  {
    icon: <Desktop size={28} />,
    title: "Windows kiosk",
    eyebrow: "Flexible and familiar",
    description: "Use an existing Windows mini PC, laptop, or Intel NUC with a browser locked to the Scena player page.",
    bestFor: "Best for: teams already managing Windows devices or needing extra peripherals and local software.",
    steps: ["Install current Chrome or Edge on the Windows device.", "Set the display as the primary monitor and choose the target resolution.", "Launch the Scena display URL in full-screen or Assigned Access kiosk mode.", "Pair the six-digit code with your Workspace."],
    note: "Set Windows to sign in automatically, prevent sleep, and restart the browser after updates or power recovery.",
  },
  {
    icon: <Television size={28} />,
    title: "Smart TV browser",
    eyebrow: "Fastest to try",
    description: "Use a modern smart TV browser when the display can stay online and the built-in browser supports full-screen playback.",
    bestFor: "Best for: pilots, meeting rooms, and simple installations where an external player is not required.",
    steps: ["Connect the TV to a stable network and open its browser.", "Navigate to the Scena display URL.", "Enter full-screen mode and keep the TV from entering energy-saving sleep.", "Pair the six-digit code with your Workspace."],
    note: "Browser support and sleep behavior vary by TV model. For critical signage, use a dedicated Pi or Windows player.",
  },
];

// Must match public.plan_entitlements exactly. A number or capability stated
// here that the database does not grant is a promise the product will reject
// at write time — `enforce_automation_entitlement` refuses an automation the
// plan's `automation_tier` does not cover, whatever this table says.
const PLAN_ROWS = [
  { name: "Personal Free", price: "$0 forever", workspace: "Personal", displays: "2", boards: "5", members: "1", automation: "—" },
  // plan_entitlements.plus.automation_tier is 'none', not 'basic'.
  { name: "Plus", price: "$15 / month", workspace: "Team", displays: "2", boards: "10", members: "5", automation: "—" },
  { name: "Pro", price: "$25 / month", workspace: "Team", displays: "5", boards: "30", members: "10", automation: "Basic" },
  { name: "Max", price: "$40 / month", workspace: "Team", displays: "15", boards: "50", members: "25", automation: "Advanced" },
];

const SETUP_STEPS = [
  { number: "01", icon: <ClipboardText size={20} />, title: "Create a Workspace", body: "Start with Personal Free or choose a Team plan when multiple people will design, operate, or review your network." },
  { number: "02", icon: <Sparkle size={20} />, title: "Build your Board", body: "Create Scenes, add text, images, Assets, shapes, and live Elements, then save revisions as you refine the layout." },
  { number: "03", icon: <MonitorPlay size={20} />, title: "Add your Displays", body: "Open the player on a physical screen. Scena shows a six-digit pairing code so the display can join the right Workspace." },
  { number: "04", icon: <Gear size={20} />, title: "Run a Session", body: "Assign screens, choose the board experience, and use the Sessions area to manage how your network is operated." },
];

export function DocsPage() {
  return (
    <div className="scena-docs">
      <header className="scena-docs__topbar">
        <Link to="/" className="scena-docs__brand" aria-label="Scena home">
          <span className="scena-docs__brand-mark"><ScenaMark size={18} color="currentColor" /></span>
          Scena <span>Docs</span>
        </Link>
        <nav className="scena-docs__topnav" aria-label="Documentation navigation">
          <a href="#quick-start">Quick start</a>
          <a href="#players">Players</a>
          <Link to="/community">Community <ArrowRight size={15} /></Link>
          <a href="#plans">Plans</a>
          <Link to="/login">Open Scena <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <div className="scena-docs__layout">
        <aside className="scena-docs__sidebar" aria-label="Documentation sections">
          <div className="scena-docs__sidebar-label">On this page</div>
          <a className="scena-docs__sidebar-link scena-docs__sidebar-link--active" href="#overview">Overview</a>
          <a className="scena-docs__sidebar-link" href="#quick-start">Quick start</a>
          <a className="scena-docs__sidebar-link" href="#players">Choose a player</a>
          <a className="scena-docs__sidebar-link" href="#network">Build your network</a>
          <a className="scena-docs__sidebar-link" href="#plans">Plans and limits</a>
          <a className="scena-docs__sidebar-link" href="#troubleshooting">Troubleshooting</a>
          <Link className="scena-docs__sidebar-link" to="/community">Ask the community <ArrowRight size={13} /></Link>
          <div className="scena-docs__sidebar-card">
            <CloudArrowUp size={20} />
            <strong>Ready to build?</strong>
            <span>Start with a free Personal Workspace.</span>
            <Link to="/login">Start free <ArrowRight size={14} /></Link>
          </div>
        </aside>

        <main className="scena-docs__main">
          <section className="scena-docs__hero" id="overview">
            <div className="scena-docs__eyebrow"><span /> CUSTOMER GUIDE</div>
            <h1>From first Board<br />to a network of screens.</h1>
            <p className="scena-docs__hero-copy">Scena helps you design what people see, connect the screens that show it, and keep every location on brand. This guide walks you through the full setup—from creating your first Board to choosing the player that fits your installation.</p>
            <div className="scena-docs__hero-actions">
              <a className="scena-docs__button scena-docs__button--primary" href="#quick-start">Start the guide <ArrowRight size={17} /></a>
              <Link className="scena-docs__button scena-docs__button--quiet" to="/">See Scena overview</Link>
            </div>
            <div className="scena-docs__hero-note"><CheckCircle size={17} /> Personal Free includes 2 Displays and 5 Boards.</div>
          </section>

          <section className="scena-docs__section" id="quick-start">
            <div className="scena-docs__section-heading">
              <div><div className="scena-docs__eyebrow">THE CORE WORKFLOW</div><h2>Your first network in four moves.</h2></div>
              <p>Keep the work in Scena and the hardware simple. Your content lives in Boards; your physical devices are just players that join a Workspace.</p>
            </div>
            <div className="scena-docs__steps">
              {SETUP_STEPS.map((step) => <article className="scena-docs__step" key={step.number}><div className="scena-docs__step-top"><span>{step.number}</span><i>{step.icon}</i></div><h3>{step.title}</h3><p>{step.body}</p></article>)}
            </div>
          </section>

          <section className="scena-docs__section scena-docs__section--players" id="players">
            <div className="scena-docs__eyebrow">HARDWARE PATHS</div>
            <h2>Choose the player that fits your space.</h2>
            <p className="scena-docs__section-intro">Scena displays are browser-based. That gives you options: a small dedicated computer, a Windows device you already manage, or a smart TV for a lightweight pilot.</p>
            <div className="scena-docs__player-grid">
              {PLAYERS.map((player) => <article className="scena-docs__player-card" key={player.title}><div className="scena-docs__player-icon">{player.icon}</div><div className="scena-docs__eyebrow">{player.eyebrow}</div><h3>{player.title}</h3><p>{player.description}</p><div className="scena-docs__player-best">{player.bestFor}</div><ol>{player.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol><div className="scena-docs__player-note"><WarningCircle size={16} />{player.note}</div></article>)}
            </div>
            <div className="scena-docs__compatibility"><div className="scena-docs__compatibility-title"><Code size={18} /> Version guidance</div><div><strong>Scena web app</strong><span>Always current in the cloud. Boards, Assets, Displays, Sessions, and plan entitlements come from your Workspace.</span></div><div><strong>Display player</strong><span>Browser-based across the supported paths above. Keep the browser current and use full-screen mode for production.</span></div><div><strong>Device software</strong><span>Raspberry Pi OS, Windows, and smart TV firmware are managed on the device. Update them on a maintenance schedule.</span></div></div>
          </section>

          <section className="scena-docs__section" id="network">
            <div className="scena-docs__section-heading">
              <div><div className="scena-docs__eyebrow">NETWORK BASICS</div><h2>Design once. Operate everywhere.</h2></div>
              <p>A dependable display network has three layers. Keep them separate and troubleshooting becomes much easier.</p>
            </div>
            <div className="scena-docs__layers">
              <article><span className="scena-docs__layer-number">01</span><div><h3>Content layer</h3><p>Boards, Scenes, Assets, and live Elements define what viewers see. Use revisions to safely refine your layouts.</p></div></article>
              <article><span className="scena-docs__layer-number">02</span><div><h3>Workspace layer</h3><p>Members, roles, locations, and plan limits define who can build, operate, and review the network.</p></div></article>
              <article><span className="scena-docs__layer-number">03</span><div><h3>Player layer</h3><p>Raspberry Pi, Windows, or a smart TV browser renders the display experience and reconnects when the network returns.</p></div></article>
            </div>
            <div className="scena-docs__callout"><ShieldCheck size={22} /><div><strong>Good to know</strong><p>Pairing connects a physical screen to a Workspace. It does not expose your editor or member settings on the device.</p></div></div>
          </section>

          <section className="scena-docs__section" id="plans">
            <div className="scena-docs__eyebrow">PLANS AND CAPACITY</div>
            <h2>Start small. Grow with your network.</h2>
            <p className="scena-docs__section-intro">Choose based on the number of physical Displays and people who need to work in the Workspace. You can begin with Personal Free and move to a Team plan as your network expands.</p>
            <div className="scena-docs__table-wrap"><table className="scena-docs__table"><caption className="scena-docs__sr-only">Scena plan limits</caption><thead><tr><th>Plan</th><th>Workspace</th><th>Displays</th><th>Boards</th><th>Members</th><th>Automation</th></tr></thead><tbody>{PLAN_ROWS.map((plan) => <tr key={plan.name}><th scope="row"><strong>{plan.name}</strong><small>{plan.price}</small></th><td>{plan.workspace}</td><td>{plan.displays}</td><td>{plan.boards}</td><td>{plan.members}</td><td>{plan.automation}</td></tr>)}</tbody></table></div>
            <p className="scena-docs__fine-print">All plans use the same Board and display workflow. Team plans add shared Workspace collaboration and increasing capacity; availability and billing are managed in Scena.</p>
          </section>

          <section className="scena-docs__section scena-docs__section--trouble" id="troubleshooting">
            <div className="scena-docs__eyebrow">WHEN SOMETHING ISN'T RIGHT</div>
            <h2>Fast checks before you replace hardware.</h2>
            <div className="scena-docs__checks"><div><Code size={19} /><strong>Screen is blank</strong><p>Confirm the device has internet, the player URL is open, and the browser is not asleep or blocked by an extension.</p></div><div><MonitorPlay size={19} /><strong>Pairing code expired</strong><p>Refresh the display page to generate a fresh six-digit code, then pair it from the Displays area.</p></div><div><Browser size={19} /><strong>Layout looks wrong</strong><p>Check the screen resolution and browser zoom. For production, use a dedicated player with a fixed resolution.</p></div></div>
          </section>

          <footer className="scena-docs__footer"><div className="scena-docs__brand"><span className="scena-docs__brand-mark"><ScenaMark size={17} color="currentColor" /></span>Scena <span>Docs</span></div><span>Boards, Assets, and Displays for real digital signage.</span><Link to="/login">Open your Workspace <ArrowRight size={15} /></Link></footer>
        </main>
      </div>
    </div>
  );
}
