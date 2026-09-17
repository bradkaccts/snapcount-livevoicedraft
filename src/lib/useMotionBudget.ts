import { useEffect, useState } from "react";

export type MotionBudget = "full" | "lite" | "none";

/**
 * Decides how heavy the celebration effects are allowed to be.
 * Runs after hydration so SSR output stays stable, and downgrades on
 * low-core / low-memory devices or when the user prefers reduced motion.
 */
export function useMotionBudget(): MotionBudget {
  const [budget, setBudget] = useState<MotionBudget>("lite");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { deviceMemory?: number };

    const evaluate = () => {
      if (reduce.matches) {
        setBudget("none");
        return;
      }
      const cores = nav.hardwareConcurrency ?? 4;
      const memory = nav.deviceMemory ?? 4;
      const smallScreen = window.innerWidth < 900;
      setBudget(cores >= 8 && memory >= 8 && !smallScreen ? "full" : "lite");
    };

    evaluate();
    reduce.addEventListener("change", evaluate);
    window.addEventListener("resize", evaluate);
    return () => {
      reduce.removeEventListener("change", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);

  return budget;
}
