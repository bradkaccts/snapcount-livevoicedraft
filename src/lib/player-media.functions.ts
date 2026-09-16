import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ playerId: z.string().uuid() });

export type PlayerMedia = {
  actionUrl: string | null;
  headshotUrl: string | null;
};

type CommonsImage = { title: string; url: string; width: number };

const BAD_TITLE = /logo|helmet|wordmark|uniform|map|stadium|signature|icon|svg/i;

async function commonsImages(query: string): Promise<CommonsImage[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|size",
    iiurlwidth: "1600",
  });
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "SnapcountDraft/1.0 (fantasy draft app)" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: { pages?: Record<string, any> };
    };
    const pages = Object.values(json.query?.pages ?? {});
    return pages
      .map((page) => {
        const info = page?.imageinfo?.[0];
        const url: string | undefined = info?.thumburl ?? info?.url;
        const title: string = page?.title ?? "";
        if (!url || typeof url !== "string") return null;
        return { title, url, width: Number(info?.thumbwidth ?? info?.width ?? 0) };
      })
      .filter((img): img is CommonsImage => Boolean(img))
      .filter((img) => !BAD_TITLE.test(img.title) && /\.(jpg|jpeg|png|webp)/i.test(img.url));
  } catch {
    return [];
  }
}

async function wikipediaThumb(name: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${name} American football`,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
  });
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "SnapcountDraft/1.0 (fantasy draft app)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { pages?: Record<string, any> } };
    const page = Object.values(json.query?.pages ?? {})[0];
    const url: string | undefined = page?.thumbnail?.source;
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Finds an action photo and a headshot for a drafted player.
 * Cached per player so the lookup only runs once.
 */
export const findPlayerMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<PlayerMedia> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cached } = await supabaseAdmin
      .from("player_media")
      .select("action_url, headshot_url")
      .eq("player_id", data.playerId)
      .maybeSingle();
    if (cached) {
      return { actionUrl: cached.action_url, headshotUrl: cached.headshot_url };
    }

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("name, position, nfl_team")
      .eq("id", data.playerId)
      .maybeSingle();
    if (!player) return { actionUrl: null, headshotUrl: null };

    const [images, thumb] = await Promise.all([
      commonsImages(`${player.name} football`),
      wikipediaThumb(player.name),
    ]);

    const surnameParts = player.name.split(" ");
    const surname = surnameParts[surnameParts.length - 1] ?? player.name;
    const named = images.filter((img) =>
      img.title.toLowerCase().includes(surname.toLowerCase()),
    );
    const pool = named.length > 0 ? named : images;
    const widest = [...pool].sort((a, b) => b.width - a.width)[0] ?? null;

    const result: PlayerMedia = {
      actionUrl: widest?.url ?? null,
      headshotUrl: thumb ?? pool[0]?.url ?? null,
    };

    if (result.actionUrl || result.headshotUrl) {
      await supabaseAdmin.from("player_media").upsert({
        player_id: data.playerId,
        action_url: result.actionUrl,
        headshot_url: result.headshotUrl,
        source: "wikimedia",
      });
    }

    return result;
  });
