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
  const aiService = new AIService({ provider: "builtin" });

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

  test("removing a skill does not silently remove a related certification", async () => {
    const outcome = await aiService.processScenario("remove Kubernetes skill", sampleProfile);
    expect(outcome.profileUpdates.certifications).toBeUndefined();
    expect(outcome.profileUpdates.skills?.devops).not.toContain("Kubernetes (CKA)");
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

  test("does not add a certification from a passive CKA mention", async () => {
    const outcome = await aiService.processScenario("focus on CKA roles", { ...sampleProfile, certifications: [] });
    expect(outcome.profileUpdates.certifications).toBeUndefined();
  });

  test("detects job URLs and dispatches scrape_and_tailor action", async () => {
    const testUrl = "https://www.linkedin.com/jobs/view/4472952380";
    const outcome = await aiService.processScenario(`Scrape this job and tailor my resume: ${testUrl}`, sampleProfile);
    expect(outcome.action).toBe("scrape_and_tailor");
    expect(outcome.jobUrl).toBe(testUrl);
  });

  test("dispatches an explicit role search without mutating the candidate profile", async () => {
    const outcome = await aiService.processScenario("Search for Java backend roles in Manchester", sampleProfile);
    expect(outcome.action).toBe("search_jobs");
    expect(outcome.feedFilters?.query).toContain("Java backend");
    expect(outcome.feedFilters?.location).toBe("Manchester");
    expect(outcome.profileUpdates).toEqual({});
  });

  test("separates role, location, and salary in a specific search", async () => {
    const outcome = await aiService.processScenario("Find Java developer jobs near Leeds paying £90k", sampleProfile);
    expect(outcome.action).toBe("search_jobs");
    expect(outcome.feedFilters).toEqual({ query: "Java developer", location: "Leeds", minSalary: 90000 });
    expect(outcome.profileUpdates).toEqual({});
  });

  test("requests only vacancies that explicitly state sponsorship", async () => {
    const outcome = await aiService.processScenario("Search for Java roles in Manchester with visa sponsorship offered", sampleProfile);
    expect(outcome.action).toBe("search_jobs");
    expect(outcome.feedFilters?.sponsorshipMode).toBe("explicit");
    expect(outcome.feedFilters?.query).toBe("Java");
  });

  test("can search licensed sponsor employers without claiming the vacancy sponsors", async () => {
    const outcome = await aiService.processScenario("Find platform roles from licensed employers", sampleProfile);
    expect(outcome.feedFilters?.sponsorshipMode).toBe("licensed");
  });

  test("filters a named city without rewriting the candidate home address", async () => {
    const outcome = await aiService.processScenario("focus on roles near Manchester", sampleProfile);
    expect(outcome.feedFilters?.location).toBe("Manchester");
    expect(outcome.profileUpdates.location).toBeUndefined();
  });

  test("routes an open-job resume refinement to the application editor", async () => {
    const outcome = await aiService.processScenario("Emphasize Kubernetes in this resume", sampleProfile, { jobId: "job-123", currentTab: "tab-cv" });
    expect(outcome.action).toBe("edit_application");
    expect(outcome.documentEdit).toEqual({ kind: "cv", mode: "emphasize", term: "Kubernetes" });
    expect(outcome.profileUpdates).toEqual({});
  });

  test("routes concise cover-letter requests to the open application only", async () => {
    const outcome = await aiService.processScenario("Make the cover letter more concise", sampleProfile, { jobId: "job-123", currentTab: "tab-cover" });
    expect(outcome.action).toBe("edit_application");
    expect(outcome.documentEdit?.kind).toBe("cover");
    expect(outcome.documentEdit?.mode).toBe("concise");
  });

  test("does not turn an unknown command into a search or profile mutation", async () => {
    const outcome = await aiService.processScenario("make everything better somehow", sampleProfile);
    expect(outcome.action).toBe("unsupported");
    expect(outcome.profileUpdates).toEqual({});
    expect(outcome.feedFilters).toBeUndefined();
  });
});
