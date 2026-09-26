import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import logo from "@/assets/logo.svg";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings2,
  ShieldCheck,
  Sun,
  User,
  WashingMachine,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

const studentNav = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/book", label: "Book", icon: CalendarPlus },
  { to: "/bookings", label: "My Bookings", icon: WashingMachine },
  { to: "/profile", label: "Profile", icon: User },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="text-muted-foreground"
    >
      {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const syncMe = useMutation(api.profile.syncMe);

  // Keep role/profile fields server-synced right after sign-in.
  useEffect(() => {
    if (user) {
      void syncMe().catch(() => {});
    }
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = user?.role === "admin";
  const nav = isAdmin
    ? [...studentNav, { to: "/admin", label: "Admin", icon: Settings2 }]

    : studentNav;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const firstName = (user?.name ?? "").split(" ")[0] || "Student";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/60 bg-card/60 backdrop-blur-xl md:flex">
        <Link to="/dashboard" className="flex h-16 items-center gap-3 px-5">
          <img src={logo} alt="" className="size-8 rounded-lg" />
          <div className="leading-tight">
            <p className="font-display text-sm font-bold">HVR PG</p>
            <p className="text-[11px] text-muted-foreground">Laundry</p>
          </div>
        </Link>

        {isAdmin && (
          <div className="mx-4 mb-2 flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
            <ShieldCheck className="size-3.5" /> Admin mode
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{user?.name ?? "Student"}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.roomNumber ? `Room ${user.roomNumber}` : (user?.email ?? "")}
              </p>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="text-muted-foreground"
            >
              <LogOut className="size-4.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <img src={logo} alt="" className="size-7 rounded-md" />
          <span className="font-display text-sm font-bold">HVR PG Laundry</span>
        </Link>
        <div className="flex items-center">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="text-muted-foreground"
          >
            <LogOut className="size-4.5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pb-24 pt-5 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
