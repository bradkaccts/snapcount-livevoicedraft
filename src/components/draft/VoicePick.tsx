import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { POSITION_CLASS } from "@/lib/draft-utils";
import { startRecording, streamTranscription, type Recorder } from "@/lib/recorder";
import { resolveVoicePick, type ResolvedVoicePick } from "@/lib/voice-pick.functions";
import type { Player } from "@/lib/useDraftRoom";

type Props = {
  draftId: string;
  players: Player[];
  onConfirm: (player: Player) => void;
  disabled?: boolean | undefined;
};

const AUTO_DELAY_MS = 3000;

export function VoicePick({ draftId, players, onConfirm, disabled }: Props) {
  const recorder = useRef<Recorder | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "thinking">("idle");
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [shownWords, setShownWords] = useState(0);
  const shownRef = useRef(0);
  const revealDone = useRef<(() => void) | null>(null);
  const [candidates, setCandidates] = useState<Player[]>([]);
  const [pending, setPending] = useState<Player | null>(null);
  const [countdown, setCountdown] = useState(3);

  // Subtitle reveal: show one word every ~120ms until the whole transcript is on screen.
  useEffect(() => {
    const total = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (shownWords >= total) {
      if (total > 0 && revealDone.current) {
        revealDone.current();
        revealDone.current = null;
      }
      return;
    }
    const t = setTimeout(() => {
      shownRef.current += 1;
      setShownWords(shownRef.current);
    }, 120);
    return () => clearTimeout(t);
  }, [transcript, shownWords]);

  const revealAll = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const total = text.trim().split(/\s+/).filter(Boolean).length;
      if (total === 0 || shownRef.current >= total) {
        resolve();
        return;
      }
      revealDone.current = resolve;
    });
  }, []);

  const byId = useCallback(
    (id: string) => players.find((p) => p.id === id) ?? null,
    [players],
  );

  const clearAuto = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
    setPending(null);
  }, []);

  const begin = useCallback(async () => {
    clearAuto();
    setTranscript("");
    shownRef.current = 0;
    setShownWords(0);
    setCandidates([]);
    try {
      recorder.current = await startRecording({ onLevel: setLevel });
      setState("recording");
    } catch {
      toast.error(
        "The board needs your microphone to hear picks. Allow microphone access in your browser, then try again.",
      );
    }
  }, [clearAuto]);

  const finish = useCallback(async () => {
    const active = recorder.current;
    if (!active) return;
    recorder.current = null;
    setLevel(0);
    setState("thinking");
    try {
      const blob = await active.stop();
      if (blob.size < 2048) {
        toast.error("That recording was empty — try again.");
        setState("idle");
        return;
      }

      let heard = "";
      for await (const event of streamTranscription(blob, [])) {
        if (event.delta) {
          heard += event.delta;
          setTranscript(heard);
        } else if (event.text) {
          heard = event.text;
          setTranscript(heard);
        }
      }
      if (!heard.trim()) {
        toast.error("Didn't catch that — say the name again or tap a player.");
        setState("idle");
        return;
      }

      // Wait until every spoken word is on screen before the board acts on it.
      setTranscript(heard);
      await revealAll(heard);

      // Silence and near-silence come back as boilerplate ("context:", "thank you").
      const lower = heard.trim().toLowerCase().replace(/[^a-z\s]/g, "").trim();
      const junk = ["", "context", "thank you", "thanks", "you", "bye", "music", "subtitles"];
      if (junk.includes(lower) || lower.length < 3) {
        setTranscript("");
        toast.error("Didn't catch that — hold the button and speak the player's name clearly.");
        setState("idle");
        return;
      }



      const result: ResolvedVoicePick = await resolveVoicePick({
        data: { draftId, transcript: heard.trim().slice(0, 500) },
      });

      if (result.alreadyDrafted) {
        toast.error(`${result.alreadyDrafted} is already off the board.`);
        setState("idle");
        return;
      }

      const matched = result.candidates
        .map((c) => byId(c.id))
        .filter((p): p is Player => p !== null);

      if (matched.length === 0) {
        toast.error(`No available player matched “${heard.trim()}”`);
        setState("idle");
        return;
      }

      if (result.status === "auto" && matched[0]) {
        const target = matched[0];
        setCandidates([]);
        setPending(target);
        setCountdown(3);
        autoTimer.current = setTimeout(() => {
          autoTimer.current = null;
          setPending(null);
          setTranscript("");
          onConfirm(target);
        }, AUTO_DELAY_MS);
      } else {
        setCandidates(matched);
      }
      setState("idle");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transcription failed");
      setState("idle");
    }
  }, [byId, draftId, onConfirm, players]);

  // Countdown label while an auto-pick is about to commit.
  useEffect(() => {
    if (!pending) return;
    setCountdown(3);
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [pending]);

  // Spacebar push-to-talk.
  useEffect(() => {
    if (disabled) return;
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"));
    };
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      if (state === "idle" && !recorder.current) void begin();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target)) return;
      event.preventDefault();
      if (recorder.current) void finish();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [begin, finish, state, disabled]);

  useEffect(() => () => clearAuto(), [clearAuto]);

  return (
    <div className="border-t border-border bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        <Button
          size="lg"
          variant={state === "recording" ? "destructive" : "default"}
          className="h-12 flex-1 text-base"
          onClick={state === "recording" ? finish : begin}
          disabled={disabled || state === "thinking"}
        >
          {state === "thinking" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : state === "recording" ? (
            <Square className="mr-2 h-5 w-5" />
          ) : (
            <Mic className="mr-2 h-5 w-5" />
          )}
          {state === "recording"
            ? "Stop and match"
            : state === "thinking"
              ? "Listening back…"
              : "Call the pick"}
        </Button>
      </div>

      {state === "idle" && !pending && candidates.length === 0 && (
        <p className="mt-2 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          Hold space to talk · say the name and the club to draft instantly
        </p>
      )}

      {state === "recording" && (
        <div className="mt-3">
          <p className="text-center text-xs uppercase tracking-widest text-destructive">
            Recording — say the player and his club
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-destructive transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>
      )}

      {transcript && (
        <p className="mt-3 rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
          “{transcript.trim()}”
        </p>
      )}

      {pending && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-primary bg-primary/15 p-3">
          <span className={`pos-chip ${POSITION_CLASS[pending.position] ?? ""}`}>
            {pending.position}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">Drafting {pending.name}</span>
            <span className="block text-xs text-muted-foreground">
              {pending.nfl_team} · committing in {countdown}s
            </span>
          </span>
          <Button size="sm" variant="ghost" onClick={clearAuto}>
            <X className="mr-1 h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Confirm the pick
          </p>
          {candidates.map((player, index) => (
            <button
              key={player.id}
              type="button"
              onClick={() => {
                setCandidates([]);
                setTranscript("");
                onConfirm(player);
              }}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary ${
                index === 0 ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <span className={`pos-chip ${POSITION_CLASS[player.position] ?? ""}`}>
                {player.position}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{player.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {player.nfl_team} · Rank {player.rank}
                </span>
              </span>
              {index === 0 && (
                <span className="text-xs font-bold uppercase text-primary">Best match</span>
              )}
            </button>
          ))}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              setCandidates([]);
              setTranscript("");
            }}
          >
            None of these
          </Button>
        </div>
      )}
    </div>
  );
}
