import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Megaphone, Search } from "lucide-react";
import { useState } from "react";

type NotifRow = {
  _id: string;
  recipientName: string;
  type: string;
  title: string;
  message: string;
  actionState: string | null;
  readAt: number | null;
  createdAt: number;
  bookingId: string | null;
  machineNumber: number | null;
};

const TYPE_FILTERS = [
  { key: "ALL", label: "All types" },
  { key: "MACHINE_READY", label: "Machine ready" },
  { key: "BOOKING_CONFIRMED", label: "Booking confirmed" },
  { key: "STARTING_SOON", label: "Starting soon" },
  { key: "REMINDER", label: "Reminders" },
  { key: "AUTO_CANCELLED", label: "Auto-cancelled" },
  { key: "SLOT_CANCELLED", label: "Slot cancelled" },
  { key: "MACHINE_MAINTENANCE", label: "Maintenance" },
  { key: "WEATHER_ALERT", label: "Weather" },
  { key: "PG_SUPPORT", label: "Announcements" },
] as const;

export default function AdminNotifications() {
  const notifications = useQuery(api.adminPortal.allNotifications);
  const sendAnnouncement = useMutation(api.adminPortal.sendAnnouncement);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = (notifications ?? []).filter((n) => {
    const q = search.toLowerCase();
    const matches =
      !q ||
      n.recipientName.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q);
    const typeOk = typeFilter === "ALL" || n.type === typeFilter;
    return matches && typeOk;
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await sendAnnouncement({ title, message });
      toast.success(`Announcement delivered to ${res.count} students`);
      setTitle("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send announcement");
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every notification record in the system, plus announcements to all students.
        </p>
      </div>

      {/* Announcement composer */}
      <Card className="mt-5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Megaphone className="size-4 text-primary" /> Send announcement to all students
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="a-title">Title</Label>
              <Input
                id="a-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Water supply maintenance on Sunday"
                required
                minLength={3}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-msg">Message</Label>
              <Textarea
                id="a-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="The PG water tanks will be cleaned this Sunday between 10 AM and 1 PM. Laundry slots in that window are unaffected."
                required
                minLength={3}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Delivered in-app to every registered student and recorded in the audit log.
              </p>
              <Button type="submit" disabled={sending || title.trim().length < 3 || message.trim().length < 3}>
                {sending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send announcement
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Records */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Search recipient, title, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2.5">
        {notifications === undefined ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No notifications match your filters.
            </CardContent>
          </Card>
        ) : (
          filtered.slice(0, 100).map((n) => (
            <Card key={n._id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {n.title}
                      {!n.readAt && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-primary">
                          <span className="size-1.5 rounded-full bg-primary" /> Unread
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      To {n.recipientName} · {n.type.replace(/_/g, " ").toLowerCase()}
                      {n.bookingId ? ` · ${n.bookingId}` : ""}
                      {n.machineNumber ? ` · M${n.machineNumber}` : ""}
                      {n.actionState ? ` · response: ${n.actionState.toLowerCase()}` : ""}
                    </p>
                    <p className="mt-1.5 text-sm text-foreground/80">{n.message}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    n.type === "MACHINE_READY"
                      ? "mt-2 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : n.type === "AUTO_CANCELLED"
                        ? "mt-2 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "mt-2 bg-muted text-muted-foreground"
                  }
                >
                  {n.type.replace(/_/g, " ").toLowerCase()}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}
