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

  test("supports multiple distinct profiles without cross-profile contamination", () => {
    const root = mkdtempSync(join(tmpdir(), "multi-profile-test-"));
    roots.push(root);
    const manager = new ProfilesManager(root);

    const devopsProfile: CandidateProfile = {
      id: "ajith", name: "Ajith Surya", headline: "DevOps Engineer", email: "ajith@example.com", phone: "", location: "Hartlepool", postcode: "TS25", linkedin: "", github: "", visaSponsorshipRequired: true,
      targetRoles: ["Lead DevOps Engineer", "Platform Engineer"], targetLocations: ["Remote", "Hartlepool"], preferredRadiusMiles: 50, minSalary: 60000,
      skills: { cloud: ["AWS"], devops: ["Kubernetes", "Terraform"], languages: ["Python"], tools: [] }, experience: [], education: [], certifications: [], profileVersion: 1
    };

    const dynamicsProfile: CandidateProfile = {
      id: "manju", name: "Manjubhargavi", headline: "Senior Dynamics Developer", email: "manju@example.com", phone: "", location: "Middlesbrough", postcode: "TS1", linkedin: "", github: "", visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer", "Power Platform Developer"], targetLocations: ["Remote", "Middlesbrough"], preferredRadiusMiles: 50, minSalary: 65000,
      skills: { cloud: ["Azure"], devops: [], languages: ["C#", ".NET"], tools: ["Dynamics 365", "Power Apps"] }, experience: [], education: [], certifications: [], profileVersion: 1
    };

    manager.saveProfile(devopsProfile);
    manager.saveProfile(dynamicsProfile);

    const stored = manager.getAll().profiles;
    expect(stored.length).toBeGreaterThanOrEqual(2);

    const p1 = stored.find(p => p.id === "ajith");
    const p2 = stored.find(p => p.id === "manju");

    expect(p1?.name).toBe("Ajith Surya");
    expect(p1?.location).toBe("Hartlepool");
    expect(p1?.headline).toBe("DevOps Engineer");

    expect(p2?.name).toBe("Manjubhargavi");
    expect(p2?.location).toBe("Middlesbrough");
    expect(p2?.headline).toBe("Senior Dynamics Developer");
  });

  test("scales to arbitrary N profiles with strictly isolated trackers, locations, and roles", () => {
    const dir = mkdtempSync(join(tmpdir(), "multi-profile-isolation-"));
    const manager = new ProfilesManager(dir);

    const candidates = [
      { id: "devops-lead", name: "DevOps Candidate", headline: "Lead DevOps Engineer", location: "Manchester", targetRoles: ["DevOps Engineer", "Platform Engineer"] },
      { id: "dynamics-dev", name: "Dynamics Candidate", headline: "Senior Dynamics 365 Developer", location: "Middlesbrough", targetRoles: ["Dynamics 365 Developer", "Power Platform Consultant"] },
      { id: "frontend-dev", name: "Frontend Candidate", headline: "Senior React / Frontend Developer", location: "London", targetRoles: ["Frontend Engineer", "React Developer"] },
      { id: "data-scientist", name: "Data Candidate", headline: "Staff Data Scientist", location: "Cambridge", targetRoles: ["Data Scientist", "Machine Learning Engineer"] },
      { id: "qa-lead", name: "QA Candidate", headline: "Lead QA Automation Engineer", location: "Leeds", targetRoles: ["QA Engineer", "SDET"] },
    ];

    for (const c of candidates) {
      manager.saveProfile({
        id: c.id,
        name: c.name,
        headline: c.headline,
        email: `${c.id}@example.com`,
        phone: "",
        location: c.location,
        postcode: "",
        linkedin: "",
        github: "",
        visaSponsorshipRequired: false,
        targetRoles: c.targetRoles,
        targetLocations: [c.location, "Remote"],
        preferredRadiusMiles: 30,
        minSalary: 0,
        skills: {},
        experience: [],
        education: [],
        certifications: [],
        spokenLanguages: ["English"],
        tracker: {
          [`custom_job_${c.id}`]: { status: "drafted", fitRating: "95", role: c.targetRoles[0] }
        }
      });
    }

    const all = manager.getAll().profiles;
    expect(all.length).toBeGreaterThanOrEqual(5);

    // Verify each profile is completely isolated
    for (const c of candidates) {
      const match = all.find(p => p.id === c.id);
      expect(match).toBeDefined();
      expect(match?.name).toBe(c.name);
      expect(match?.headline).toBe(c.headline);
      expect(match?.location).toBe(c.location);
      expect(match?.targetRoles).toEqual(c.targetRoles);
      // Verify tracker only contains this profile's jobs
      expect(match?.tracker?.[`custom_job_${c.id}`]?.status).toBe("drafted");
      // Must NOT contain other profiles' tracker keys
      for (const other of candidates.filter(o => o.id !== c.id)) {
        expect(match?.tracker?.[`custom_job_${other.id}`]).toBeUndefined();
      }
    }
  });

  test("allows the same candidate to hold multiple distinct profiles for different career tracks", () => {
    const dir = mkdtempSync(join(tmpdir(), "same-person-multi-profile-"));
    const manager = new ProfilesManager(dir);

    // Profile 1: Manjubhargavi - Dynamics Track
    const profileDynamics = {
      id: "manjubhargavi-cherupally-dynamics",
      name: "Manjubhargavi Cherupally",
      headline: "Senior Dynamics 365 Developer",
      email: "manju@example.com",
      phone: "+44 7774 483588",
      location: "Middlesbrough, UK",
      postcode: "TS1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer", "Power Platform Developer"],
      targetLocations: ["Remote", "Middlesbrough, UK"],
      preferredRadiusMiles: 40,
      minSalary: 75000,
      skills: { "Dynamics": ["Dynamics 365", "Power Apps", "Dataverse"] },
      experience: [], education: [], certifications: [], spokenLanguages: ["English"],
      tracker: { "job_dyn_1": { status: "drafted" } }
    };

    // Profile 2: Manjubhargavi - DevOps Track (same person, different track)
    const profileDevops = {
      id: "manjubhargavi-cherupally-devops",
      name: "Manjubhargavi Cherupally",
      headline: "DevOps Engineer / Cloud Engineer",
      email: "manju@example.com",
      phone: "+44 7774 483588",
      location: "Middlesbrough, UK",
      postcode: "TS1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["DevOps Engineer", "Platform Engineer", "Cloud Engineer"],
      targetLocations: ["Remote", "Middlesbrough, UK", "Manchester, UK"],
      preferredRadiusMiles: 50,
      minSalary: 80000,
      skills: { "DevOps": ["Azure DevOps", "Kubernetes", "Terraform", "CI/CD"] },
      experience: [], education: [], certifications: [], spokenLanguages: ["English"],
      tracker: { "job_devops_1": { status: "applied" } }
    };

    manager.saveProfile(profileDynamics);
    manager.saveProfile(profileDevops);

    const all = manager.getAll().profiles;
    const dynamicsMatch = all.find(p => p.id === "manjubhargavi-cherupally-dynamics");
    const devopsMatch = all.find(p => p.id === "manjubhargavi-cherupally-devops");

    // Both profiles must exist simultaneously
    expect(dynamicsMatch).toBeDefined();
    expect(devopsMatch).toBeDefined();

    // Verify both have the same candidate name but different tracks and target roles
    expect(dynamicsMatch?.name).toBe("Manjubhargavi Cherupally");
    expect(devopsMatch?.name).toBe("Manjubhargavi Cherupally");
    expect(dynamicsMatch?.headline).toBe("Senior Dynamics 365 Developer");
    expect(devopsMatch?.headline).toBe("DevOps Engineer / Cloud Engineer");

    // Verify trackers are independent
    expect(dynamicsMatch?.tracker?.["job_dyn_1"]?.status).toBe("drafted");
    expect(dynamicsMatch?.tracker?.["job_devops_1"]).toBeUndefined();
    expect(devopsMatch?.tracker?.["job_devops_1"]?.status).toBe("applied");
    expect(devopsMatch?.tracker?.["job_dyn_1"]).toBeUndefined();
  });
});
