/**
 * Curated set of short, German, business-oriented semantic tags. The AI is
 * steered toward these but may introduce new ones; new tags inherit a default
 * color. Colors come from the DESIGN.md accent family.
 */
export const SEED_TAGS: { name: string; color: string }[] = [
  { name: "mobilfunk", color: "#2c84e0" },
  { name: "fracht", color: "#2c8c66" },
  { name: "maut", color: "#b17816" },
  { name: "kraftstoff", color: "#cd4239" },
  { name: "fahrzeugwaesche", color: "#1078a3" },
  { name: "softwareabo", color: "#7c44a6" },
  { name: "hosting", color: "#2c84e0" },
  { name: "fahrzeugpruefung", color: "#2c8c66" },
  { name: "versicherung", color: "#7c44a6" },
  { name: "buero", color: "#6c6e63" },
  { name: "leasing", color: "#b17816" },
  { name: "wartung", color: "#cd4239" },
  { name: "reinigung", color: "#1078a3" },
  { name: "energie", color: "#2c8c66" },
  { name: "beratung", color: "#7c44a6" },
];

export const TAG_PALETTE = [
  "#2c84e0",
  "#2c8c66",
  "#b17816",
  "#cd4239",
  "#1078a3",
  "#7c44a6",
  "#6c6e63",
];

export function tagColorFor(name: string): string {
  const seed = SEED_TAGS.find((t) => t.name === name);
  if (seed) return seed.color;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

/** Normalize a free-form tag into our short lowercase German convention. */
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}
