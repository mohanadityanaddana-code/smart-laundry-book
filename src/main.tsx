import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ThemeProvider } from "@/components/theme-provider";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation, Link } from "react-router";
import { Loader2, ShieldX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Book = lazy(() => import("./pages/Book.tsx"));
const Bookings = lazy(() => import("./pages/Bookings.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const MachineQR = lazy(() => import("./pages/MachineQR.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings.tsx"));
const AdminMachines = lazy(() => import("./pages/admin/AdminMachines.tsx"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents.tsx"));
const AdminSlots = lazy(() => import("./pages/admin/AdminSlots.tsx"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications.tsx"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/**
 * Admin-only route guard. Students who open an admin URL directly get an
 * explicit 403-style screen (never the admin UI) and are bounced to their
 * student home. Actual authorization is enforced server-side on every admin
 * function — this guard is UX, not the security boundary.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }
  if (user?.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <ShieldX className="size-7" />
          </div>
          <p className="mt-4 font-display text-lg font-semibold">403 — Admin access required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account doesn't have permission to open the admin portal. This
            attempt has been noted.
          </p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to student home
          </Link>
        </div>
      </main>
    );
  }
  return children;
}

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <ThemeProvider>
          <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/book"
                element={
                  <RequireAuth>
                    <Book />
                  </RequireAuth>
                }
              />
              <Route
                path="/bookings"
                element={
                  <RequireAuth>
                    <Bookings />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RequireAuth>
                    <Notifications />
                  </RequireAuth>
                }
              />
              {/* ------------------------ Admin portal (ADMIN role only) ------------------------ */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route
                path="/admin/dashboard"
                element={
                  <RequireAdmin>
                    <AdminDashboard />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/bookings"
                element={
                  <RequireAdmin>
                    <AdminBookings />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/machines"
                element={
                  <RequireAdmin>
                    <AdminMachines />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <RequireAdmin>
                    <AdminStudents />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/slots"
                element={
                  <RequireAdmin>
                    <AdminSlots />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/notifications"
                element={
                  <RequireAdmin>
                    <AdminNotifications />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/events"
                element={
                  <RequireAdmin>
                    <AdminEvents />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <RequireAdmin>
                    <AdminSettings />
                  </RequireAdmin>
                }
              />

              {/* ------------------- Public machine QR landing (scanned) ------------------- */}
              <Route path="/machine/:id" element={<MachineQR />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </BrowserRouter>
          <Toaster />
        </ThemeProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
