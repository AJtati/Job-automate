import { describe, expect, test } from "bun:test";
import { AIService } from "../ai_service";
import type { CandidateProfile } from "../profiles_manager";

const sampleProfile: CandidateProfile = {
  id: "test-candidate",
  name: "Alex Taylor",
  headline: "Senior Platform Engineer",
  email: "alex@example.com",
  phone: "+44 7000 000000",
  location: "London, United Kingdom",
  postcode: "EC1A",
  linkedin: "",
  github: "",
  portfolio: "",
  visaSponsorshipRequired: false,
  targetRoles: ["Senior Platform Engineer", "DevOps Engineer"],
  targetLocations: ["Remote", "London"],
  preferredRadiusMiles: 50,
  minSalary: 75000,
  skills: {
    cloud: ["AWS", "GCP"],
    devops: ["Kubernetes (CKA)", "Terraform", "Docker"],
    languages: ["Python", "TypeScript"],
    tools: ["Git", "Jenkins", "Prometheus"]
  },
  experience: [],
  projects: [],
  education: [],
  certifications: [
    { name: "Certified Kubernetes Administrator (CKA)", issuer: "CNCF", year: "2024" },
    { name: "AWS Solutions Architect", issuer: "Amazon Web Services", year: "2023" }
  ],
  spokenLanguages: ["English"],
  profileVersion: 1
};

describe("Universal Prompt Scenario Engine", () => {
  const aiService = new AIService();

  test("removes specific certification when asked to remove or delete it", async () => {
    const outcome = await aiService.processScenario("remove cert cka", sampleProfile);
    expect(outcome.profileUpdates.certifications).toBeDefined();
    const remainingCerts = outcome.profileUpdates.certifications || [];
    expect(remainingCerts.some(c => c.name.includes("CKA"))).toBe(false);
    expect(remainingCerts.some(c => c.name.includes("AWS"))).toBe(true);
  });

  test("clears all certifications when user prompts 'remove all certs' or 'no certifications'", async () => {
    const outcome = await aiService.processScenario("remove all certifications", sampleProfile);
    expect(outcome.profileUpdates.certifications).toEqual([]);
  });

  test("adds certification when user prompts to add CKA without removal intent", async () => {
    const profileWithoutCerts: CandidateProfile = {
      ...sampleProfile,
      certifications: []
    };
    const outcome = await aiService.processScenario("Add CKA cert", profileWithoutCerts);
    expect(outcome.profileUpdates.certifications).toBeDefined();
    expect(outcome.profileUpdates.certifications?.length).toBe(1);
    expect(outcome.profileUpdates.certifications?.[0].name).toContain("Certified Kubernetes Administrator (CKA)");
  });

  test("detects job URLs and dispatches scrape_and_tailor action", async () => {
    const testUrl = "https://www.linkedin.com/jobs/view/4472952380";
    const outcome = await aiService.processScenario(`Scrape this job and tailor my resume: ${testUrl}`, sampleProfile);
    expect(outcome.action).toBe("scrape_and_tailor");
    expect(outcome.jobUrl).toBe(testUrl);
  });
});
