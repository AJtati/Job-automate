import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ProfilesManager, type CandidateProfile, splitSkillsList, groupManualSkills } from "../profiles_manager";

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

  test("seeds an empty data directory from the installed app profile template", () => {
    const appRoot = mkdtempSync(join(tmpdir(), "profile-app-seed-test-"));
    const dataRoot = mkdtempSync(join(tmpdir(), "profile-data-seed-test-"));
    roots.push(appRoot, dataRoot);
    mkdirSync(join(appRoot, "data"), { recursive: true });
    const seededProfile: CandidateProfile = {
      id: "seeded-candidate",
      name: "Seeded Candidate",
      headline: "Platform Engineer",
      email: "candidate@example.com",
      phone: "",
      location: "",
      postcode: "",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: [],
      targetLocations: [],
      preferredRadiusMiles: 30,
      minSalary: 0,
      skills: { cloud: [], devops: [], languages: [], tools: [] },
      experience: [],
      education: [],
      certifications: []
    };
    writeFileSync(join(appRoot, "data", "profiles.json"), JSON.stringify({
      activeProfileId: seededProfile.id,
      profiles: [seededProfile]
    }), "utf-8");

    const previousAppRoot = process.env.AI_JOB_SEARCH_APP_ROOT;
    process.env.AI_JOB_SEARCH_APP_ROOT = appRoot;
    try {
      const manager = new ProfilesManager(dataRoot);
      expect(manager.getActiveProfile().id).toBe("seeded-candidate");
      const saved = JSON.parse(readFileSync(join(dataRoot, "data", "profiles.json"), "utf-8"));
      expect(saved.profiles[0].name).toBe("Seeded Candidate");
    } finally {
      if (previousAppRoot === undefined) delete process.env.AI_JOB_SEARCH_APP_ROOT;
      else process.env.AI_JOB_SEARCH_APP_ROOT = previousAppRoot;
    }
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
      id: "devops-candidate", name: "Alex Taylor", headline: "DevOps Engineer", email: "alex@example.com", phone: "", location: "Leeds", postcode: "LS1", linkedin: "", github: "", visaSponsorshipRequired: true,
      targetRoles: ["Lead DevOps Engineer", "Platform Engineer"], targetLocations: ["Remote", "Leeds"], preferredRadiusMiles: 50, minSalary: 60000,
      skills: { cloud: ["AWS"], devops: ["Kubernetes", "Terraform"], languages: ["Python"], tools: [] }, experience: [], education: [], certifications: [], profileVersion: 1
    };

    const dynamicsProfile: CandidateProfile = {
      id: "dynamics-candidate", name: "Jordan Patel", headline: "Senior Dynamics Developer", email: "jordan@example.com", phone: "", location: "Manchester", postcode: "M1", linkedin: "", github: "", visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer", "Power Platform Developer"], targetLocations: ["Remote", "Manchester"], preferredRadiusMiles: 50, minSalary: 65000,
      skills: { cloud: ["Azure"], devops: [], languages: ["C#", ".NET"], tools: ["Dynamics 365", "Power Apps"] }, experience: [], education: [], certifications: [], profileVersion: 1
    };

    manager.saveProfile(devopsProfile);
    manager.saveProfile(dynamicsProfile);

    const stored = manager.getAll().profiles;
    expect(stored.length).toBeGreaterThanOrEqual(2);

    const p1 = stored.find(p => p.id === "devops-candidate");
    const p2 = stored.find(p => p.id === "dynamics-candidate");

    expect(p1?.name).toBe("Alex Taylor");
    expect(p1?.location).toBe("Leeds");
    expect(p1?.headline).toBe("DevOps Engineer");

    expect(p2?.name).toBe("Jordan Patel");
    expect(p2?.location).toBe("Manchester");
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
      expect(match?.minSalary).toBe(0);
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

    // Profile 1: Jordan - Dynamics Track
    const profileDynamics = {
      id: "jordan-patel-dynamics",
      name: "Jordan Patel",
      headline: "Senior Dynamics 365 Developer",
      email: "jordan.patel@example.com",
      phone: "+44 7700 900456",
      location: "Manchester, UK",
      postcode: "M1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer", "Power Platform Developer"],
      targetLocations: ["Remote", "Manchester, UK"],
      preferredRadiusMiles: 40,
      minSalary: 75000,
      skills: { "Dynamics": ["Dynamics 365", "Power Apps", "Dataverse"] },
      experience: [], education: [], certifications: [], spokenLanguages: ["English"],
      tracker: { "job_dyn_1": { status: "drafted" } }
    };

    // Profile 2: Jordan - DevOps Track (same person, different track)
    const profileDevops = {
      id: "jordan-patel-devops",
      name: "Jordan Patel",
      headline: "DevOps Engineer / Cloud Engineer",
      email: "jordan.patel@example.com",
      phone: "+44 7700 900456",
      location: "Manchester, UK",
      postcode: "M1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["DevOps Engineer", "Platform Engineer", "Cloud Engineer"],
      targetLocations: ["Remote", "Manchester, UK", "Leeds, UK"],
      preferredRadiusMiles: 50,
      minSalary: 80000,
      skills: { "DevOps": ["Azure DevOps", "Kubernetes", "Terraform", "CI/CD"] },
      experience: [], education: [], certifications: [], spokenLanguages: ["English"],
      tracker: { "job_devops_1": { status: "applied" } }
    };

    manager.saveProfile(profileDynamics);
    manager.saveProfile(profileDevops);

    const all = manager.getAll().profiles;
    const dynamicsMatch = all.find(p => p.id === "jordan-patel-dynamics");
    const devopsMatch = all.find(p => p.id === "jordan-patel-devops");

    // Both profiles must exist simultaneously
    expect(dynamicsMatch).toBeDefined();
    expect(devopsMatch).toBeDefined();

    // Verify both have the same candidate name but different tracks and target roles
    expect(dynamicsMatch?.name).toBe("Jordan Patel");
    expect(devopsMatch?.name).toBe("Jordan Patel");
    expect(dynamicsMatch?.headline).toBe("Senior Dynamics 365 Developer");
    expect(devopsMatch?.headline).toBe("DevOps Engineer / Cloud Engineer");

    // Verify trackers are independent
    expect(dynamicsMatch?.tracker?.["job_dyn_1"]?.status).toBe("drafted");
    expect(dynamicsMatch?.tracker?.["job_devops_1"]).toBeUndefined();
    expect(devopsMatch?.tracker?.["job_devops_1"]?.status).toBe("applied");
    expect(devopsMatch?.tracker?.["job_dyn_1"]).toBeUndefined();
  });

  test("splitSkillsList parses comma-separated skills while respecting nested parentheses", () => {
    const raw = "AWS (EKS, EC2, S3), GCP, Azure, Kubernetes (EKS v1.26--v1.31), Docker, PagerDuty (On-call)";
    const split = splitSkillsList(raw);
    expect(split).toEqual([
      "AWS (EKS, EC2, S3)",
      "GCP",
      "Azure",
      "Kubernetes (EKS v1.26--v1.31)",
      "Docker",
      "PagerDuty (On-call)"
    ]);
  });

  test("groupManualSkills prunes removed skills and does not revert deleted items", () => {
    const baseSkills = {
      cloud: ["AWS", "GCP", "Azure"],
      containers: ["Kubernetes (EKS v1.26--v1.31)", "Docker", "Helm"],
      devops: ["Kubernetes (EKS v1.26--v1.31)", "Docker"],
      monitoring: ["Prometheus", "Zabbix", "Splunk"]
    };

    // User removes "Kubernetes (EKS v1.26--v1.31)" and "Zabbix"
    const rawSkills = ["AWS", "GCP", "Azure", "Docker", "Helm", "Prometheus", "Splunk"];

    const updated = groupManualSkills(rawSkills, baseSkills);

    expect(updated.containers).not.toContain("Kubernetes (EKS v1.26--v1.31)");
    expect(updated.devops).not.toContain("Kubernetes (EKS v1.26--v1.31)");
    expect(updated.monitoring).not.toContain("Zabbix");

    expect(updated.containers).toContain("Docker");
    expect(updated.containers).toContain("Helm");
    expect(updated.monitoring).toContain("Prometheus");
    expect(updated.monitoring).toContain("Splunk");
  });

  test("groupManualSkills updates modified skills without leaving old versions behind", () => {
    const baseSkills = {
      containers: ["Kubernetes (EKS v1.26--v1.31)", "Docker"],
      devops: ["Kubernetes (EKS v1.26--v1.31)"]
    };

    // User changes "Kubernetes (EKS v1.26--v1.31)" to "Kubernetes"
    const rawSkills = ["Kubernetes", "Docker"];

    const updated = groupManualSkills(rawSkills, baseSkills);

    expect(updated.containers).not.toContain("Kubernetes (EKS v1.26--v1.31)");
    expect(updated.devops).not.toContain("Kubernetes (EKS v1.26--v1.31)");
    expect(updated.containers).toContain("Kubernetes");
    expect(updated.containers).toContain("Docker");
  });

  test("persists excludeSecurityClearance preference across profile save and load", () => {
    const root = mkdtempSync(join(tmpdir(), "profile-sc-test-"));
    roots.push(root);
    const manager = new ProfilesManager(root);
    const profile: CandidateProfile = {
      id: "candidate-sc",
      name: "Morgan Taylor",
      headline: "DevOps Engineer",
      email: "morgan@example.com",
      phone: "",
      location: "London, UK",
      postcode: "EC1A 1BB",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: true,
      excludeSecurityClearance: true,
      targetRoles: ["DevOps Engineer"],
      targetLocations: ["Remote", "London", "Hybrid"],
      preferredRadiusMiles: 50,
      minSalary: 60000,
      skills: { cloud: ["AWS"], devops: ["Docker"] },
      experience: [],
      education: [],
      certifications: [],
      profileVersion: 1
    };

    manager.saveProfile(profile);
    const loaded = manager.getProfile("candidate-sc");
    expect(loaded).toBeDefined();
    expect(loaded?.excludeSecurityClearance).toBe(true);

    // Update to false
    manager.saveProfile({ ...profile, excludeSecurityClearance: false });
    const updated = manager.getProfile("candidate-sc");
    expect(updated?.excludeSecurityClearance).toBe(false);
  });
});

describe("Feed sorting and filtering algorithms", () => {
  const isHybrid = (loc: string, title: string, jd: string) => {
    return /hybrid/i.test(loc) ||
           /hybrid/i.test(title) ||
           /\b(?:hybrid\s+work|hybrid\s+model|hybrid\s+working|flexible\s+hybrid|days?\s+(?:a|per)\s+week\s+(?:in|at)\s+(?:the\s+)?office|days?\s+(?:in|at)\s+the\s+office|hybrid\s+role|hybrid\s+basis|hybrid\s+contract|\d+\s+days?\s+(?:remote|office))\b/i.test(jd);
  };

  const isScClearance = (title: string, jd: string) => {
    return /\b(?:active\s+sc|must\s+hold\s+sc|sc\s+cleared|sc\s+clearance|security\s+cleared|dv\s+cleared|dv\s+clearance|security\s+check\s+clearance|mod\s+clearance|must\s+be\s+sc|hold\s+active\s+sc|obtain\s+sc\s+clearance|requires?\s+sc\s+clearance|eligib(?:le|ility)\s+for\s+sc|sc\s+status|bpss\s+and\s+sc)\b/i.test(title) ||
           /\b(?:active\s+sc|must\s+hold\s+sc|sc\s+cleared|sc\s+clearance|security\s+cleared|dv\s+cleared|dv\s+clearance|security\s+check\s+clearance|mod\s+clearance|must\s+be\s+sc|hold\s+active\s+sc|obtain\s+sc\s+clearance|requires?\s+sc\s+clearance)\b/i.test(jd);
  };

  test("accurately flags hybrid positions from location, title, or job description", () => {
    expect(isHybrid("Leeds (Hybrid)", "Platform Engineer", "")).toBe(true);
    expect(isHybrid("London", "Senior DevOps Engineer (Hybrid)", "")).toBe(true);
    expect(isHybrid("Manchester", "Cloud Architect", "This role offers 2 days a week in the office.")).toBe(true);
    expect(isHybrid("Bristol", "Site Reliability Engineer", "We operate a flexible hybrid working model.")).toBe(true);
    expect(isHybrid("London", "Backend Engineer", "Fully onsite 5 days a week")).toBe(false);
  });

  test("accurately flags mandatory security clearance positions", () => {
    expect(isScClearance("DevOps Engineer (Active SC Required)", "Cloud role in defense")).toBe(true);
    expect(isScClearance("Platform Engineer", "Candidates must hold valid SC clearance prior to onboarding")).toBe(true);
    expect(isScClearance("Cloud Architect", "Active DV cleared or SC cleared required.")).toBe(true);
    expect(isScClearance("Software Engineer", "Standard background checks only. No security clearance.")).toBe(false);
  });

  test("days-wise sort places newest calendar day first, and ranks highest percentage first on the same day", () => {
    const jobs = [
      { id: "1", posted_date: "2026-11-06", fit_score: 45, title: "Role A" },
      { id: "2", posted_date: "2026-11-07", fit_score: 60, title: "Role B" },
      { id: "3", posted_date: "2026-11-07", fit_score: 85, title: "Role C" },
      { id: "4", posted_date: "2026-11-05", fit_score: 95, title: "Role D" },
      { id: "5", posted_date: "2026-11-07", fit_score: 72, title: "Role E" }
    ];

    const sorted = [...jobs].sort((a, b) => {
      const dayA = a.posted_date.slice(0, 10);
      const dayB = b.posted_date.slice(0, 10);
      if (dayB !== dayA) return dayB.localeCompare(dayA);
      return (b.fit_score || 0) - (a.fit_score || 0);
    });

    // 2026-11-07 jobs come first, ordered 85% -> 72% -> 60%
    expect(sorted[0].id).toBe("3"); // 85%
    expect(sorted[1].id).toBe("5"); // 72%
    expect(sorted[2].id).toBe("2"); // 60%
    // Then 2026-11-06
    expect(sorted[3].id).toBe("1"); // 45%
    // Then 2026-11-05
    expect(sorted[4].id).toBe("4"); // 95%
  });

  test("score-wise sort ranks highest match percentage first with newest posting as tie-breaker", () => {
    const jobs = [
      { id: "1", posted_date: "2026-11-05", fit_score: 80 },
      { id: "2", posted_date: "2026-11-07", fit_score: 80 },
      { id: "3", posted_date: "2026-11-06", fit_score: 90 },
      { id: "4", posted_date: "2026-11-01", fit_score: 70 }
    ];

    const sorted = [...jobs].sort((a, b) => {
      const scoreDiff = (b.fit_score || 0) - (a.fit_score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.posted_date.localeCompare(a.posted_date);
    });

    expect(sorted[0].id).toBe("3"); // 90%
    expect(sorted[1].id).toBe("2"); // 80% (posted Nov 7)
    expect(sorted[2].id).toBe("1"); // 80% (posted Nov 5)
    expect(sorted[3].id).toBe("4"); // 70%
  });
});
