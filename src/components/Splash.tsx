import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const SEEN_KEY = "hvr-splash-seen";

/**
 * Premium splash: HVR PG → washer visual → moves up → tagline → app.
 * Plays once per browser session; `skip` ends it instantly. Reduced-motion
 * users get a fast, gentle fade instead of the full choreography.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const finish = () => {
    sessionStorage.setItem(SEEN_KEY, "1");
    setLeaving(true);
    window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, reduced ? 150 : 450);
  };

  useEffect(() => {
    const total = reduced ? 500 : 3100;
    const t = window.setTimeout(finish, total);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const up = reduced ? 0 : -70;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={finish}
        >
          <button
            type="button"
            onClick={finish}
            className="absolute right-4 top-4 z-10 rounded-full border border-border/70 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Skip
          </button>

          <div className="flex flex-col items-center">
            {/* Step 1+2: name and washer appear */}
            <motion.div
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [0, 0, up],
              }}
              transition={{
                // opacity/scale in…
                duration: reduced ? 0.2 : 0.7,
                // …then the whole cluster glides upward at ~1.9s
                y: reduced ? { duration: 0 } : { delay: 1.9, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
              }}
            >
              <motion.span
                className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.15, duration: 0.5 }}
              >
                HVR PG
              </motion.span>
              <motion.span
                className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.35, duration: 0.6 }}
              >
                Smart Laundry Book
              </motion.span>

              {/* Subtle laundry visual — drum with slowly rotating load */}
              <motion.svg
                viewBox="0 0 120 120"
                className="size-24 text-primary sm:size-28"
                fill="none"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.9, duration: 0.6 }}
              >
                <rect x="22" y="14" width="76" height="92" rx="12" stroke="currentColor" strokeWidth="3" />
                <path d="M22 32h76" stroke="currentColor" strokeWidth="3" />
                <circle cx="32" cy="23" r="2.4" fill="currentColor" />
                <circle cx="41" cy="23" r="2.4" fill="currentColor" />
                <circle cx="60" cy="68" r="26" stroke="currentColor" strokeWidth="3" />
                <g style={{ transformOrigin: "60px 68px" }} className={reduced ? "" : "animate-[spin_2.4s_linear_infinite]"}>
                  <path d="M42 62c6 5 12 5 18 0s12-5 18 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  <circle cx="60" cy="80" r="3.5" fill="currentColor" opacity="0.55" />
                </g>
              </motion.svg>
            </motion.div>

            {/* Step 3: tagline reveals under the lifted cluster */}
            <motion.p
              className="mt-8 font-display text-sm font-semibold uppercase tracking-[0.3em] text-primary"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0.15 : 2.15, duration: 0.55 }}
            >
              Book your laundry slot
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** True when the splash has already played this session. */
export function splashAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
