import { describe, expect, test } from "bun:test";
import { analyzeApplication, buildGroundedSummary } from "../application_engine";
import type { CandidateProfile } from "../profiles_manager";

const profile: CandidateProfile = {
  id: "sam", name: "Sam Lee", headline: "Platform Engineer", email: "sam@example.com", phone: "", location: "London", postcode: "", linkedin: "", github: "",
  visaSponsorshipRequired: true, targetRoles: ["Senior Platform Engineer"], targetLocations: ["London", "Remote"], preferredRadiusMiles: 30, minSalary: 0,
  skills: { cloud: ["AWS"], devops: ["Kubernetes", "Terraform", "GitHub Actions"], languages: ["Python"], tools: ["Prometheus"] },
  experience: [{ company: "Acme", role: "Platform Engineer", location: "London", startDate: "2022", endDate: "Present", bullets: ["Built AWS Kubernetes clusters with Terraform.", "Wrote GitHub Actions deployment pipelines and Prometheus alerts."] }],
  education: [], certifications: [], spokenLanguages: ["English"]
};

describe("application evidence scoring", () => {
  test("scores only supported requirements and exposes gaps", () => {
    const result = analyzeApplication(profile, { company: "Example", role: "Senior Platform Engineer", location: "London", fullJd: "We require AWS, Kubernetes, Terraform, Python and Datadog. You will collaborate with product teams and own CI/CD.", keySkills: [] });
    expect(result.matchedKeywords).toContain("AWS");
    expect(result.matchedKeywords).toContain("Kubernetes");
    expect(result.gapKeywords).toContain("Datadog");
    expect(result.requirements.find(item => item.requirement === "Datadog")?.evidence).toEqual([]);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.provenance).toContain("Deterministic");
  });

  test("fails a hard citizenship gate for a sponsorship-dependent candidate", () => {
    const result = analyzeApplication(profile, { company: "Secure", role: "Platform Engineer", location: "London", fullJd: "Applicants must be a UK citizen. AWS experience required." });
    expect(result.gates.eligibility.verdict).toBe("FAIL");
  });

  test("does not inflate score from location", () => {
    const base = { company: "Example", role: "Platform Engineer", fullJd: "AWS and Kubernetes required." };
    const local = analyzeApplication(profile, { ...base, location: "London" });
    const distant = analyzeApplication(profile, { ...base, location: "Bristol" });
    expect(local.overallScore).toBe(distant.overallScore);
    expect(local.gates.location.verdict).toBe("PASS");
    expect(distant.gates.location.verdict).toBe("FLAG");
  });

  test("does not match short aliases inside unrelated words or add generic summary claims", () => {
    const job = { company: "Orbit", role: "Platform Engineer", location: "London", fullJd: "Maintain reliable AWS infrastructure with Terraform." };
    const analysis = analyzeApplication(profile, job);
    expect(analysis.matchedKeywords).not.toContain("Machine Learning");
    const summary = buildGroundedSummary(profile, job, analysis);
    expect(summary).not.toMatch(/proven|scalable systems|best engineering practices/i);
  });

  test("strictly penalizes cross-domain role mismatches between Dynamics and DevOps", () => {
    const dynamicsProfile: CandidateProfile = {
      id: "manju", name: "Manjubhargavi", headline: "Senior Dynamics 365 CRM & Power Platform Developer",
      email: "manju@example.com", phone: "", location: "Middlesbrough, UK", postcode: "", linkedin: "", github: "",
      visaSponsorshipRequired: false, targetRoles: ["Senior Dynamics Developer", "Power Platform Developer"],
      targetLocations: ["Remote", "Middlesbrough, UK"], preferredRadiusMiles: 40, minSalary: 0,
      skills: {
        "Dynamics 365": ["Microsoft Dynamics 365", "Dataverse", "C# Plugins", "Workflows"],
        "Power Platform": ["Power Apps", "Power Automate", "Power BI"],
        "Development": [".NET", "C#", "JavaScript", "SQL Server"]
      },
      experience: [{
        company: "SeatPe", role: "Senior Dynamics Developer", location: "Middlesbrough, UK", startDate: "2024", endDate: "Present",
        bullets: ["Developed custom Power Apps and automated flows in Dataverse.", "Wrote C# plugins and REST integrations for Dynamics 365."]
      }],
      education: [], certifications: [], spokenLanguages: ["English"]
    };

    const devopsJob = {
      company: "Synextra",
      role: "Senior Platform Engineer (DevOps)",
      location: "Birchwood",
      fullJd: "Looking for a Senior Platform Engineer with Azure, CI/CD, Terraform, Kubernetes, and C# experience.",
      keySkills: ["Azure", "Kubernetes", "Terraform", "CI/CD"]
    };

    const dynamicsJob = {
      company: "Avanade",
      role: "Senior Dynamics 365 CE Developer",
      location: "Remote",
      fullJd: "Seeking a Senior Dynamics 365 CE Developer to build Dataverse solutions, Power Apps, and custom C# plugins.",
      keySkills: ["Dynamics 365", "Power Platform", "Dataverse", "C#"]
    };

    // Dynamics candidate on DevOps role must be heavily penalized
    const devopsAnalysis = analyzeApplication(dynamicsProfile, devopsJob);
    expect(devopsAnalysis.overallScore).toBeLessThanOrEqual(25);
    expect(devopsAnalysis.verdict).toBe("Poor fit");
    expect(devopsAnalysis.dimensions.career.score).toBe(0);
    expect(devopsAnalysis.dimensions.career.note).toContain("Incompatible domain");

    // Dynamics candidate on Dynamics role must be high fit
    const dynamicsAnalysis = analyzeApplication(dynamicsProfile, dynamicsJob);
    expect(dynamicsAnalysis.overallScore).toBeGreaterThanOrEqual(75);
    expect(dynamicsAnalysis.verdict).toBe("Strong fit");

    // DevOps candidate (profile) on Dynamics role must be heavily penalized
    const devopsOnDynamics = analyzeApplication(profile, dynamicsJob);
    expect(devopsOnDynamics.overallScore).toBeLessThanOrEqual(25);
    expect(devopsOnDynamics.verdict).toBe("Poor fit");
    expect(devopsOnDynamics.dimensions.career.score).toBe(0);
    expect(devopsOnDynamics.dimensions.career.note).toContain("Incompatible domain");
  });

  test("accurately curates and scores non-tech candidates (e.g. nurse, accountant) for their respective jobs", () => {
    const nurseProfile: CandidateProfile = {
      id: "sarah-nurse", name: "Sarah Connor", headline: "Registered General Nurse",
      email: "sarah@example.com", phone: "", location: "Manchester, UK", postcode: "M1", linkedin: "", github: "",
      visaSponsorshipRequired: false, targetRoles: ["Staff Nurse", "Senior Staff Nurse"],
      targetLocations: ["Manchester, UK"], preferredRadiusMiles: 25, minSalary: 0,
      skills: {
        "Clinical": ["Patient Care", "Acute Triage", "IV Cannulation", "Wound Management"],
        "Certifications": ["BLS", "ACLS"]
      },
      experience: [{
        company: "Manchester Royal Infirmary", role: "Staff Nurse", location: "Manchester, UK", startDate: "2018", endDate: "Present",
        bullets: ["Provided acute patient care in emergency triage and medical assessment unit.", "Administered IV cannulation and wound management according to NMC guidelines."]
      }],
      education: [], certifications: [], spokenLanguages: ["English"]
    };

    const nurseJob = {
      company: "NHS Trust",
      role: "Staff Nurse - Acute Medicine",
      location: "Manchester",
      fullJd: "We are recruiting a dedicated Staff Nurse. Must have valid NMC PIN. Key responsibilities include patient care, acute triage, IV cannulation, and wound management. BLS certification required.",
      keySkills: ["Patient Care", "Triage", "BLS"]
    };

    const accountingJob = {
      company: "Deloitte",
      role: "Senior Financial Auditor",
      location: "Manchester",
      fullJd: "Seeking a Senior Financial Auditor with IFRS, financial reporting, and statutory auditing experience.",
      keySkills: ["Auditing", "IFRS"]
    };

    // Nurse on Nurse job must be a strong fit
    const nurseAnalysis = analyzeApplication(nurseProfile, nurseJob);
    expect(nurseAnalysis.overallScore).toBeGreaterThanOrEqual(75);
    expect(nurseAnalysis.verdict).toBe("Strong fit");
    expect(nurseAnalysis.matchedKeywords).toContain("Patient Care");

    // Nurse on Accounting job must be poor fit / incompatible
    const nurseOnFinance = analyzeApplication(nurseProfile, accountingJob);
    expect(nurseOnFinance.overallScore).toBeLessThanOrEqual(30);
    expect(nurseOnFinance.verdict).toMatch(/Poor fit|Weak fit/);
  });
});
