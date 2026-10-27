import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ProfilesManager, type CandidateProfile } from "../profiles_manager";

const roots: string[] = [];
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

describe("uploaded resume persistence", () => {
  test("stores source text, fingerprint metadata, and LaTeX backbone in the local profile file", () => {
    const root = mkdtempSync(join(tmpdir(), "job-search-profile-test-"));
    roots.push(root);
    const manager = new ProfilesManager(root);
    const profile: CandidateProfile = {
      id: "jordan", name: "Jordan Patel", headline: "Platform Engineer", email: "jordan@example.com", phone: "", location: "London", postcode: "", linkedin: "", github: "", visaSponsorshipRequired: false,
      targetRoles: ["Platform Engineer"], targetLocations: ["London"], preferredRadiusMiles: 30, minSalary: 0,
      skills: { cloud: ["AWS"], devops: ["Kubernetes"], languages: [], tools: [] }, experience: [], education: [], certifications: [],
      latexBackbone: "\\documentclass{article}\n%%WORK_EXPERIENCE%%", profileVersion: 1,
      sourceResume: { fileName: "resume.pdf", mediaType: "application/pdf", importedAt: "2026-10-26T00:00:00.000Z", sha256: "abc123", text: "Jordan Patel resume source" }
    };
    manager.saveProfile(profile);
    manager.setActiveProfile(profile.id);
    const stored = JSON.parse(readFileSync(join(root, "data", "profiles.json"), "utf-8"));
    const saved = stored.profiles.find((item: CandidateProfile) => item.id === "jordan");
    expect(saved.sourceResume.text).toBe("Jordan Patel resume source");
    expect(saved.sourceResume.sha256).toBe("abc123");
    expect(saved.latexBackbone).toContain("%%WORK_EXPERIENCE%%");
    expect(saved.spokenLanguages).toEqual([]);
    expect(saved.skills.containers).toEqual([]);
    expect(stored.activeProfileId).toBe("jordan");
  });

  test("preserves an unreadable profile file and exposes a recovery warning", () => {
    const root = mkdtempSync(join(tmpdir(), "profile-recovery-test-"));
    try {
      mkdirSync(join(root, "data"), { recursive: true });
      writeFileSync(join(root, "data", "profiles.json"), "{not valid json", "utf-8");
      const manager = new ProfilesManager(root);
      const recovery = readdirSync(join(root, "data")).find(name => name.startsWith("profiles.corrupt-"));

      expect(recovery).toBeTruthy();
      expect(existsSync(join(root, "data", recovery!))).toBe(true);
      expect(readFileSync(join(root, "data", recovery!), "utf-8")).toBe("{not valid json");
      expect(manager.getLoadWarning()).toContain("preserved at");
      expect(manager.getActiveProfile().id).toBe("candidate-profile");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
