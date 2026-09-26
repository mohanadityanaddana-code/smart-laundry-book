import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { FinishDialog } from "@/components/FinishDialog";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowRight,
  BellRing,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Phone,
  Sparkles,
  WashingMachine,
  XCircle,
} from "lucide-react";
import { Link } from "react-router";
import { secondsTo12h, mmss, friendlyDate } from "@/lib/format";
import { useEffect, useState } from "react";

function useLiveNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { dot: string; ping: boolean; label: string }> = {
    RUNNING: { dot: "bg-amber-500", ping: true, label: "Running" },
    RESERVED: { dot: "bg-blue-500", ping: false, label: "Reserved" },
    AVAILABLE: { dot: "bg-emerald-500", ping: false, label: "Available" },
    MAINTENANCE: { dot: "bg-zinc-400", ping: false, label: "Maintenance" },
    OFFLINE: { dot: "bg-zinc-400", ping: false, label: "Offline" },
    DISABLED: { dot: "bg-red-400", ping: false, label: "Disabled" },
  };
  const s = map[status] ?? map.AVAILABLE;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="relative flex size-2">
        {s.ping && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
          )}
        <span className={`relative inline-flex size-2 rounded-full ${s.dot}`} />
      </span>
      {s.label}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const now = useLiveNow();
  const home = useQuery(api.bookings.studentHome);
  const notifications = useQuery(api.notifications.listMine);
  const respond = useMutation(api.notifications.respondToReady);

  const pendingReady = (notifications ?? []).find(
    (n) => n.type === "MACHINE_READY" && n.actionState === "PENDING",
  );

  const handleRespond = async (response: "COMING" | "CANT_COME") => {
    if (!pendingReady) return;
    try {
      await respond({
        notificationId: pendingReady._id as never,
        response,
      });
      toast.success(
        response === "COMING"
          ? "See you there — the machine is reserved for you"
          : "No problem — your slot has been freed for other students",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your response");
    }
  };
  const machines = useQuery(api.bookings.machineWithDayLoad, {
    date: new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10),
  });

  const firstName = (user?.name ?? "").split(" ")[0] || "there";
  const hour = new Date(now + 5.5 * 3600_000).getUTCHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const weekly = home?.weekly ?? { used: 0, limit: 4, remaining: 4 };

  return (
    <AppShell>
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground">{greeting} 👋</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          {firstName}
        </h1>
      </div>

      {/* Machine-ready prompt — the moment the previous student finishes */}
      {pendingReady && (
        <Card className="mt-6 border-amber-300/60 bg-gradient-to-br from-amber-50 to-card dark:border-amber-500/30 dark:from-amber-950/30">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <BellRing className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{pendingReady.title}</p>
                  <p className="mt-0.5 max-w-md text-sm text-muted-foreground">{pendingReady.message}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleRespond("COMING")}>
                  <CheckCircle2 className="mr-1.5 size-4" /> I'm coming
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRespond("CANT_COME")}>
                  <XCircle className="mr-1.5 size-4" /> Can't come
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active / upcoming hero card */}
      {home == null ? (
        <Card className="mt-6">
          <CardContent className="p-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : home.activeBooking ? (
        <Card className="mt-6 overflow-hidden border-amber-300/50 bg-gradient-to-br from-amber-50 to-card dark:border-amber-500/20 dark:from-amber-950/30">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400" variant="secondary">
                  <span className="relative mr-1.5 inline-flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                  </span>
                  Laundry in progress
                </Badge>
                <p className="mt-3 font-display text-4xl font-bold tabular-nums">
                  {mmss(home.activeBooking.remainingSeconds)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Machine {home.activeBooking.machineNumber} · ends {secondsTo12h(home.activeBooking.endSeconds)}
                </p>
                <div className="mt-4">
                  <FinishDialog bookingDbId={home.activeBooking._id as never} />
                </div>
              </div>
              <WashingMachine className="size-10 text-amber-600/60" />
            </div>
          </CardContent>
        </Card>
        ) : home.upcomingBooking ? (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <Clock className="mr-1.5 size-3" /> Upcoming today
                </Badge>
                <p className="mt-3 font-display text-2xl font-bold">
                  {secondsTo12h(home.upcomingBooking.startSeconds)} → {secondsTo12h(home.upcomingBooking.endSeconds)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Machine {home.upcomingBooking.machineNumber} · {friendlyDate(home.today)}
                </p>
              </div>
              <Link to="/bookings">
                <Button variant="outline" size="sm">
                  View booking <ArrowRight className="ml-1 size-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              You'll get a heads-up when it's your turn
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <WashingMachine className="size-7" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold">No laundry booked today</h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Pick a machine and a slot — it takes less than 30 seconds.
            </p>
            <Link to="/book" className="mt-5">
              <Button>
                <CalendarPlus className="mr-2 size-4" /> Book a slot
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Weekly usage + support */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Weekly bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">
              {weekly.used}
              <span className="text-lg font-semibold text-muted-foreground"> / {weekly.limit} used</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${Math.min(100, (weekly.used / weekly.limit) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {weekly.remaining} slot{weekly.remaining === 1 ? "" : "s"} left this week · resets Monday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Need help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">{home?.support.name ?? "HVR PG Support"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{home?.support.phone ?? "—"}</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <a href={`tel:${(home?.support.phone ?? "").replace(/\s+/g, "")}`}>
                <Phone className="mr-2 size-4" /> Call PG Owner
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live machines strip */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Machines now</h2>
          <Link
            to="/book"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Book a slot →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {machines === undefined
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))
            : machines.map((m) => (
                <Link key={m._id} to="/book" className="group">
                  <div className="h-full rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <p className="font-display text-sm font-bold">Machine {String(m.machineNumber).padStart(2, "0")}</p>
                      <StatusDot status={m.liveStatus} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.capacityKg} kg · {m.location}
                    </p>
                    <p className="mt-2 text-xs font-medium text-foreground/80">
                      {m.openSlots} of {m.totalSlots} slots open today
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </AppShell>
  );
}
