import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { SearchConfigManager } from "../search_config";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

describe("search config storage", () => {
  test("removes retired The Muse settings from existing configs", () => {
    const root = mkdtempSync(join(tmpdir(), "search-config-muse-"));
    roots.push(root);
    const dataDir = join(root, "data");
    mkdirSync(dataDir, { recursive: true });
    const configPath = join(dataDir, "search_config.json");
    writeFileSync(configPath, JSON.stringify({ sources: { themuse: true, reed: true } }), "utf-8");

    const manager = new SearchConfigManager(root);
    expect(manager.get().sources).not.toHaveProperty("themuse");
    expect(manager.getPublic().sources).not.toHaveProperty("themuse");
    expect(JSON.parse(readFileSync(configPath, "utf-8")).sources).not.toHaveProperty("themuse");
    expect(manager.get().sources.reed).toBe(true);
    manager.save({ sources: { ...manager.get().sources, themuse: true } as any });
    expect(manager.get().sources).not.toHaveProperty("themuse");
  });

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
