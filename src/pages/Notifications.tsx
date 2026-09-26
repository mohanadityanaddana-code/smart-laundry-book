import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  CloudRain,
  Droplets,
  Mail,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Notif = {
  _id: string;
  type: string;
  title: string;
  message: string;
  actionState: "PENDING" | "ACKNOWLEDGED" | "DECLINED" | null;
  readAt: number | null;
  createdAt: number;
  bookingDbId: string | null;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const typeMeta: Record<string, { icon: typeof Bell; cls: string }> = {
  BOOKING_CONFIRMED: { icon: CalendarCheck, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  MACHINE_READY: { icon: Droplets, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  PREVIOUS_FINISHED: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  SLOT_CANCELLED: { icon: XCircle, cls: "bg-muted text-muted-foreground" },
  MACHINE_MAINTENANCE: { icon: Wrench, cls: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400" },
  WEATHER_ALERT: { icon: CloudRain, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  PG_SUPPORT: { icon: Bell, cls: "bg-primary/10 text-primary" },
};

export default function Notifications() {
  const notifications = useQuery(api.notifications.listMine);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const respond = useMutation(api.notifications.respondToReady);

  const RESPONSE_META: Record<
    "COMING" | "ACCEPT" | "CANT_COME" | "NEED_TIME",
    { label: string; toast: string }
  > = {
    COMING: { label: "I'm coming", toast: "See you there — the machine is reserved for you" },
    ACCEPT: { label: "Accept", toast: "Accepted — the machine is reserved for you" },
    CANT_COME: { label: "Can't come", toast: "No problem — your slot has been freed for other students" },
    NEED_TIME: { label: "Need more time", toast: "Okay — we'll give you a few more minutes before reminding you again" },
  };

  const handleRespond = async (
    id: string,
    response: "COMING" | "ACCEPT" | "CANT_COME" | "NEED_TIME",
  ) => {
    try {
      await respond({ notificationId: id as never, response });
      toast.success(RESPONSE_META[response].toast);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your response");
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead({});
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Could not mark notifications as read");
    }
  };

  const unread = (notifications ?? []).filter((n) => !n.readAt).length;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Booking updates, machine-ready alerts and drying advice.
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAll}>
            <Mail className="mr-1.5 size-4" /> Mark all read ({unread})
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {notifications === undefined ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bell className="size-7" />
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">You're all caught up</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Booking confirmations and machine-ready alerts will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((n) => {
            const meta = typeMeta[n.type] ?? typeMeta.PG_SUPPORT;
            const Icon = meta.icon;
            return (
              <Card
                key={n._id}
                className={cn(
                  "transition-colors",
                  !n.readAt && "border-primary/30 bg-primary/[0.03]",
                )}
              >
                <CardContent className="p-5">
                  <div className="flex gap-3.5">
                    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.cls)}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{n.title}</p>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.message}</p>

                      {/* Machine-ready action prompt — 4 responses, escalation stops on any */}
                      {n.type === "MACHINE_READY" && n.actionState === "PENDING" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["COMING", "ACCEPT", "NEED_TIME", "CANT_COME"] as const).map((r) => (
                            <Button
                              key={r}
                              size="sm"
                              variant={r === "CANT_COME" ? "outline" : r === "NEED_TIME" ? "secondary" : "default"}
                              className={r === "CANT_COME" ? "text-destructive" : ""}
                              onClick={() => handleRespond(n._id, r)}
                            >
                              {RESPONSE_META[r].label}
                            </Button>
                          ))}
                        </div>
                      )}
                      {n.type === "MACHINE_READY" && n.actionState === "ACKNOWLEDGED" && (
                        <Badge variant="secondary" className="mt-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="mr-1 size-3" /> On the way
                        </Badge>
                      )}
                      {n.type === "MACHINE_READY" && n.actionState === "NEEDS_TIME" && (
                        <Badge variant="secondary" className="mt-2 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          Extra time requested
                        </Badge>
                      )}
                      {n.type === "MACHINE_READY" && n.actionState === "DECLINED" && (
                        <Badge variant="secondary" className="mt-2 bg-muted text-muted-foreground">
                          Slot freed
                        </Badge>
                      )}
                    </div>
                    {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
