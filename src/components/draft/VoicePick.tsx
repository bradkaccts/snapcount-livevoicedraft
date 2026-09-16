import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { POSITION_CLASS, matchPlayers, normalizeSpoken } from "@/lib/draft-utils";
import { startRecording, streamTranscription, type Recorder } from "@/lib/recorder";
import type { Player } from "@/lib/useDraftRoom";

type Props = {
  players: Player[];
  onConfirm: (player: Player) => void;
  disabled?: boolean | undefined;
};

export function VoicePick({ players, onConfirm, disabled }: Props) {
  const recorder = useRef<Recorder | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "thinking">("idle");
  const [transcript, setTranscript] = useState("");
  const [candidates, setCandidates] = useState<Player[]>([]);

  const begin = async () => {
    setTranscript("");
    setCandidates([]);
    try {
      recorder.current = await startRecording();
      setState("recording");
    } catch {
      toast.error("Microphone access is needed to call picks out loud.");
    }
  };

  const finish = async () => {
    const active = recorder.current;
    if (!active) return;
    recorder.current = null;
    setState("thinking");
    try {
      const blob = await active.stop();
      if (blob.size < 2048) {
        toast.error("That recording was empty — try again.");
        setState("idle");
        return;
      }
      let heard = "";
      for await (const event of streamTranscription(blob)) {
        if (event.delta) {
          heard += event.delta;
          setTranscript(heard);
        } else if (event.text) {
          heard = event.text;
          setTranscript(heard);
        }
      }
      const cleaned = normalizeSpoken(heard);
      if (!cleaned) {
        toast.error("Didn't catch a name — say it again or tap a player.");
        setState("idle");
        return;
      }
      const matches = matchPlayers(cleaned, players, 4).filter((m) => m.score > 0.4);
      if (matches.length === 0) {
        toast.error(`No available player matched "${heard.trim()}"`);
      }
      setCandidates(matches.map((m) => m.player));
      setState("idle");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transcription failed");
      setState("idle");
    }
  };

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

      {state === "recording" && (
        <p className="mt-2 text-center text-xs uppercase tracking-widest text-destructive">
          Recording — say the player's name
        </p>
      )}

      {transcript && (
        <p className="mt-3 rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
          “{transcript.trim()}”
        </p>
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
