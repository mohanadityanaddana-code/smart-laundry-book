import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CalendarX2, History, Search } from "lucide-react";
import { useState } from "react";
import { friendlyDate } from "@/lib/format";

type AdminBooking = {
  _id: string;
  bookingId: string;
  studentName: string;
  studentRoom: string;
  machineNumber: number;
  date: string;
  label12h: string;
  status: string;
  derived: string;
  cancellationReason: string | null;
  createdAt: number;
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This week" },
] as const;

export default function AdminBookings() {
  const bookings = useQuery(api.bookings.adminAllBookings);
  const cancelBooking = useMutation(api.bookings.cancelMyBooking);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = (bookings ?? []).filter((b) => {
    const q = search.toLowerCase();
    const matches =
      !q ||
      b.studentName.toLowerCase().includes(q) ||
      b.bookingId.toLowerCase().includes(q) ||
      String(b.machineNumber).includes(q);
    let statusOk = true;
    if (filter === "TODAY") {
      statusOk = b.date === new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    } else if (filter === "WEEK") {
      statusOk = b.status === "CONFIRMED" && b.derived !== "CANCELLED";
    } else if (filter !== "ALL") {
      statusOk = b.derived === filter;
    }
    return matches && statusOk;
  });

  const doCancel = async (id: string) => {
    setBusy(id);
    try {
      await cancelBooking({ bookingDbId: id as never });
      toast.success("Booking cancelled — student notified and event recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every booking across all machines, with full event history.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Search student, booking ID, machine…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2.5">
        {bookings === undefined ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No bookings match your filters.
            </CardContent>
          </Card>
        ) : (
          filtered.slice(0, 80).map((b) => (
            <Card key={b._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {b.studentName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Room {b.studentRoom || "—"} · {b.bookingId}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Machine {String(b.machineNumber).padStart(2, "0")} · {friendlyDate(b.date)} · {b.label12h}
                    {b.cancellationReason
                      ? ` · ${b.cancellationReason.replace(/_/g, " ").toLowerCase()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                  <BookingTimelineDialog bookingDbId={b._id} bookingRef={b.bookingId} />
                  {b.status === "CONFIRMED" && (
                    <>
                      <RescheduleDialog bookingDbId={b._id} date={b.date} label12h={b.label12h} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === b._id}>
                            <CalendarX2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel {b.studentName}'s booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {friendlyDate(b.date)} · {b.label12h} on Machine{" "}
                              {String(b.machineNumber).padStart(2, "0")} will be
                              freed. The student is notified and the action is
                              recorded in the audit log.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep booking</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => doCancel(b._id)}
                            >
                              Cancel booking
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}

/** Admin booking event timeline dialog. */
function BookingTimelineDialog({
  bookingDbId,
  bookingRef,
}: {
  bookingDbId: string;
  bookingRef: string;
}) {
  const events = useQuery(api.adminPortal.bookingTimeline, {
    bookingDbId: bookingDbId as never,
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Event history">
          <History className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Event history — {bookingRef}</DialogTitle>
          <DialogDescription>
            Every recorded event for this booking, newest first.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {events === undefined && <Skeleton className="h-24 rounded-xl" />}
          {events !== undefined && events.length === 0 && (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          )}
          {events?.map((e) => (
            <div key={e._id} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-medium">{e.eventType.replace(/_/g, " ").toLowerCase()}</p>
                <p className="text-xs text-muted-foreground">{e.detail}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Admin reschedule dialog: move a booking to another open slot. */
function RescheduleDialog({
  bookingDbId,
  date,
  label12h,
}: {
  bookingDbId: string;
  date: string;
  label12h: string;
}) {
  const [open, setOpen] = useState(false);
  const [newStart, setNewStart] = useState("");
  const reschedule = useMutation(api.adminPortal.rescheduleBooking);

  const handleReschedule = async () => {
    const [h, m] = newStart.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      toast.error("Enter a valid time (HH:MM)");
      return;
    }
    try {
      await reschedule({
        bookingDbId: bookingDbId as never,
        newStartSeconds: h * 3600 + m * 60,
      });
      toast.success("Booking rescheduled — student notified");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reschedule");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">Reschedule</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>
            Currently {label12h} on {friendlyDate(date)}. The student is always
            notified — bookings are never moved silently.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label className="text-sm font-medium">New start time</label>
          <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            The slot must be free and inside operating hours for this machine.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleReschedule}>Reschedule</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
