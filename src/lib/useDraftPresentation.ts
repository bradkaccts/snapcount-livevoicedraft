import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { findPlayerHighlight, type HighlightResult } from "@/lib/highlights.functions";
import { findPlayerMedia, type PlayerMedia } from "@/lib/player-media.functions";
import type { Draft, DraftTeam, Pick, Player } from "@/lib/useDraftRoom";

export type Spotlight = {
  player: Player;
  teamName: string;
  highlight: HighlightResult | null;
  media: PlayerMedia | null;
  overall: number;
  round: number;
  pickInRound: number;
};

export type ClockAnnounce = {
  teamId: string;
  teamName: string;
  manager: string | null;
  color: string;
  round: number;
  pickInRound: number;
  overall: number;
};

type Args = {
  draft: Draft | null;
  teams: DraftTeam[];
  picks: Pick[];
  playersById: Map<string, Player>;
  complete: boolean;
  current: { round: number; pickInRound: number; slot: number } | null;
  onTheClock: DraftTeam | null;
};

/**
 * Drives the broadcast overlays (pick celebration, then "Now on the Clock")
 * off the live pick feed, so every open window — console or big board —
 * plays the same sequence at the same time.
 */
export function useDraftPresentation({
  draft,
  teams,
  picks,
  playersById,
  complete,
  current,
  onTheClock,
}: Args) {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [clockAnnounce, setClockAnnounce] = useState<ClockAnnounce | null>(null);
  const highlight = useServerFn(findPlayerHighlight);
  const playerMedia = useServerFn(findPlayerMedia);

  const lastSeen = useRef<number | null>(null);
  const skipNextAnnounce = useRef(false);

  useEffect(() => {
    const maxOverall = picks.reduce((m, p) => Math.max(m, p.overall), 0);
    if (lastSeen.current === null) {
      lastSeen.current = maxOverall;
      return;
    }
    if (maxOverall <= lastSeen.current) {
      lastSeen.current = maxOverall;
      return;
    }
    const entry = picks.find((p) => p.overall === maxOverall);
    lastSeen.current = maxOverall;
    if (!entry) return;
    const player = playersById.get(entry.player_id);
    if (!player) return;
    const team = teams.find((t) => t.id === entry.team_id);
    setSpotlight({
      player,
      teamName: team?.name ?? "",
      highlight: null,
      media: null,
      overall: entry.overall,
      round: entry.round,
      pickInRound: entry.pick_in_round,
    });
    void highlight({ data: { playerId: player.id } })
      .then((result) =>
        setSpotlight((prev) =>
          prev && prev.player.id === player.id ? { ...prev, highlight: result } : prev,
        ),
      )
      .catch(() => undefined);
    void playerMedia({ data: { playerId: player.id } })
      .then((media) =>
        setSpotlight((prev) =>
          prev && prev.player.id === player.id ? { ...prev, media } : prev,
        ),
      )
      .catch(() => undefined);
  }, [picks, playersById, teams, highlight, playerMedia]);

  // Let the celebration play out (~4s), hold for 3s, then return to the board.
  const spotlightKey = spotlight ? `${spotlight.overall}-${spotlight.player.id}` : null;
  useEffect(() => {
    if (!spotlightKey) return;
    const timer = setTimeout(() => setSpotlight(null), 7000);
    return () => clearTimeout(timer);
  }, [spotlightKey]);

  // The moment the celebration closes, hand the mic to the next drafter.
  const celebrationWasOpen = useRef(false);
  useEffect(() => {
    const wasOpen = celebrationWasOpen.current;
    celebrationWasOpen.current = Boolean(spotlight);
    if (!wasOpen || spotlight || complete || !draft) return;
    if (skipNextAnnounce.current) {
      skipNextAnnounce.current = false;
      return;
    }
    if (!onTheClock || !current) return;
    setClockAnnounce({
      teamId: onTheClock.id,
      teamName: onTheClock.name,
      manager: onTheClock.manager,
      color: onTheClock.color,
      round: current.round,
      pickInRound: current.pickInRound,
      overall: draft.current_overall,
    });
  }, [spotlight, draft, complete, onTheClock, current]);

  const announceKey = clockAnnounce ? `${clockAnnounce.overall}-${clockAnnounce.teamId}` : null;
  useEffect(() => {
    if (!announceKey) return;
    const timer = setTimeout(() => setClockAnnounce(null), 4500);
    return () => clearTimeout(timer);
  }, [announceKey]);

  // Undo should clear the stage without announcing the next drafter twice.
  const clearForUndo = useCallback(() => {
    skipNextAnnounce.current = true;
    setSpotlight(null);
    setClockAnnounce(null);
  }, []);

  return {
    spotlight,
    setSpotlight,
    clockAnnounce,
    clearForUndo,
    presenting: Boolean(spotlight || clockAnnounce),
  };
}
