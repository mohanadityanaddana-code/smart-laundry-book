import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { CloudRain, History, ScrollText } from "lucide-react";
import { friendlyDate } from "@/lib/format";

function fmt(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminEvents() {
  const events = useQuery(api.adminPortal.allEvents);
  const audit = useQuery(api.adminPortal.auditLog);
  const weather = useQuery(api.adminPortal.weatherReports);

  const eventBadge = (t: string) => {
    if (t.includes("AUTO_CANCEL") || t.includes("CANCELLED")) {
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    }
    if (t.includes("FINISHED") || t.includes("RESPONDED") || t.includes("NEXT")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    }
    if (t.includes("REMINDER") || t.includes("FINAL") || t.includes("SOON")) {
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    }
    return "bg-primary/10 text-primary";
  };

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Events & Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete system activity: booking events, admin actions and stored weather reports.
        </p>
      </div>

      <Tabs defaultValue="events" className="mt-5">
        <TabsList className="flex-wrap">
          <TabsTrigger value="events" className="gap-1.5">
            <History className="size-3.5" /> System events
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <ScrollText className="size-3.5" /> Admin audit log
          </TabsTrigger>
          <TabsTrigger value="weather" className="gap-1.5">
            <CloudRain className="size-3.5" /> Weather reports
          </TabsTrigger>
        </TabsList>

        {/* System events */}
        <TabsContent value="events" className="mt-4">
          {events === undefined ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No events recorded yet. Events appear as students book, start, finish
                and respond to machine-ready prompts.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <Card key={e._id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {e.eventType.replace(/_/g, " ").toLowerCase()}
                        {e.bookingId && (
                          <span className="ml-2 font-normal text-xs text-muted-foreground">{e.bookingId}</span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {e.studentName && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {e.studentName}
                        </Badge>
                      )}
                      {e.machineNumber !== null && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          M{e.machineNumber}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">{fmt(e.at)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Audit log */}
        <TabsContent value="audit" className="mt-4">
          {audit === undefined ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : audit.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No admin actions recorded yet. Every machine, booking, schedule and
                settings change made here is logged.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {audit.map((a) => (
                <Card key={a._id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {a.action.replace(/_/g, " ").toLowerCase()}
                        {a.targetId && (
                          <span className="ml-2 font-normal text-xs text-muted-foreground">
                            {a.targetEntity}: {a.targetId}
                          </span>
                        )}
                      </p>
                      {a.metadata && a.metadata !== "{}" && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.metadata}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(a.at)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Weather reports */}
        <TabsContent value="weather" className="mt-4">
          {weather === undefined ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : weather.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No weather reports stored yet. Reports are cached when students
                finish laundry (requires PG coordinates in Settings).
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {weather.map((w) => (
                <Card key={w._id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {w.bookingId ?? "Booking"}
                        {w.date && (
                          <span className="ml-2 font-normal text-xs text-muted-foreground">
                            {friendlyDate(w.date)}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {w.summary} {w.guidance}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        Source: {w.provider} · retrieved {fmt(w.fetchedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {w.studentName && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {w.studentName}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={
                          w.rainProbability >= 60
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                            : w.rainProbability >= 35
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {w.rainProbability}% rain
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
