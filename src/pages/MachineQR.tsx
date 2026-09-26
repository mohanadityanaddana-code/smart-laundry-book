import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { ArrowRight, QrCode, WashingMachine } from "lucide-react";
import { Link, useParams } from "react-router";
import logo from "@/assets/logo.svg";
import { durationLabel } from "@/lib/format";

const statusMeta: Record<string, { label: string; cls: string }> = {
  RUNNING: { label: "Running right now", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  RESERVED: { label: "Reserved soon", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  AVAILABLE: { label: "Available now", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  MAINTENANCE: { label: "Under maintenance", cls: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400" },
  OFFLINE: { label: "Temporarily offline", cls: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400" },
  DISABLED: { label: "Out of service", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

export default function MachineQR() {
  const { isAuthenticated, isLoading } = useAuth();
  const { id } = useParams();
  const machineId = (id ?? "") as never;
  const machine = useQuery(api.bookings.publicMachine, { machineId });

  const meta = machine ? (statusMeta[machine.liveStatus] ?? statusMeta.AVAILABLE) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
          <img src={logo} alt="HVR PG" className="size-7 rounded-md" />
          <span className="font-display text-sm font-bold">HVR PG Laundry</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {isLoading || machine === undefined ? (
            <Skeleton className="h-80 rounded-2xl" />
          ) : machine === null ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <QrCode className="size-7" />
                </div>
                <h1 className="mt-4 font-display text-lg font-semibold">Machine not found</h1>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  This QR code doesn't match a registered washing machine. Please
                  contact the PG office.
                </p>
                <Link to="/" className="mt-5">
                  <Button variant="outline">Go to homepage</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <WashingMachine className="size-8" />
                </div>
                <h1 className="mt-4 font-display text-2xl font-bold">
                  Machine {String(machine.machineNumber).padStart(2, "0")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {machine.name} · {machine.capacityKg} kg · {machine.location}
                </p>
              </div>

              <Card className="mt-6">
                <CardContent className="p-6 text-center">
                  <Badge variant="secondary" className={`${meta!.cls} text-sm`}>
                    {meta!.label}
                  </Badge>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {durationLabel(machine.defaultDurationSeconds)} per load ·{" "}
                    {machine.openSlots} of {machine.totalSlots} slots open today
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Laundry hours {machine.openTime} – {machine.closeTime} IST
                  </p>

                  <div className="mt-6">
                    {!isAuthenticated ? (
                      <Link to={`/auth?returnTo=${encodeURIComponent(`/book?machine=${machineId}`)}`}>
                        <Button size="lg" className="w-full">
                          Sign in to book this machine <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/book?machine=${machineId}`}>
                        <Button size="lg" className="w-full">
                          Book this machine <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Slots are live from the PG booking system — what you see here is the
                real availability right now.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
