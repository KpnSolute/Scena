import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, Gear, CreditCard, Question, SignOut } from "@phosphor-icons/react";
import { DropdownMenu, MenuSeparator } from "../ui/Menu";
import { Avatar } from "../ui/Avatar";
import { signOut } from "../../auth/session";
import { supabase } from "../../services/supabase/client";
import type { ManagerContext } from "../../auth/organization-context";

export function AccountMenu({ context }: { context: ManagerContext }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase?.auth.getSession().then(({ data }) => {
      if (active) setEmail(data.session?.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const name = context.profile.displayName || email || "Your account";

  return (
    <DropdownMenu
      trigger={
        <button type="button" className="scena-account-trigger" aria-label="Account menu">
          <Avatar name={name} src={context.profile.avatarUrl} size="md" />
        </button>
      }
      items={[
        { key: "identity", disabled: true, label: <AccountHeader name={name} email={email} planCode={context.workspace.entitlements?.plan_code} /> },
        { key: "sep-1", disabled: true, label: <MenuSeparator /> },
        { key: "profile", icon: <UserCircle size={18} />, label: "Profile", onSelect: () => navigate("/app/settings") },
        { key: "settings", icon: <Gear size={18} />, label: "Settings", onSelect: () => navigate("/app/settings") },
        { key: "billing", icon: <CreditCard size={18} />, label: "Billing", onSelect: () => navigate("/app/billing") },
        { key: "help", icon: <Question size={18} />, label: "Help", onSelect: () => window.open("https://scena.kpnsolute.com", "_blank", "noopener") },
        { key: "sep-2", disabled: true, label: <MenuSeparator /> },
        { key: "signout", icon: <SignOut size={18} />, label: "Sign out", danger: true, onSelect: () => signOut().then(() => navigate("/login")) },
      ]}
    />
  );
}

function AccountHeader({ name, email, planCode }: { name: string; email: string | null; planCode?: string }) {
  return (
    <div style={{ padding: "4px 4px 8px", cursor: "default" }}>
      <div style={{ fontWeight: 600, fontSize: "var(--scena-text-sm)" }}>{name}</div>
      {email && <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>{email}</div>}
      {planCode && (
        <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-violet)", marginTop: 4, textTransform: "capitalize" }}>
          {planCode} plan
        </div>
      )}
    </div>
  );
}
