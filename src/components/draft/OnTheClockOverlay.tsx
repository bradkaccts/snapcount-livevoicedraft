import { motion } from "motion/react";
import { Clock, Timer } from "lucide-react";

import type { ClockAnnounce } from "@/lib/useDraftPresentation";

export function OnTheClockOverlay({ announce }: { announce: ClockAnnounce }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/90 px-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Now on the clock: ${announce.teamName}`}
    >
      <motion.div
        initial={{ x: "-70vw", opacity: 0 }}
        animate={{ x: "70vw", opacity: [0, 0.45, 0.45, 0] }}
        transition={{ duration: 1.6, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-[55vw] blur-3xl"
        style={{
          background: `linear-gradient(90deg, transparent, ${announce.color}, transparent)`,
        }}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.6], opacity: [0.5, 0] }}
            transition={{
              duration: 1.6,
              delay: 0.3 + ring * 0.45,
              repeat: Infinity,
              repeatDelay: 0.4,
              ease: "easeOut",
            }}
            className="absolute h-72 w-72 rounded-full border-2 sm:h-96 sm:w-96"
            style={{ borderColor: announce.color }}
          />
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 50, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 16, delay: 0.15 }}
        className="relative flex flex-col items-center text-center"
      >
        <div
          className="absolute left-0 top-0 h-12 w-12 border-l-4 border-t-4 sm:h-16 sm:w-16"
          style={{ borderColor: announce.color }}
        />
        <div
          className="absolute bottom-0 right-0 h-12 w-12 border-b-4 border-r-4 sm:h-16 sm:w-16"
          style={{ borderColor: announce.color }}
        />

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.35, delay: 0.4 }}
          className="mb-5 flex items-center gap-2 px-5 py-2 text-xs font-black uppercase italic tracking-[0.2em] sm:text-sm"
          style={{ backgroundColor: announce.color, color: "var(--color-background)" }}
        >
          <Timer className="h-4 w-4" /> Now on the clock
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm"
        >
          Round {announce.round} · Pick {announce.round}.
          {String(announce.pickInRound).padStart(2, "0")} · #{announce.overall} overall
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, scale: 1.4, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-full px-4 font-display text-6xl uppercase leading-[0.85] sm:text-8xl lg:text-[8rem]"
          style={{ color: announce.color, textShadow: `0 0 40px ${announce.color}` }}
        >
          {announce.teamName}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:text-base"
        >
          {announce.manager || "You're on the board"}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0.4, 1], y: 8 }}
          transition={{ delay: 1.2, duration: 1.4 }}
          className="mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground"
        >
          <Clock className="h-4 w-4 animate-pulse" /> The clock is ticking
        </motion.p>
      </motion.section>
    </motion.div>
  );
}
