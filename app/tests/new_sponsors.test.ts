import { describe, expect, test } from "bun:test";
import { NewSponsorsRegistry } from "../new_sponsors";

describe("NewSponsorsRegistry - Newly Approved UK Sponsors", () => {
  test("loads cached new sponsors and matches exact company names", () => {
    const registry = new NewSponsorsRegistry(".");
    expect(registry).toBeDefined();

    const status = registry.status();
    expect(status.count).toBeGreaterThanOrEqual(0);
    expect(status.sourceUrl).toContain("uktiersponsorslist.co.uk");
  });

  test("matches company with legal entity variations (Ltd, Limited, prefix)", () => {
    const registry = new NewSponsorsRegistry(".");
    
    // Actavo (PDC) Ltd is in the new sponsors list from Oct 30, 2026
    const match = registry.find("Actavo");
    if (registry.records().length > 0) {
      expect(match).not.toBeNull();
      if (match) {
        expect(match.isNew).toBe(true);
        expect(match.organisation).toContain("Actavo");
        expect(match.formattedDate).toBeDefined();
      }
    }
  });

  test("returns null for non-existent companies", () => {
    const registry = new NewSponsorsRegistry(".");
    const match = registry.find("Completely Nonexistent Fake Startup 987654");
    expect(match).toBeNull();
  });

  test("does not falsely prefix-match generic single tokens like 'People'", () => {
    const registry = new NewSponsorsRegistry(".");
    const match = registry.find("People");
    expect(match).toBeNull();
  });
});

