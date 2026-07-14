/**
 * WEEEK date-field mapping.
 *
 * WEEEK's task API accepts a due/start date as EITHER a calendar date
 * (`dueDate` / `startDate`, format `Y-m-d`) OR a UTC timestamp
 * (`dueDateTime` / `startDateTime`, format strictly `Y-m-d\TH:i:s\Z`). The two
 * forms are mutually exclusive per field.
 *
 * The legacy `dateEnd` / `dateStart` fields are SILENTLY IGNORED by the create
 * endpoint (verified against the live API) — sending them set no deadline at
 * all. That was the "deadlines don't work" bug this module fixes: callers now
 * pass a single human string and we route it to the correct field.
 *
 * splitWeeekDate normalizes one agent-supplied string:
 *   "2026-07-20"            -> { date: "2026-07-20" }
 *   "2026-07-20T14:30:00Z"  -> { dateTime: "2026-07-20T14:30:00Z" }
 *   "2026-07-20T14:30+03:00" -> { dateTime: "2026-07-20T11:30:00Z" } (to UTC)
 *   "2026-07-20 14:30:00"   -> { dateTime: "2026-07-20T14:30:00Z" } (naive = UTC)
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TZ = /[zZ]$|[+-]\d{2}:?\d{2}$/;

export interface WeeekDateParts {
  /** Calendar date `Y-m-d` — goes into dueDate/startDate. */
  date?: string;
  /** UTC timestamp `Y-m-d\TH:i:s\Z` — goes into dueDateTime/startDateTime. */
  dateTime?: string;
}

/**
 * Split an agent-supplied date string into WEEEK's date / dateTime parts.
 * Throws a descriptive Error if the value cannot be parsed.
 */
export function splitWeeekDate(value: string): WeeekDateParts {
  const trimmed = value.trim();

  if (DATE_ONLY.test(trimmed)) {
    return { date: trimmed };
  }

  // A time component is present — normalize to WEEEK's strict UTC format.
  let normalized = trimmed.replace(" ", "T");
  if (!HAS_TZ.test(normalized)) {
    // Naive datetime (no zone): treat as UTC so behaviour is host-independent.
    normalized += "Z";
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid date "${value}". Use "YYYY-MM-DD" for a date, or an ISO 8601 ` +
        `timestamp such as "2026-07-20T14:30:00Z".`
    );
  }

  // toISOString() always yields `...THH:mm:ss.sssZ`; WEEEK wants no millis.
  const iso = parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
  return { dateTime: iso };
}
