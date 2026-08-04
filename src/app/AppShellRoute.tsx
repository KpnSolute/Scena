// Application shell for /app/* — primary icon rail, top utility bar with
// Workspace switcher + account menu, and the routed page content. The
// Workspace switcher and multi-Workspace account context are real
// (workspace-context Edge Function); this shell is the first UI to expose
// them visually.

import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  House, SquaresFour, Images, Monitor, Broadcast, Lightning, UsersThree, Gear,
  CreditCard, MapPin, Layout, PlugsConnected,
} from "@phosphor-icons/react";
import { ScenaMark } from "../components/brand/ScenaMark";
import { useManagerContext } from "./ManagerContextProvider";
import { WorkspaceSwitcher } from "../components/navigation/WorkspaceSwitcher";
import { AccountMenu } from "../components/navigation/AccountMenu";

interface RailItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const RAIL_ITEMS: RailItem[] = [
  { to: "/app/home", label: "Home", icon: <House size={22} />, end: true },
  { to: "/app/boards", label: "Boards", icon: <SquaresFour size={22} /> },
  { to: "/app/assets", label: "Assets", icon: <Images size={22} /> },
  { to: "/app/screens", label: "Displays", icon: <Monitor size={22} /> },
  { to: "/app/layouts", label: "Layouts", icon: <Layout size={22} /> },
  { to: "/app/sessions", label: "Sessions", icon: <Broadcast size={22} /> },
  { to: "/app/automations", label: "Automations", icon: <Lightning size={22} /> },
  { to: "/app/connections", label: "Connections", icon: <PlugsConnected size={22} /> },
  { to: "/app/locations", label: "Locations", icon: <MapPin size={22} /> },
  { to: "/app/members", label: "Members", icon: <UsersThree size={22} /> },
  { to: "/app/billing", label: "Billing", icon: <CreditCard size={22} /> },
  { to: "/app/settings", label: "Settings", icon: <Gear size={22} /> },
];

export function AppShellRoute() {
  const context = useManagerContext();

  return (
    <div className="scena-shell">
      <nav className="scena-rail" aria-label="Main">
        <div className="scena-rail__logo" aria-hidden="true"><ScenaMark size={24} color="#fff" /></div>
        {RAIL_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `scena-rail__item${isActive ? " scena-rail__item--active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="scena-rail__spacer" />
      </nav>

      <div className="scena-shell__body">
        <header className="scena-topbar">
          <WorkspaceSwitcher context={context} />
          <div className="scena-topbar__spacer" />
          <AccountMenu context={context} />
        </header>
        <main className="scena-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
