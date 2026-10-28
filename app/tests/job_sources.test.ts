import { describe, expect, test } from "bun:test";
import {
  normalizeAdzunaJobs, normalizeArbeitnowJobs, normalizeCvLibraryJobs,
  normalizeGoogleJobs, normalizeJobicyJobs, normalizeReedJobs, normalizeRemotiveJobs,
} from "../job_sources";

describe("job source normalization", () => {
  test("normalizes CV-Library results", () => {
    const [job] = normalizeCvLibraryJobs({ jobs: [{ id: 7, title: "Platform Engineer", agency: { title: "Acme" }, location: "London", url: "/job/7", posted: "2026-10-26", description_full: "Build platforms" }] });
    expect(job.portal).toBe("cv-library");
    expect(job.url).toBe("https://www.cv-library.co.uk/job/7");
  });

  test("normalizes Reed results", () => {
    const [job] = normalizeReedJobs({ results: [{ jobId: 8, jobTitle: "SRE", employerName: "Example", locationName: "Leeds", jobUrl: "https://reed.example/8", date: "2026-10-25", jobDescription: "Operate services" }] });
    expect(job.portal).toBe("reed");
    expect(job.company).toBe("Example");
  });

  test("normalizes Google Jobs provider results without inventing an apply URL", () => {
    const jobs = normalizeGoogleJobs({ jobs_results: [{ job_id: "g1", title: "DevOps Engineer", company_name: "Example", location: "UK", description: "Automation" }] });
    expect(jobs).toHaveLength(0);
  });

  test("normalizes the free supplemental APIs into the shared job shape", () => {
    const [adzuna] = normalizeAdzunaJobs({ results: [{ id: "a1", title: "Platform Engineer", company: { display_name: "Acme" }, location: { display_name: "London" }, redirect_url: "https://adzuna.example/a1", created: "2026-10-27", description: "Build platforms", salary_min: 80000, salary_max: 90000 }] });
    const [jobicy] = normalizeJobicyJobs({ jobs: [{ id: "j1", jobTitle: "SRE", companyName: "Remote Co", jobGeo: "Europe", url: "https://jobicy.example/j1", pubDate: "2026-10-27", jobDescription: "Run services" }] });
    const [arbeitnow] = normalizeArbeitnowJobs({ data: [{ slug: "n1", title: "DevOps Engineer", company_name: "Euro Co", location: "Berlin", remote: true, url: "https://arbeitnow.example/n1", created_at: 1793059200, description: "Automate infrastructure" }] });
    const [remotive] = normalizeRemotiveJobs({ jobs: [{ id: 9, title: "Cloud Engineer", company_name: "Cloud Co", candidate_required_location: "UK", url: "https://remotive.example/9", publication_date: "2026-10-27", description: "Cloud systems" }] });
    expect([adzuna.portal, jobicy.portal, arbeitnow.portal, remotive.portal]).toEqual(["adzuna", "jobicy", "arbeitnow", "remotive"]);
    expect(adzuna.salary).toContain("80,000");
    expect(arbeitnow.location).toContain("Remote");
  });

  test("detectAdzunaCountry routes to the correct international Adzuna endpoint", () => {
    const { detectAdzunaCountry } = require("../job_sources");
    expect(detectAdzunaCountry("Berlin, Germany")).toBe("de");
    expect(detectAdzunaCountry("Munich")).toBe("de");
    expect(detectAdzunaCountry("Bangalore, India")).toBe("in");
    expect(detectAdzunaCountry("Hyderabad")).toBe("in");
    expect(detectAdzunaCountry("New York, USA")).toBe("us");
    expect(detectAdzunaCountry("Austin, Texas")).toBe("us");
    expect(detectAdzunaCountry("Paris, France")).toBe("fr");
    expect(detectAdzunaCountry("Toronto, Canada")).toBe("ca");
    expect(detectAdzunaCountry("Sydney, Australia")).toBe("au");
    expect(detectAdzunaCountry("Amsterdam, Netherlands")).toBe("nl");
    expect(detectAdzunaCountry("London, United Kingdom")).toBe("gb");
  });
});
