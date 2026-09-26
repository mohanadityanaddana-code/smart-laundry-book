import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CalendarX2, WashingMachine } from "lucide-react";
import { useState } from "react";
import { durationLabel, friendlyDate, mmss, secondsTo12h } from "@/lib/format";

type MyBooking = {
  _id: string;
  bookingId: string;
  machineNumber: number;
  machineName: string;
  date: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  status: "CONFIRMED" | "CANCELLED";
  derived: string;
  cancellationReason: string | null;
  label12h: string;
  remainingSeconds: number | null;
};

const TABS = [
  { key: "UPCOMING", label: "Upcoming" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

export default function Bookings() {
  const bookings = useQuery(api.bookings.myBookings);
  const cancelBooking = useMutation(api.bookings.cancelMyBooking);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("UPCOMING");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const filtered = (bookings ?? []).filter((b) => b.derived === tab);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      await cancelBooking({ bookingDbId: id as never });
      toast.success("Booking cancelled — your weekly allowance is freed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setCancelling(null);
    }
  };

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">My bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every slot you've reserved, in one place.
      </p>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]["key"])}
        className="mt-5"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              {bookings !== undefined && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  {bookings.filter((b) => b.derived === t.key).length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5 space-y-3">
        {bookings === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {tab === "CANCELLED" ? (
                  <CalendarX2 className="size-7" />
                ) : (
                  <WashingMachine className="size-7" />
                )}
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">
                {tab === "UPCOMING" && "No upcoming bookings"}
                {tab === "ACTIVE" && "Nothing running right now"}
                {tab === "COMPLETED" && "No completed washes yet"}
                {tab === "CANCELLED" && "No cancelled bookings"}
              </h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {tab === "UPCOMING"
                  ? "Your laundry journey starts here."
                  : "Booked slots will show up here automatically."}
              </p>
              {tab === "UPCOMING" && (
                <a href="/book">
                  <Button>Book a slot</Button>
                </a>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((b) => (
            <BookingCard
              key={b._id}
              booking={b}
              cancelling={cancelling === b._id}
              onCancel={() => handleCancel(b._id)}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}

function BookingCard({
  booking,
  cancelling,
  onCancel,
}: {
  booking: MyBooking;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const badge = (() => {
    switch (booking.derived) {
      case "ACTIVE":
        return { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: "Running now" };
      case "UPCOMING":
        return { cls: "bg-primary/10 text-primary", label: "Upcoming" };
      case "COMPLETED":
        return { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Completed" };
      default:
        return { cls: "bg-muted text-muted-foreground", label: "Cancelled" };
    }
  })();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-sm font-bold text-primary">
              {String(booking.machineNumber).padStart(2, "0")}
            </div>
            <div>
              <p className="font-display text-sm font-bold">
                Machine {String(booking.machineNumber).padStart(2, "0")} · {booking.machineName}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {friendlyDate(booking.date)} · {booking.label12h}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {durationLabel(booking.durationSeconds)} · ID {booking.bookingId}
              </p>
              {booking.derived === "ACTIVE" && booking.remainingSeconds !== null && (
                <p className="mt-1.5 font-display text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {mmss(booking.remainingSeconds)} remaining
                </p>
              )}
              {booking.derived === "CANCELLED" && booking.cancellationReason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Reason: {booking.cancellationReason.replace(/_/g, " ").toLowerCase()}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="secondary" className={badge.cls}>
              {badge.label}
            </Badge>
            {(booking.derived === "UPCOMING" || booking.derived === "ACTIVE") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={cancelling}>
                    <CalendarX2 className="mr-1.5 size-4" />
                    {cancelling ? "Cancelling…" : "Cancel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {friendlyDate(booking.date)} · {booking.label12h} on Machine{" "}
                      {String(booking.machineNumber).padStart(2, "0")} will be
                      freed for other students. This won't count against your
                      weekly limit.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep booking</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onCancel}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Yes, cancel it
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
