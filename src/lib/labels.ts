export const STATUS_LABEL: Record<string, string> = {
  pending: "Wartend",
  processing: "In Bearbeitung",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  needs_review: "Prüfung nötig",
};

export const STATUS_VARIANT: Record<string, "neutral" | "blue" | "green" | "red" | "purple"> = {
  pending: "neutral",
  processing: "blue",
  completed: "green",
  failed: "red",
  needs_review: "purple",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  rechnung: "Rechnung",
  gutschrift: "Gutschrift",
  mahnung: "Mahnung",
  angebot: "Angebot",
  lieferschein: "Lieferschein",
  sonstiges: "Sonstiges",
};

export const DOC_TYPES = Object.keys(DOC_TYPE_LABEL);
export const STATUSES = Object.keys(STATUS_LABEL);
