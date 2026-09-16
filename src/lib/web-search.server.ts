export type SearchResult = { title: string; url: string };

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function cleanUrl(raw: string): string {
  let url = decodeEntities(raw);
  if (url.startsWith("//")) url = `https:${url}`;
  // DuckDuckGo wraps outbound links in /l/?uddg=<encoded>
  const match = url.match(/[?&]uddg=([^&]+)/);
  if (match?.[1]) {
    try {
      url = decodeURIComponent(match[1]);
    } catch {
      /* keep the wrapped url */
    }
  }
  return url;
}

/**
 * Lightweight web search used by the highlight agent.
 * Uses DuckDuckGo's HTML endpoint; returns an empty list on any failure so
 * callers can fall back gracefully.
 */
export async function searchWeb(query: string, limit = 8): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        },
        body: `q=${encodeURIComponent(query)}`,
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];
    const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && results.length < limit) {
      const url = cleanUrl(m[1] ?? "");
      const title = decodeEntities((m[2] ?? "").replace(/<[^>]*>/g, "")).trim();
      if (url.startsWith("http") && title) results.push({ title, url });
    }
    return results;
  } catch {
    return [];
  }
}

export function youtubeIdFromUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}
