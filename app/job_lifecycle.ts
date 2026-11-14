import { createHash } from "crypto";

export interface JobAvailabilityEvidence {
  sourceIsActive?: boolean;
  expiresAt?: string;
  postedDate?: string;
}

function dateOnly(value: unknown): string | null {
  const raw = String(value || "").trim();
  const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return isoDate && Number.isFinite(Date.parse(`${isoDate}T00:00:00Z`)) ? isoDate : null;
}

export function expiryDateBeforePostedDate(expiresAt?: string, postedDate?: string): boolean {
  const expiryDay = dateOnly(expiresAt);
  const postedDay = dateOnly(postedDate);
  return Boolean(expiryDay && postedDay && expiryDay < postedDay);
}

export function confirmedExpiryReason(
  evidence: JobAvailabilityEvidence,
  now: Date = new Date(),
): string | null {
  if (evidence.sourceIsActive === false) return "The source confirms this posting is closed";

  const expiresAt = String(evidence.expiresAt || "").trim();
  if (!expiresAt) return null;
  if (expiryDateBeforePostedDate(expiresAt, evidence.postedDate)) return null;

  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt)
    ? Date.parse(`${expiresAt}T23:59:59.999Z`)
    : Date.parse(expiresAt);
  if (!Number.isFinite(deadline)) return null;
  return deadline < now.getTime() ? `Application deadline passed (${expiresAt.slice(0, 10)})` : null;
}

export function repairInvalidExpiryMetadata(seen: Record<string, any>): boolean {
  let changed = false;
  for (const item of Object.values(seen)) {
    if (!item || !expiryDateBeforePostedDate(item.expires_at, item.posted_date)) continue;
    delete item.expires_at;
    if (String(item.availability_reason || "").startsWith("Application deadline passed")) {
      item.availability_status = "active";
      delete item.availability_reason;
      delete item.availability_closed_at;
    }
    changed = true;
  }
  return changed;
}

function normalizedDescription(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function explicitPostedDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

export function isMateriallyDifferentListing(
  existing: { posted_date?: string; full_jd?: string },
  incoming: { postedDate?: string; description?: string },
): boolean {
  const oldDate = explicitPostedDate(existing.posted_date);
  const newDate = explicitPostedDate(incoming.postedDate);
  if (oldDate && newDate && oldDate !== newDate) return true;

  const oldText = normalizedDescription(existing.full_jd);
  const newText = normalizedDescription(incoming.description);
  if (oldText.length < 500 || newText.length < 500) return false;

  const oldWords = new Set(oldText.split(/\s+/).filter(word => word.length > 2));
  const newWords = new Set(newText.split(/\s+/).filter(word => word.length > 2));
  if (!oldWords.size || !newWords.size) return false;
  let shared = 0;
  for (const word of oldWords) if (newWords.has(word)) shared++;
  const similarity = shared / (oldWords.size + newWords.size - shared);
  return similarity < 0.58;
}

export function repostRecordId(baseId: string, postedDate?: string, description?: string): string {
  const fingerprint = createHash("sha256")
    .update(`${String(postedDate || "").trim()}|${normalizedDescription(description)}`)
    .digest("hex")
    .slice(0, 12);
  return `${baseId}_repost_${fingerprint}`;
}
