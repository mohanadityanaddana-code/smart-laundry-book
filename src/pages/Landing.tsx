import { motion } from "framer-motion";
import { Splash, splashAlreadySeen } from "@/components/Splash";
import { WasherHero3D } from "@/components/three/WasherModel";
import logo from "@/assets/logo.svg";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WashingMachine,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Landing() {
  const [splashDone, setSplashDone] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!splashAlreadySeen()) setShowSplash(true);
    else setSplashDone(true);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      {showSplash && (
        <Splash
          onDone={() => {
            setSplashDone(true);
          }}
        />
      )}

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 opacity-70" />
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-[-10%] h-[380px] w-[520px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: splashDone ? 0 : 0.2 }}
        className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="HVR PG logo" className="size-9 rounded-lg shadow-sm" />
            <div className="leading-tight">
              <p className="font-display text-sm font-bold">HVR PG</p>
              <p className="text-xs text-muted-foreground">Laundry</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth?mode=register">
              <button className="hidden rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted sm:block">
                Register
              </button>
            </Link>
            <Link to="/auth">
              <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110">
                Sign in
                <ArrowRight className="size-4" />
              </button>
            </Link>
          </div>
        </div>
      </motion.header>

      <main>
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 md:pt-16">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: splashDone ? 0.05 : 0.3 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                Smart laundry booking for HVR PG students
              </span>
              <h1 className="text-balance mt-5 font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
                Your laundry.
                <br />
                Your slot.{" "}
                <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  Your time.
                </span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Reserve a washing machine in seconds — with live machine status,
                instant notifications when it's your turn, and drying-weather
                guidance after every wash. No queues, no guesswork.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/auth?mode=register">
                  <button className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 sm:w-auto">
                    Book your first slot
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </Link>
                <Link to="/auth">
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto">
                    Student sign in
                  </button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Free for HVR PG residents · Your slot confirmed in under 30 seconds
              </p>
            </motion.div>

            {/* 3D hero — pointer-events-none so scroll/text never break */}
            <motion.div
              className="pointer-events-none relative h-[340px] sm:h-[420px] md:h-[480px]"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: splashDone ? 0.15 : 0.45 }}
            >
              <WasherHero3D className="absolute inset-0" />
              {/* Floating live-status chips (decorative) */}
              <motion.div
                className="glass-card absolute left-2 top-6 rounded-2xl px-4 py-3 shadow-lg sm:left-6"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  Machine 02 · Running
                </p>
                <p className="mt-1 font-display text-lg font-bold tabular-nums">38:42</p>
              </motion.div>
              <motion.div
                className="glass-card absolute bottom-8 right-2 rounded-2xl px-4 py-3 shadow-lg sm:right-6"
                animate={{ y: [0, 9, 0] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              >
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Slot confirmed
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">7:00 PM – 8:30 PM</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* --------------------------- HOW IT WORKS -------------------------- */}
        <section id="how" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Booked in four taps
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarClock, title: "Pick a date", body: "Today through Sunday — the live week, always." },
              { icon: WashingMachine, title: "Choose a machine", body: "See capacity, floor and live status at a glance." },
              { icon: Clock, title: "Select a slot", body: "Open slots only — past and taken times are blocked." },
              { icon: CheckCircle2, title: "Confirm & wash", body: "Get your booking ID and show up on time." },
            ].map((step, i) => (
              <Reveal key={step.title} delay={i * 0.08}>
                <div className="group relative h-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <span className="absolute right-5 top-5 font-display text-4xl font-bold text-muted-foreground/15">
                    {i + 1}
                  </span>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ----------------------------- FEATURES ---------------------------- */}
        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-secondary/70 via-card to-card p-8 sm:p-12">
            <Reveal>
            <h2 className="max-w-lg font-display text-3xl font-bold sm:text-4xl">
              Everything your laundry routine needs, in one place
            </h2>
            </Reveal>
            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {[
                {
                  title: "Live machine status",
                  body: "See which machines are running, reserved or free — updating in real time, without refreshing.",
                  icon: Smartphone,
                },
                {
                  title: "Fair weekly limits",
                  body: "Every student gets the same weekly allowance, so no one hogs the machines.",
                  icon: ShieldCheck,
                },
                {
                  title: "Finish & notify the next student",
                  body: "One tap ends your cycle and alerts whoever's next — the machine never sits idle.",
                  icon: WashingMachine,
                },
                {
                  title: "Weather-aware drying advice",
                  body: "Real rain forecasts after your wash, so you know whether to line-dry or stay indoors.",
                  icon: Smartphone,
                },
                {
                  title: "Verified students only",
                  body: "Accounts are verified with a one-tap email code — one account per student.",
                  icon: ShieldCheck,
                },
                {
                  title: "HVR PG support, one tap away",
                  body: "Machine trouble? The PG owner's number is right there when you need it.",
                  icon: WashingMachine,
                },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 0.06}>
                  <div className="flex gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <f.icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold">{f.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------- FAQ ------------------------------- */}
        <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Questions, answered</h2>
          </Reveal>
          <div className="mt-8 space-y-3">
            {[
              {
                q: "How far ahead can I book?",
                a: "The current week only — today through Sunday. A fresh week opens automatically every Monday.",
              },
              {
                q: "What does a slot cost?",
                a: "Nothing. Booking is free for HVR PG residents; you just reserve machine time.",
              },
              {
                q: "Can I cancel?",
                a: "Yes — cancel any upcoming booking from My Bookings. Cancelled slots free up for other students and don't count against your weekly limit.",
              },
              {
                q: "What if two students tap the same slot?",
                a: "The first confirmation wins; the second sees a friendly 'just booked' message. Fair, every time.",
              },
            ].map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05}>
                <details className="group rounded-2xl border border-border/70 bg-card p-5 transition-colors open:bg-muted/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-display text-sm font-semibold">
                    {item.q}
                    <ArrowRight className="size-4 rotate-90 text-muted-foreground transition-transform group-open:-rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ------------------------------- CTA ------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-700 px-6 py-14 text-center text-primary-foreground shadow-2xl shadow-primary/20 sm:px-12">
              <div className="bg-grid absolute inset-0 opacity-20" />
              <h2 className="relative font-display text-3xl font-bold sm:text-4xl">
                Your laundry slot is waiting
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-sm text-primary-foreground/85 sm:text-base">
                Join your fellow HVR PG students who never wait for a machine.
              </p>
              <Link to="/auth?mode=register">
                <button className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-background px-7 py-3.5 text-sm font-bold text-foreground shadow-lg transition-transform hover:scale-[1.02]">
                  Get started free
                  <ArrowRight className="size-4" />
                </button>
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="HVR PG" className="size-5 rounded" />
            <span>HVR PG Laundry — Your Laundry. Your Slot. Your Time.</span>
          </div>
          <span>Built for HVR PG students</span>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
