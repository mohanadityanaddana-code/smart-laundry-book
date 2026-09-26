import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CalendarDays, Search, ShieldOff, ShieldCheck, UserX } from "lucide-react";
import { useState } from "react";
import { friendlyDate } from "@/lib/format";

type StudentRow = {
  _id: Id<"users">;
  name: string;
  email: string;
  phone: string;
  pgName: string;
  roomNumber: string;
  role: string;
  disabled: boolean;
  emailVerified: boolean;
  profileComplete: boolean;
  bookingsThisWeek: number;
  totalBookings: number;
  joinedAt: number;
};

export default function AdminStudents() {
  const students = useQuery(api.admin.students);
  const setStudentActive = useMutation(api.admin.setStudentActive);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<Id<"users"> | null>(null);

  const filtered = (students ?? []).filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.roomNumber.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q)
    );
  });

  const toggleActive = async (s: StudentRow) => {
    setBusy(s._id);
    try {
      await setStudentActive({ userId: s._id, active: s.disabled });
      toast.success(s.disabled ? "Student re-enabled" : "Student disabled — they can no longer book");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update student");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registered students, their weekly usage and account status.
        </p>
      </div>

      <div className="relative mt-5 max-w-xs">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input
          placeholder="Search name, email, room, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {students === undefined ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No students match your search.
            </CardContent>
          </Card>
        ) : (
          filtered.map((s) => (
            <Card key={s._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setDetailId(s._id)}
                >
                  <p className="text-sm font-semibold">
                    {s.name}
                    {s.role === "admin" && (
                      <Badge variant="secondary" className="ml-2 bg-primary/10 text-[10px] text-primary">
                        Admin
                      </Badge>
                    )}
                    {s.disabled && (
                      <Badge variant="secondary" className="ml-2 bg-red-500/10 text-[10px] text-red-600 dark:text-red-400">
                        Disabled
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.email} · Room {s.roomNumber || "—"} · {s.phone || "no phone"}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <CalendarDays className="mr-1 size-3" /> {s.bookingsThisWeek}/4 this week
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setDetailId(s._id)}>
                    Details
                  </Button>
                  {s.role !== "admin" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={s.disabled ? "text-emerald-600" : "text-destructive"}
                          disabled={busy === s._id}
                        >
                          {s.disabled ? <ShieldCheck className="size-4" /> : <UserX className="size-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {s.disabled ? "Re-enable" : "Disable"} {s.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {s.disabled
                              ? "The student will be able to sign in and book slots again."
                              : "The student will no longer be able to book new slots. Existing bookings are kept. This is recorded in the audit log."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Close</AlertDialogCancel>
                          <AlertDialogAction onClick={() => toggleActive(s)}>
                            {s.disabled ? "Re-enable" : "Disable account"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <StudentDetailDialog userId={detailId} onClose={() => setDetailId(null)} />
    </AdminShell>
  );
}

function StudentDetailDialog({ userId, onClose }: { userId: Id<"users"> | null; onClose: () => void }) {
  const detail = useQuery(
    api.adminPortal.studentDetail,
    userId ? { userId } : "skip",
  );
  const setStudentActive = useMutation(api.admin.setStudentActive);

  const toggle = async (currentlyDisabled: boolean, name: string) => {
    if (!userId) return;
    try {
      await setStudentActive({ userId, active: currentlyDisabled });
      toast.success(currentlyDisabled ? `${name} re-enabled` : `${name} disabled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update student");
    }
  };

  return (
    <Dialog open={userId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Student profile</DialogTitle>
          <DialogDescription>Profile, booking history and notification history.</DialogDescription>
        </DialogHeader>
        {detail === undefined ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-semibold">{detail.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="truncate font-semibold">{detail.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-semibold">{detail.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Room / PG</p>
                <p className="font-semibold">
                  {detail.roomNumber || "—"} · {detail.pgName || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-semibold capitalize">{detail.role}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                <p className="font-semibold">{detail.disabled ? "Disabled" : "Active"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">This week</p>
                <p className="font-semibold">{detail.weeklyUsage} bookings</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">All time</p>
                <p className="font-semibold">{detail.totalBookings} bookings</p>
              </div>
            </div>

            {detail.role !== "admin" && userId && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={detail.disabled ? "default" : "outline"}
                  onClick={() => toggle(detail.disabled, detail.name || "Student")}
                >
                  {detail.disabled ? (
                    <>
                      <ShieldCheck className="mr-1.5 size-4" /> Re-enable account
                    </>
                  ) : (
                    <>
                      <ShieldOff className="mr-1.5 size-4" /> Disable account
                    </>
                  )}
                </Button>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Booking history
              </p>
              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                {detail.bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                )}
                {detail.bookings.map((b) => (
                  <div
                    key={b._id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                  >
                    <span>
                      M{b.machineNumber} · {friendlyDate(b.date)} · {b.label12h}
                    </span>
                    <span
                      className={
                        b.status === "CONFIRMED"
                          ? "font-semibold text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {b.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent notifications
              </p>
              <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                {detail.notifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                )}
                {detail.notifications.map((n) => (
                  <div key={n._id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">
                      {n.type.replace(/_/g, " ").toLowerCase()} ·{" "}
                      {n.readAt ? "read" : "unread"} ·{" "}
                      {new Date(n.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
