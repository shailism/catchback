/**
 * Central Free vs planned Plus feature definitions.
 *
 * Presentation only: nothing here grants, gates or charges for anything.
 * "working" items are live today; "goal" items are future Free ambitions;
 * "planned" Plus items are not built, not available and have no final
 * availability or pricing. Reuse these lists anywhere the split is shown
 * so wording stays consistent; do not add enforcement.
 */

export type FeatureStatus = "working" | "goal" | "planned";

export interface FeatureItem {
  label: string;
  /** Optional; the list an item belongs to already conveys its status. */
  status?: FeatureStatus;
  /** Optional plain-language note, e.g. where data lives. */
  note?: string;
}

export const FREE_WORKING: FeatureItem[] = [
  { label: "Photo catch journal", note: "Add catches from camera or gallery, with large photos." },
  { label: "Edit every detail", note: "Date, time, species, catch location and notes — plus optional bait, technique, weight and length. You confirm the details." },
  { label: "Calendar and photo views" },
  { label: "Manual trip log, including no catches", note: "Choose a date and outcome, with optional spot, duration, bait, technique and notes. Separate from catch photos." },
  { label: "Basic catch statistics", note: "Insights counts saved records, named species and catch dates, with species, bait and technique breakdowns and largest recorded measurements. Not catch rates or predictions." },
  { label: "Private catch locations", note: "Spots are stored only on this device and never uploaded or shared." },
  { label: "Annual reminders", note: "Choose how many days before and what time — add, edit or remove reminders, and mute single catches. Shown inside the app only." },
  { label: "Manual backup export and import", note: "Your backup file includes catches, photos, trips and reminder settings; keep it private." },
];

export const FREE_GOALS: FeatureItem[] = [
  { label: "Standalone saved spots" },
  { label: "Gear logging" },
];

export const PLUS_PLANNED: FeatureItem[] = [
  { label: "Deeper pattern comparisons across your catches" },
  { label: "Match upcoming conditions to similar past sessions" },
  { label: "Optional route recording" },
  { label: "Advanced return planning" },
];

export const PLUS_STATUS_NOTE =
  "Plus is planned and not available yet. Availability and pricing are not finalized, and nothing here is an offer or a purchase.";
