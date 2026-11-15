import { describe, expect, test } from "bun:test";
import { confirmedExpiryReason, isMateriallyDifferentListing, repairInvalidExpiryMetadata, repostRecordId } from "../job_lifecycle";

describe("job availability and relisting rules", () => {
  const now = new Date("2026-11-14T12:00:00.000Z");

  test("does not infer expiry from an old posting date or missing results", () => {
    expect(confirmedExpiryReason({}, now)).toBeNull();
  });

  test("expires only on explicit closure or a deadline that has passed", () => {
    expect(confirmedExpiryReason({ sourceIsActive: false }, now)).toContain("source confirms");
    expect(confirmedExpiryReason({ expiresAt: "2026-11-13" }, now)).toContain("deadline passed");
    expect(confirmedExpiryReason({ expiresAt: "2026-11-14" }, now)).toBeNull();
    expect(confirmedExpiryReason({ expiresAt: "not-a-date" }, now)).toBeNull();
  });

  test("ignores deadlines that predate a posting", () => {
    expect(confirmedExpiryReason({ expiresAt: "2026-01-12", postedDate: "2026-10-28" }, now)).toBeNull();
    expect(confirmedExpiryReason({ expiresAt: "2026-01-12", postedDate: "2026-10-28T11:00:00.000Z" }, now)).toBeNull();
    expect(confirmedExpiryReason({ sourceIsActive: false, expiresAt: "2026-01-12", postedDate: "2026-10-28" }, now)).toContain("source confirms");
  });

  test("repairs impossible deadline expiry without changing application status", () => {
    const seen = {
      applied: {
        expires_at: "2026-01-12",
        posted_date: "2026-10-28",
        availability_status: "expired",
        availability_reason: "Application deadline passed (2026-01-12)",
        availability_closed_at: "2026-01-13T00:00:00.000Z",
        status: "applied",
      },
      sourceClosed: {
        expires_at: "2026-01-12",
        posted_date: "2026-10-28",
        availability_status: "expired",
        availability_reason: "LinkedIn confirms this job is no longer accepting applications",
      },
    };
    expect(repairInvalidExpiryMetadata(seen)).toBe(true);
    expect(seen.applied).toEqual({ posted_date: "2026-10-28", availability_status: "active", status: "applied" });
    expect(seen.sourceClosed.availability_status).toBe("expired");
    expect(seen.sourceClosed.availability_reason).toContain("LinkedIn confirms");
    expect(seen.sourceClosed.expires_at).toBeUndefined();
  });

  test("treats a different explicit posting date as a new listing", () => {
    expect(isMateriallyDifferentListing(
      { posted_date: "2026-10-01", full_jd: "Existing description" },
      { postedDate: "2026-11-12", description: "Existing description" },
    )).toBe(true);
  });

  test("does not split a listing on short snippets or minor description edits", () => {
    expect(isMateriallyDifferentListing(
      { posted_date: "2026-11-12", full_jd: "A short job summary" },
      { postedDate: "2026-11-12", description: "A short job summary with extra detail" },
    )).toBe(false);
  });

  test("recognizes a substantive full job-description change", () => {
    const oldDescription = Array.from({ length: 90 }, (_, index) => `legacyrequirement${index}`).join(" ");
    const newDescription = Array.from({ length: 90 }, (_, index) => `newrequirement${index}`).join(" ");
    expect(isMateriallyDifferentListing(
      { posted_date: "2026-11-12", full_jd: oldDescription },
      { postedDate: "2026-11-12", description: newDescription },
    )).toBe(true);
  });

  test("generates stable, content-specific IDs for materially changed reposts", () => {
    const first = repostRecordId("li_123456", "2026-11-12", "Updated role description");
    expect(repostRecordId("li_123456", "2026-11-12", "Updated role description")).toBe(first);
    expect(repostRecordId("li_123456", "2026-11-12", "Different role description")).not.toBe(first);
  });
});
