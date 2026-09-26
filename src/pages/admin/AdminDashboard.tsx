import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Users,
  WashingMachine,
  XCircle,
} from "lucide-react";
import { Link } from "react-router";
import { friendlyDate, secondsTo12h } from "@/lib/format";

export default function AdminDashboard() {
  const stats = useQuery(api.admin.dashboardStats);
  const events = useQuery(api.adminPortal.allEvents);
  const bookings = useQuery(api.bookings.adminAllBookings);

  const activeBookings = (bookings ?? []).filter((b) => b.derived === "UPCOMING");
  const recent = (bookings ?? []).slice(0, 8);
  const recentEvents = (events ?? []).slice(0, 10);

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live operations for HVR PG laundry — every number comes straight from the database.
        </p>
      </div>

      {stats === undefined ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Machine status grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Students", value: stats.totals.students, icon: Users },
              { label: "Available machines", value: stats.totals.availableMachines, icon: CheckCircle2 },
              { label: "Running now", value: stats.totals.runningMachines, icon: Activity },
              { label: "Today's bookings", value: stats.totals.todayBookings, icon: CalendarDays },
              { label: "This week", value: stats.totals.weekBookings, icon: CalendarDays },
              { label: "Completed", value: stats.totals.completedBookings, icon: CheckCircle2 },
              { label: "Cancelled", value: stats.totals.cancelledBookings, icon: XCircle },
              { label: "Utilization today", value: `${stats.utilization}%`, icon: WashingMachine },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                    <s.icon className="size-4 text-muted-foreground/60" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Live machine strip */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Machine status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.machines.map((m) => (
                  <div
                    key={m._id}
                    className="rounded-xl border border-border/70 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-display text-sm font-bold">
                          Machine {String(m.machineNumber).padStart(2, "0")}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.location} · {m.durationMinutes} min</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          m.liveStatus === "RUNNING"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : m.liveStatus === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : m.liveStatus === "RESERVED"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        }
                      >
                        {m.liveStatus}
                      </Badge>
                    </div>
                    {m.runningRemainingSeconds !== null && (
                      <p className="mt-2 font-display text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {Math.floor(m.runningRemainingSeconds / 60)}:
                        {String(m.runningRemainingSeconds % 60).padStart(2, "0")} left
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Recent bookings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent bookings</CardTitle>
                  <Link to="/admin/bookings" className="text-xs font-semibold text-primary hover:underline">
                    View all →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {recent.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No bookings yet.</p>
                )}
                {recent.map((b) => (
                  <div key={b._id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{b.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        M{b.machineNumber} · {friendlyDate(b.date)} · {b.label12h}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        b.derived === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : b.derived === "CANCELLED"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                      }
                    >
                      {b.derived.charAt(0) + b.derived.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent events */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent system events</CardTitle>
                  <Link to="/admin/events" className="text-xs font-semibold text-primary hover:underline">
                    View all →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(recentEvents ?? []).length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No events recorded yet.</p>
                )}
                {recentEvents.map((e) => (
                  <div key={e._id} className="text-sm">
                    <p className="font-medium">{e.eventType.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">{e.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AdminShell>
  );
}
