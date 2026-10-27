import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { SearchConfigManager } from "../search_config";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

describe("search config storage", () => {
  test("persists provider choices while keeping API keys out of public responses", () => {
    const root = mkdtempSync(join(tmpdir(), "search-config-"));
    roots.push(root);
    const manager = new SearchConfigManager(root);
    manager.save({ sources: { ...manager.get().sources, linkedin: false, freehire: false, reed: true }, sponsorshipMode: "explicit", reedApiKey: "secret", adzunaAppId: "app-id", adzunaAppKey: "app-secret" });
    expect(manager.getPublic()).toMatchObject({ sponsorshipMode: "explicit", hasReedKey: true, hasAdzunaCredentials: true, sources: { linkedin: true, freehire: true, reed: true } });
    expect(JSON.stringify(manager.getPublic())).not.toContain("secret");
    expect(new SearchConfigManager(root).get().reedApiKey).toBe("secret");
  });
});
