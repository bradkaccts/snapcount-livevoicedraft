import { motion } from "motion/react";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { POSITION_CLASS } from "@/lib/draft-utils";
import { lighten, readableOn, teamPalette } from "@/lib/nfl-teams";
import { useMotionBudget, type MotionBudget } from "@/lib/useMotionBudget";
import type { Spotlight } from "@/lib/useDraftPresentation";

// Seeded RNG so a given pick always replays the same firework show.
function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type FireworkBurst = {
  side: "left" | "right";
  originX: number;
  originY: number;
  delay: number;
  duration: number;
  type: "peony" | "ring" | "willow" | "spokes";
  sparkCount: number;
  colors: string[];
};

function buildFireworkPlan(
  seedKey: string,
  teamColor: string,
  budget: MotionBudget = "full",
): FireworkBurst[] {
  if (budget === "none") return [];
  const lite = budget === "lite";
  const rand = mulberry32(hashSeed(seedKey));
  const types: FireworkBurst["type"][] = ["peony", "ring", "willow", "spokes"];
  const bursts: FireworkBurst[] = [];
  for (const side of ["left", "right"] as const) {
    const count = lite ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 3);
    let t = 0.25 + rand() * 0.5;
    for (let b = 0; b < count; b++) {
      const roll = rand();
      const hue = Math.floor(rand() * 360);
      const colors =
        roll < 0.35
          ? [teamColor, "#ffffff"]
          : roll < 0.55
            ? ["#d4af37", "#fff3c4"]
            : roll < 0.75
              ? ["#e8ecf1", teamColor, "#d4af37"]
              : [`hsl(${hue} 95% 62%)`, `hsl(${(hue + 60) % 360} 95% 68%)`, "#ffffff"];
      bursts.push({
        side,
        originX: side === "left" ? 5 + rand() * 20 : 95 - rand() * 20,
        originY: 78 + rand() * 16,
        delay: t,
        duration: 0.95 + rand() * 0.5,
        type: types[Math.floor(rand() * types.length)] ?? "peony",
        sparkCount: lite ? 8 + Math.floor(rand() * 5) : 12 + Math.floor(rand() * 12),
        colors,
      });
      t += 0.7 + rand() * 0.9;
    }
  }
  return bursts;
}

function sparkOffset(
  type: FireworkBurst["type"],
  spark: number,
  count: number,
  rand: () => number,
): { x: number; y: number } {
  const angle = (spark / count) * Math.PI * 2 + rand() * 0.3;
  if (type === "ring") {
    const d = 105;
    return { x: Math.cos(angle) * d, y: Math.sin(angle) * d };
  }
  if (type === "willow") {
    const d = 55 + rand() * 70;
    return { x: Math.cos(angle) * d * 0.9, y: Math.abs(Math.sin(angle)) * d * 0.45 + d * 0.55 };
  }
  if (type === "spokes") {
    const spokes = 6;
    const spokeAngle = ((spark % spokes) / spokes) * Math.PI * 2;
    const d = 80 + rand() * 60;
    return { x: Math.cos(spokeAngle) * d, y: Math.sin(spokeAngle) * d * 0.9 };
  }
  const d = 65 + rand() * 65;
  return { x: Math.cos(angle) * d, y: Math.sin(angle) * d * 0.85 };
}

type Props = {
  spotlight: Spotlight;
  onClose: () => void;
  onMediaError: (field: "actionUrl" | "headshotUrl") => void;
};

export function PickCelebration({ spotlight, onClose, onMediaError }: Props) {
  const palette = teamPalette(spotlight.player.nfl_team);
  const spotlightKey = `${spotlight.overall}-${spotlight.player.id}`;
  const motionBudget = useMotionBudget();
  const fireworkPlan = useMemo(
    () => buildFireworkPlan(spotlightKey, palette.primary, motionBudget),
    [spotlightKey, palette.primary, motionBudget],
  );
  const confettiCount = motionBudget === "full" ? 72 : motionBudget === "lite" ? 32 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/95 px-5 py-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${spotlight.player.name} selected by ${spotlight.teamName}`}
      style={
        {
          "--celebration": palette.primary,
          "--celebration-foreground": readableOn(palette.primary),
          "--celebration-soft": lighten(palette.primary, 0.35),
        } as Record<string, string>
      }
    >
      {spotlight.media?.actionUrl && (
        <motion.img
          key={spotlight.media.actionUrl}
          src={spotlight.media.actionUrl}
          alt={`${spotlight.player.name} in action`}
          initial={{ opacity: 0, scale: 1.18 }}
          animate={{ opacity: 0.4, scale: 1 }}
          transition={{ duration: 6, ease: "easeOut" }}
          onError={() => onMediaError("actionUrl")}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 45%, rgba(6,8,12,0.35) 5%, ${palette.secondary}55 55%, rgba(6,8,12,0.94) 100%)`,
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.2] }}
        transition={{ duration: 1.4, times: [0, 0.25, 1] }}
        className="pointer-events-none absolute inset-0 bg-celebration mix-blend-overlay"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
        <motion.div
          initial={{ rotate: -30, x: "-85%" }}
          animate={{ rotate: 35, x: "85%" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="h-28 w-[160vw] bg-celebration blur-3xl"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {fireworkPlan.map((burst, burstIndex) => {
          const sparkRand = mulberry32(hashSeed(`${spotlightKey}-${burstIndex}`));
          return (
            <div
              key={`${burst.side}-${burstIndex}`}
              className="absolute"
              style={{ left: `${burst.originX}%`, top: `${burst.originY}%` }}
            >
              <motion.span
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: [0, 3.2], opacity: [0.9, 0] }}
                transition={{ duration: 0.9, delay: burst.delay, ease: "easeOut" }}
                className="absolute -left-10 -top-10 h-20 w-20 rounded-full"
                style={{
                  background: `radial-gradient(circle, #ffffff 0%, ${burst.colors[0]} 35%, transparent 70%)`,
                }}
              />
              {Array.from({ length: burst.sparkCount }, (_, spark) => {
                const { x, y } = sparkOffset(burst.type, spark, burst.sparkCount, sparkRand);
                const color = burst.colors[spark % burst.colors.length];
                return (
                  <motion.span
                    key={spark}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x, y, opacity: [1, 1, 0], scale: [1, 0.6, 0.1] }}
                    transition={{ duration: burst.duration, delay: burst.delay, ease: "easeOut" }}
                    className="firework-spark absolute h-3 w-3 rounded-full"
                    style={{
                      background: `radial-gradient(circle, #ffffff 0%, ${color} 38%, transparent 72%)`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {Array.from({ length: confettiCount }, (_, index) => (
          <motion.span
            key={index}
            initial={{
              left: `${3 + ((index * 29) % 94)}%`,
              top: 0,
              y: "-10vh",
              rotate: 0,
              opacity: 0,
            }}
            animate={{
              y: "110vh",
              rotate: index % 2 === 0 ? 540 : -540,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 2.6 + (index % 5) * 0.3,
              delay: 0.35 + (index % 11) * 0.09,
              ease: "easeIn",
            }}
            className={`confetti-piece absolute ${
              index % 4 === 3 ? "h-2 w-2 rounded-full" : "h-3 w-1.5"
            } ${
              index % 3 === 0
                ? "confetti-gold"
                : index % 3 === 1
                  ? "confetti-team"
                  : "confetti-silver"
            }`}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Dismiss highlight"
        className="absolute right-5 top-5 z-30 text-muted-foreground hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </Button>

      <motion.section
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 16, delay: 0.18 }}
        className="relative flex w-full max-w-5xl flex-col items-center justify-center text-center"
      >
        <div className="absolute left-0 top-0 h-14 w-14 border-l-4 border-t-4 border-celebration sm:h-20 sm:w-20" />
        <div className="absolute bottom-0 right-0 h-14 w-14 border-b-4 border-r-4 border-celebration sm:h-20 sm:w-20" />

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="mb-4 flex items-center gap-2 bg-celebration px-5 py-2 text-xs font-black uppercase italic tracking-[0.2em] text-celebration-foreground sm:text-sm"
        >
          <Sparkles className="h-4 w-4" /> The pick is in
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.62 }}
          className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 shadow-[0_0_40px_var(--celebration)] sm:h-32 sm:w-32"
          style={{ borderColor: palette.primary, backgroundColor: palette.secondary }}
        >
          {spotlight.media?.headshotUrl ? (
            <img
              src={spotlight.media.headshotUrl}
              alt={spotlight.player.name}
              className="h-full w-full object-cover"
              onError={() => onMediaError("headshotUrl")}
            />
          ) : (
            <span
              className="font-display text-3xl uppercase sm:text-4xl"
              style={{ color: readableOn(palette.secondary) }}
            >
              {spotlight.player.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 3)}
            </span>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm"
        >
          Round {spotlight.round} · Pick {spotlight.round}.
          {String(spotlight.pickInRound).padStart(2, "0")} · #{spotlight.overall} overall
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, scale: 1.35, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.65, delay: 0.82, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-full px-4 font-display text-6xl uppercase leading-[0.82] text-foreground drop-shadow-[0_0_30px_var(--celebration)] sm:text-8xl lg:text-[9rem]"
        >
          {spotlight.player.name}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.45, delay: 1.15 }}
          className="mt-5 flex w-full max-w-xl items-center justify-center gap-4"
        >
          <span className="h-0.5 flex-1 bg-celebration" />
          <span className={`pos-chip ${POSITION_CLASS[spotlight.player.position] ?? ""}`}>
            {spotlight.player.position}
          </span>
          <span className="text-lg font-bold uppercase text-celebration sm:text-2xl">
            {spotlight.player.nfl_team}
          </span>
          <span className="h-0.5 flex-1 bg-celebration" />
        </motion.div>

        {spotlight.player.stat_line && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.35 }}
            className="mt-4 text-sm text-muted-foreground sm:text-base"
          >
            {spotlight.player.stat_line}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-8 border-t border-border px-10 pt-6"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Selected by
          </p>
          <p className="mt-1 font-display text-3xl uppercase text-foreground sm:text-4xl">
            {spotlight.teamName}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.75 }}
          className="mt-5 min-h-12 max-w-xl px-4"
        >
          {spotlight.highlight ? (
            <>
              {spotlight.highlight.summary && (
                <p className="text-sm text-muted-foreground">{spotlight.highlight.summary}</p>
              )}
              {spotlight.highlight.url && (
                <Button asChild variant="secondary" className="mt-3">
                  <a href={spotlight.highlight.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {spotlight.highlight.title ?? "Watch highlights"}
                  </a>
                </Button>
              )}
            </>
          ) : (
            <p className="animate-pulse text-sm font-semibold uppercase tracking-widest text-celebration-soft">
              Finding the highlight reel…
            </p>
          )}
        </motion.div>
      </motion.section>
    </motion.div>
  );
}
