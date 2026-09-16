import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 12 * 1024 * 1024;

export const Route = createFileRoute("/api/public/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("Speech recognition is not configured", { status: 500 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Expected an audio upload", { status: 400 });
        }

        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size === 0) {
          return new Response("No audio received", { status: 400 });
        }
        if (audio.size > MAX_BYTES) {
          return new Response("That recording is too long", { status: 413 });
        }

        const upstream = new FormData();
        // No vocabulary prompt: passing the remaining player pool made the model
        // echo that list back verbatim whenever the clip was short or quiet.
        upstream.append("model", "google/gemini-3.5-transcribe");
        // Name the part for the real container — a mismatched extension is rejected.
        const ext =
          ({
            "audio/wav": "wav",
            "audio/wave": "wav",
            "audio/x-wav": "wav",
            "audio/mpeg": "mp3",
            "audio/mp4": "mp4",
            "audio/webm": "webm",
          })[audio.type.split(";")[0] ?? ""] ?? "wav";
        upstream.append("file", audio, `recording.${ext}`);
        upstream.append("stream", "true");
        if (hints) {
          // A bare vocabulary list only. A sentence-shaped prompt gets echoed
          // back as the transcript when the clip is short, quiet, or silent.
          upstream.append("prompt", hints);
        }


        const response = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: upstream,
          },
        );

        if (!response.ok || !response.body) {
          const body = await response.text().catch(() => "");
          console.error(`Transcription failed [${response.status}]: ${body}`);
          return new Response(body || "Transcription failed", {
            status: response.status,
          });
        }

        return new Response(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
