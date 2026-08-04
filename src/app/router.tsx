// Browser-history router — replaces the boot-time
// `location.hash.startsWith("#/display")` conditional that used to live
// in src/main.tsx. Manager and kiosk trees are still fully isolated: the
// kiosk subtree imports nothing from src/auth/* or src/app/*, and the
// manager subtree never imports src/lib/display.ts.

import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { ManagerGuard } from "./ManagerGuard";
import { AppShellRoute } from "./AppShellRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { LoginPage } from "../pages/auth/LoginPage";
import { CallbackPage } from "../pages/auth/CallbackPage";
import { UnauthorizedPage } from "../pages/auth/UnauthorizedPage";
import { HomePage } from "../pages/home/HomePage";
import { BoardsPage } from "../pages/boards/BoardsPage";
import { NewBoardPage } from "../pages/boards/NewBoardPage";
import { AssetsPage } from "../pages/assets/AssetsPage";
import { AssetDetailPage } from "../pages/assets/AssetDetailPage";
import { LocationsPage } from "../pages/locations/LocationsPage";
import { ScreensPage } from "../pages/screens/ScreensPage";
import { ScreenDetailPage } from "../pages/screens/ScreenDetailPage";
import { PairScreenPage } from "../pages/screens/PairScreenPage";
import { SessionsPage } from "../pages/sessions/SessionsPage";
import { NewSessionPage } from "../pages/sessions/NewSessionPage";
import { SessionDetailPage } from "../pages/sessions/SessionDetailPage";
import { LayoutsPage } from "../pages/layouts/LayoutsPage";
import { LayoutDetailPage } from "../pages/layouts/LayoutDetailPage";
import { AutomationsPage } from "../pages/automations/AutomationsPage";
import { ConnectionsPage } from "../pages/connections/ConnectionsPage";
import { MembersPage } from "../pages/members/MembersPage";
import { BillingPage } from "../pages/billing/BillingPage";
import { PlanSettingsPage } from "../pages/settings/PlanSettingsPage";
import { SettingsIndexPage } from "../pages/settings/SettingsIndexPage";
import { NotFoundPage } from "../pages/not-found/NotFoundPage";
import { PlaceholderPage } from "../pages/shared/PlaceholderPage";
import { DisplayRoute } from "../display/DisplayRoute";
import { DisplayErrorBoundary } from "../display/DisplayErrorBoundary";
import { ROUTE_METADATA } from "./route-metadata";
import { lazyRoute } from "./lazyRoute";

function placeholder(path: string) {
  const meta = ROUTE_METADATA.find((m) => m.path === path);
  return <PlaceholderPage title={meta?.label ?? path} note={meta?.note} />;
}

// Lazy-loaded: the public landing page (never needed once inside /app), the
// Board editor (the heaviest single screen — canvas/drag/resize code), and
// the internal-only dev showcase (never needed in the real product at all).
const LandingPageLazy = () => lazyRoute(() => import("../pages/landing/LandingPage").then((m) => ({ default: m.LandingPage })));
const TermsPageLazy = () => lazyRoute(() => import("../pages/legal/LegalPage").then((m) => ({ default: m.TermsPage })));
const PrivacyPageLazy = () => lazyRoute(() => import("../pages/legal/LegalPage").then((m) => ({ default: m.PrivacyPage })));
const DocsPageLazy = () => lazyRoute(() => import("../pages/docs/DocsPage").then((m) => ({ default: m.DocsPage })));
const CommunityPageLazy = () => lazyRoute(() => import("../pages/community/CommunityPage").then((m) => ({ default: m.CommunityPage })));
const BoardEditorPageLazy = () => lazyRoute(() => import("../pages/boards/BoardEditorPage").then((m) => ({ default: m.BoardEditorPage })));
const ComponentShowcasePageLazy = () => lazyRoute(() => import("../pages/dev/ComponentShowcasePage").then((m) => ({ default: m.ComponentShowcasePage })));
const EditorPreviewPageLazy = () => lazyRoute(() => import("../pages/dev/EditorPreviewPage").then((m) => ({ default: m.EditorPreviewPage })));

// Shared between the real browser router below and the memory router
// used in tests (src/app/router.test.tsx) — one source of truth for the
// route tree.
export const routeTree: RouteObject[] = [
  { path: "/", element: LandingPageLazy() },
  { path: "/docs", element: DocsPageLazy() },
  { path: "/community", element: CommunityPageLazy() },
  { path: "/terms", element: TermsPageLazy() },
  { path: "/privacy", element: PrivacyPageLazy() },
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/callback", element: <CallbackPage /> },
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  {
    path: "/app",
    element: <ManagerGuard />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Full-viewport Board editor — deliberately NOT nested under
      // AppShellRoute's rail/topbar chrome, same as Canva's own editor is a
      // distinct full-screen surface. Still guarded by ManagerGuard above,
      // so useManagerContext() works normally.
      { path: "boards/:boardId", element: BoardEditorPageLazy() },
      {
        element: <AppShellRoute />,
        children: [
          { path: "home", element: <HomePage /> },
          { path: "boards", element: <BoardsPage /> },
          { path: "boards/new", element: <NewBoardPage /> },
          { path: "assets", element: <AssetsPage /> },
          { path: "assets/:assetId", element: <AssetDetailPage /> },
          { path: "locations", element: <LocationsPage /> },
          { path: "screens", element: <ScreensPage /> },
          { path: "screens/pair", element: <PairScreenPage /> },
          { path: "screens/:screenId", element: <ScreenDetailPage /> },
          { path: "sessions", element: <SessionsPage /> },
          { path: "sessions/new", element: <NewSessionPage /> },
          { path: "sessions/:sessionId", element: <SessionDetailPage /> },
          { path: "layouts", element: <LayoutsPage /> },
          { path: "layouts/:layoutId", element: <LayoutDetailPage /> },
          { path: "automations", element: <AutomationsPage /> },
          { path: "connections", element: <ConnectionsPage /> },
          { path: "members", element: <MembersPage /> },
          { path: "billing", element: <BillingPage /> },
          { path: "settings", element: <SettingsIndexPage /> },
          { path: "settings/organization", element: placeholder("/app/settings/organization") },
          { path: "settings/plan", element: <PlanSettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    path: "/display",
    element: <DisplayRoute />,
    errorElement: <DisplayErrorBoundary />,
  },
  // Internal-only design-system QA pages — never linked from production nav.
  { path: "/dev/components", element: ComponentShowcasePageLazy() },
  { path: "/dev/editor", element: EditorPreviewPageLazy() },
  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routeTree);
