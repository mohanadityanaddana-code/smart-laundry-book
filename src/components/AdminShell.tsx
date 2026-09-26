import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import logo from "@/assets/logo.svg";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Settings2,
  Sun,
  Users,
  WashingMachine,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

const adminNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/admin/machines", label: "Machines", icon: WashingMachine },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/slots", label: "Slots & Schedule", icon: History },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/events", label: "Events & Audit", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/60 bg-card/60 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
          <img src={logo} alt="HVR PG" className="size-8 rounded-lg" />
          <div className="leading-tight">
            <p className="font-display text-sm font-bold">HVR PG Laundry</p>
            <p className="text-[11px] font-semibold text-primary">Admin Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {adminNav.map((item) => (
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
              {(user?.name ?? "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{user?.name ?? "Admin"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <Link to="/dashboard" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                <ArrowLeft className="mr-2 size-4" /> Student view
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="text-muted-foreground"
            >
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </Button>
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
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <img src={logo} alt="HVR PG" className="size-7 rounded-md" />
            <div className="leading-tight">
              <span className="block font-display text-sm font-bold">HVR PG Admin</span>
            </div>
          </Link>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground" aria-label="Sign out">
              <LogOut className="size-4.5" />
            </Button>
          </div>
        </div>
        {/* Mobile nav: horizontal scroll */}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="size-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="px-4 py-5 lg:ml-60 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
