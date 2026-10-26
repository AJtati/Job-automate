import { describe, expect, test } from "bun:test";
import { analyzeApplication } from "../application_engine";
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
});
