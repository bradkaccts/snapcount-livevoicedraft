export type TeamPalette = {
  name: string;
  primary: string;
  secondary: string;
};


/** Primary/secondary colors for every NFL club, keyed by abbreviation. */
export const NFL_TEAMS: Record<string, TeamPalette> = {
  ARI: { name: "Arizona Cardinals", primary: "#97233F", secondary: "#FFB612" },
  ATL: { name: "Atlanta Falcons", primary: "#A71930", secondary: "#000000" },
  BAL: { name: "Baltimore Ravens", primary: "#241773", secondary: "#9E7C0C" },
  BUF: { name: "Buffalo Bills", primary: "#00338D", secondary: "#C60C30" },
  CAR: { name: "Carolina Panthers", primary: "#0085CA", secondary: "#101820" },
  CHI: { name: "Chicago Bears", primary: "#0B162A", secondary: "#C83803" },
  CIN: { name: "Cincinnati Bengals", primary: "#FB4F14", secondary: "#000000" },
  CLE: { name: "Cleveland Browns", primary: "#FF3C00", secondary: "#311D00" },
  DAL: { name: "Dallas Cowboys", primary: "#041E42", secondary: "#869397" },
  DEN: { name: "Denver Broncos", primary: "#FB4F14", secondary: "#002244" },
  DET: { name: "Detroit Lions", primary: "#0076B6", secondary: "#B0B7BC" },
  GB: { name: "Green Bay Packers", primary: "#203731", secondary: "#FFB612" },
  HOU: { name: "Houston Texans", primary: "#03202F", secondary: "#A71930" },
  IND: { name: "Indianapolis Colts", primary: "#002C5F", secondary: "#A2AAAD" },
  JAX: { name: "Jacksonville Jaguars", primary: "#006778", secondary: "#D7A22A" },
  KC: { name: "Kansas City Chiefs", primary: "#E31837", secondary: "#FFB81C" },
  LV: { name: "Las Vegas Raiders", primary: "#A5ACAF", secondary: "#000000" },
  LAC: { name: "Los Angeles Chargers", primary: "#0080C6", secondary: "#FFC20E" },
  LAR: { name: "Los Angeles Rams", primary: "#003594", secondary: "#FFA300" },
  MIA: { name: "Miami Dolphins", primary: "#008E97", secondary: "#FC4C02" },
  MIN: { name: "Minnesota Vikings", primary: "#4F2683", secondary: "#FFC62F" },
  NE: { name: "New England Patriots", primary: "#002244", secondary: "#C60C30" },
  NO: { name: "New Orleans Saints", primary: "#D3BC8D", secondary: "#101820" },
  NYG: { name: "New York Giants", primary: "#0B2265", secondary: "#A71930" },
  NYJ: { name: "New York Jets", primary: "#125740", secondary: "#FFFFFF" },
  PHI: { name: "Philadelphia Eagles", primary: "#004C54", secondary: "#A5ACAF" },
  PIT: { name: "Pittsburgh Steelers", primary: "#FFB612", secondary: "#101820" },
  SEA: { name: "Seattle Seahawks", primary: "#002244", secondary: "#69BE28" },
  SF: { name: "San Francisco 49ers", primary: "#AA0000", secondary: "#B3995D" },
  TB: { name: "Tampa Bay Buccaneers", primary: "#D50A0A", secondary: "#FF7900" },
  TEN: { name: "Tennessee Titans", primary: "#4B92DB", secondary: "#0C2340" },
  WAS: { name: "Washington Commanders", primary: "#5A1414", secondary: "#FFB612" },
};

const FALLBACK: TeamPalette = {
  name: "Free Agent",
  primary: "#d4a017",
  secondary: "#f5d98a",
};

export function teamPalette(abbr: string | null | undefined): TeamPalette {
  if (!abbr) return FALLBACK;
  return NFL_TEAMS[abbr.toUpperCase()] ?? FALLBACK;
}

/** Ensures readable text on top of a team color. */
export function readableOn(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#101010" : "#ffffff";
}

/** Lightens a hex color toward white by `amount` (0-1). */
export function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(parseInt(clean.slice(0, 2), 16))}${mix(
    parseInt(clean.slice(2, 4), 16),
  )}${mix(parseInt(clean.slice(4, 6), 16))}`;
}

/** City and nickname words for a club, used to match photo captions. */
export function teamWords(abbr: string | null | undefined): {
  city: string;
  nickname: string;
  full: string;
} | null {
  const key = abbr?.toUpperCase();
  if (!key || !NFL_TEAMS[key]) return null;
  const full = NFL_TEAMS[key].name;
  const parts = full.split(" ");
  const nickname = parts[parts.length - 1] ?? full;
  return { city: parts.slice(0, -1).join(" "), nickname, full };
}

/** Nicknames of every other club, for spotting former-team photos. */
export function rivalNicknames(abbr: string | null | undefined): string[] {
  const key = abbr?.toUpperCase();
  return Object.entries(NFL_TEAMS)
    .filter(([code]) => code !== key)
    .map(([, team]) => {
      const parts = team.name.split(" ");
      return (parts[parts.length - 1] ?? team.name).toLowerCase();
    });
}
