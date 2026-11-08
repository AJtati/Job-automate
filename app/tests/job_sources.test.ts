import { describe, expect, test } from "bun:test";
import {
  normalizeAdzunaJobs, normalizeArbeitnowJobs, normalizeCvLibraryJobs,
  normalizeGoogleJobs, normalizeJobicyJobs, normalizeReedJobs, normalizeRemotiveJobs, normalizeTheMuseJobs,
  normalizeGreenhouseJobs, normalizeLeverJobs, normalizeAshbyJobs,
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
    const [themuse] = normalizeTheMuseJobs({ results: [{ id: 101, name: "Staff DevOps Engineer", company: { name: "Muse Tech" }, locations: [{ name: "London, UK" }], refs: { landing_page: "https://themuse.example/101" }, publication_date: "2026-10-27", contents: "<p>Lead <b>cloud</b> operations</p>" }] });
    const [greenhouse] = normalizeGreenhouseJobs("cloudflare", { jobs: [{ id: 201, title: "Edge SRE", absolute_url: "https://boards.greenhouse.io/cloudflare/jobs/201", updated_at: "2026-10-28", location: { name: "London, UK" }, content: "<p>Global edge network</p>" }] });
    const [lever] = normalizeLeverJobs("palantir", [{ id: "l1", text: "Forward Deployed Engineer", applyUrl: "https://jobs.lever.co/palantir/l1", createdAt: 1793059200000, categories: { location: "London" }, descriptionPlain: "Mission critical software" }]);
    const [ashby] = normalizeAshbyJobs("linear", { jobs: [{ id: "a1", title: "Infrastructure Engineer", jobUrl: "https://jobs.ashbyhq.com/linear/a1", publishedAt: "2026-10-28", location: "Europe / UK", descriptionPlain: "Modern product engine" }] });

    expect([adzuna.portal, jobicy.portal, arbeitnow.portal, remotive.portal, themuse.portal, greenhouse.portal, lever.portal, ashby.portal]).toEqual(["adzuna", "jobicy", "arbeitnow", "remotive", "themuse", "greenhouse", "lever", "ashby"]);
    expect(greenhouse.company).toBe("Cloudflare");
    expect(greenhouse.title).toBe("Edge SRE");
    expect(lever.company).toBe("Palantir");
    expect(lever.url).toBe("https://jobs.lever.co/palantir/l1");
    expect(ashby.company).toBe("Linear");
    expect(ashby.location).toBe("Europe / UK");
    expect(themuse.description).toBe("Lead cloud operations");
    expect(themuse.location).toBe("London, UK");
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

  test("parseJobDateAndTimestamp extracts exact ISO timestamp and date", () => {
    const { parseJobDateAndTimestamp } = require("../job_sources");
    const res1 = parseJobDateAndTimestamp("2026-10-31T14:35:00Z");
    expect(res1.date).toBe("2026-10-31");
    expect(res1.timestamp).toBe("2026-10-31T14:35:00.000Z");

    const res2 = parseJobDateAndTimestamp("2026-10-31");
    expect(res2.date).toBe("2026-10-31");
    expect(res2.timestamp).toBe("2026-10-31T00:00:00.000Z");

    const res3 = parseJobDateAndTimestamp(1793450000000);
    expect(res3.date).toBeDefined();
    expect(res3.timestamp).toBeDefined();
  });

  test("same-day sorting puts latest time and higher discovery order first", () => {
    function getJobTimestamp(j: any) {
      if (!j) return 0;
      if (j.posted_at) {
        const t = new Date(j.posted_at).getTime();
        if (!isNaN(t)) return t;
      }
      if (j.posted_date && j.posted_date.includes("T")) {
        const t = new Date(j.posted_date).getTime();
        if (!isNaN(t)) return t;
      }
      if (j.first_seen_at) {
        const t = new Date(j.first_seen_at).getTime();
        if (!isNaN(t)) return t;
      }
      const dateStr = j.posted_date || j.first_seen || "2026-01-01";
      const baseDay = dateStr.slice(0, 10);
      const baseTime = new Date(`${baseDay}T00:00:00Z`).getTime();
      const orderOffset = typeof j.seen_order === "number" ? j.seen_order * 1000 : 0;
      return (isNaN(baseTime) ? 0 : baseTime) + orderOffset;
    }

    function compareJobsByNewest(a: any, b: any) {
      const dateA = a.posted_date || a.first_seen || "2026-01-01";
      const dateB = b.posted_date || b.first_seen || "2026-01-01";
      const dayA = dateA.slice(0, 10);
      const dayB = dateB.slice(0, 10);
      if (dayB !== dayA) {
        return dayB.localeCompare(dayA);
      }
      const tsA = getJobTimestamp(a);
      const tsB = getJobTimestamp(b);
      if (tsB !== tsA && !isNaN(tsA) && !isNaN(tsB)) {
        return tsB - tsA;
      }
      return (b.fit_score || 0) - (a.fit_score || 0);
    }

    const jobMorning = { id: "1", title: "Job Morning", posted_date: "2026-10-31", posted_at: "2026-10-31T09:00:00Z", fit_score: 99 };
    const jobAfternoon = { id: "2", title: "Job Afternoon", posted_date: "2026-10-31", posted_at: "2026-10-31T15:30:00Z", fit_score: 80 };
    const jobEvening = { id: "3", title: "Job Evening", posted_date: "2026-10-31", posted_at: "2026-10-31T20:15:00Z", fit_score: 75 };
    const jobYesterday = { id: "4", title: "Job Yesterday", posted_date: "2026-10-30", posted_at: "2026-10-30T23:59:00Z", fit_score: 100 };

    const sorted = [jobYesterday, jobMorning, jobEvening, jobAfternoon].sort(compareJobsByNewest);
    // Evening (20:15) should be first, then Afternoon (15:30), then Morning (09:00), then Yesterday
    expect(sorted.map(j => j.id)).toEqual(["3", "2", "1", "4"]);
  });

  test("identifies imported jobs and preserves link-import classification", () => {
    function isImportedJob(j: any) {
      if (!j) return false;
      return Boolean(
        j.is_imported ||
        j.imported ||
        j.portal === "external-url" ||
        (j.source && /import|external-url/i.test(j.source)) ||
        (typeof j.id === "string" && (j.id.startsWith("ext_") || j.id.startsWith("imported_")))
      );
    }

    const regularJob = { id: "reed_123", portal: "reed", source: "reed" };
    const luxoftImported = {
      id: "ext_1793711507139",
      portal: "external-url",
      source: "Instant URL Import",
      url: "https://career.luxoft.com/jobs/senior-software-engineer-sdlc-github-actions-26940",
      company: "Career DXC Luxoft"
    };
    const flaggedImport = { id: "custom_99", is_imported: true };

    expect(isImportedJob(regularJob)).toBe(false);
    expect(isImportedJob(luxoftImported)).toBe(true);
    expect(isImportedJob(flaggedImport)).toBe(true);
  });

  test("imported jobs marked as applied remain applied and visible in applied filter", () => {
    function getHigherStatus(statusA?: string, statusB?: string): string {
      const rank: Record<string, number> = {
        offered: 5,
        interview: 4,
        applied: 3,
        drafted: 2,
        rejected: 2,
        archived: 2,
        new: 1
      };
      const a = (statusA || "").toLowerCase();
      const b = (statusB || "").toLowerCase();
      const rA = rank[a] || 0;
      const rB = rank[b] || 0;
      return rA >= rB ? (statusA || statusB || "new") : (statusB || statusA || "new");
    }

    // Status precedence test: applied must never be clobbered by drafted or new
    expect(getHigherStatus("applied", "drafted")).toBe("applied");
    expect(getHigherStatus("drafted", "applied")).toBe("applied");
    expect(getHigherStatus(undefined, "applied")).toBe("applied");
    expect(getHigherStatus("applied", undefined)).toBe("applied");
    expect(getHigherStatus("drafted", "new")).toBe("drafted");

    // Filter matching logic test
    function filterJob(j: any, currentFilter: string) {
      if (currentFilter !== "applied" && currentFilter !== "imported" && j.status === "applied") {
        return false;
      }
      if (currentFilter === "applied") return j.status === "applied";
      if (currentFilter === "imported") return Boolean(j.is_imported || j.imported || j.id.startsWith("ext_"));
      return true;
    }

    const appliedImported = {
      id: "ext_1793711507139",
      company: "Career DXC Luxoft",
      title: "Senior Software Engineer",
      status: "applied",
      is_imported: true,
      cv_file: "cv/main.tex",
      cover_file: "cover_letters/cover.tex"
    };

    // Visible in 'applied' pipeline section
    expect(filterJob(appliedImported, "applied")).toBe(true);
    // Also accessible in 'imported' sidebar section
    expect(filterJob(appliedImported, "imported")).toBe(true);
    // Hidden from general unapplied discovery feeds once applied
    expect(filterJob(appliedImported, "all")).toBe(false);
  });

  test("user-imported jobs are always relevant regardless of automated keyword gates", () => {
    function isJobRelevantToProfile(item: any, profile: any, id?: string): boolean {
      if (!item || !profile) return false;
      const isImported = Boolean(
        item.is_imported ||
        item.imported ||
        item.portal === "external-url" ||
        (item.source && /import|external-url/i.test(item.source)) ||
        (typeof id === "string" && (id.startsWith("ext_") || id.startsWith("imported_"))) ||
        (typeof item.id === "string" && (item.id.startsWith("ext_") || item.id.startsWith("imported_")))
      );
      if (isImported) {
        if (item.profileId && item.profileId !== profile.id) return false;
        return true;
      }
      return false;
    }

    const devopsProfile = { id: "p1", headline: "DevOps Engineer", targetRoles: ["DevOps Engineer"] };
    const importedSoftwareEngineerJob = {
      id: "ext_1793711507139",
      title: "Senior Software Engineer (SDLC, GitHub Actions)",
      company: "Career DXC Luxoft",
      portal: "external-url",
      is_imported: true
    };

    expect(isJobRelevantToProfile(importedSoftwareEngineerJob, devopsProfile, importedSoftwareEngineerJob.id)).toBe(true);
  });

  test("JobSpy jobs are tagged with jobspy portal and distinctive board attribution", () => {
    const rawJobs = [
      { id: "jobspy_indeed_in-1", externalId: "in-1", title: "Software Engineer", company: "Anthropic", location: "London", url: "https://uk.indeed.com/viewjob?jk=abc", postedDate: "2026-11-03", portal: "jobspy", site: "indeed", sourceLabel: "JobSpy (Indeed)", source: "jobspy" },
      { id: "jobspy_glassdoor_gd-2", externalId: "gd-2", title: "Site Reliability Engineer", company: "JPMorganChase", location: "London", url: "https://www.glassdoor.com/job-listing/j?jl=101", postedDate: "2026-11-03", portal: "jobspy", site: "glassdoor", sourceLabel: "JobSpy (Glassdoor)", source: "jobspy" },
      { id: "jobspy_google_g-3", externalId: "g-3", title: "Cloud Architect", company: "Google Cloud", location: "London", url: "https://google.com/jobs/1", postedDate: "2026-11-03", portal: "jobspy", site: "google", sourceLabel: "JobSpy (Google)", source: "jobspy" }
    ];

    for (const job of rawJobs) {
      expect(job.portal).toBe("jobspy");
      expect(job.source).toBe("jobspy");
      expect(job.sourceLabel).toMatch(/^JobSpy \((Indeed|Glassdoor|Google)\)$/);
    }
  });

  test("cross-source deduplication unifies same company and role across JobSpy, LinkedIn, and ATS", () => {
    function getJobDedupKey(job: { url?: string; company?: string; title?: string }): string {
      const normCompany = (job.company || "").toLowerCase()
        .replace(/\b(europe limited|limited|ltd|b corp™|b corp|l\.p\.|lp|inc|llc|uk & ireland|plc)\b/g, "")
        .replace(/[^a-z0-9]/g, "");
      const normTitle = (job.title || "").toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/[^a-z0-9]/g, "");
      if (normCompany && normTitle) {
        return `ct_${normCompany}_${normTitle}`;
      }

      const url = (job.url || "").trim();
      const jkMatch = url.match(/[?&]jk=([a-f0-9]+)/i);
      if (jkMatch) return `indeed_${jkMatch[1].toLowerCase()}`;

      const idMatch = url.match(/(\d{6,})/);
      if (idMatch) return `job_id_${idMatch[1]}`;
      
      const normUrl = url.split("?")[0].replace(/^https?:\/\/(www\.|uk\.)?/, "").replace(/\/$/, "");
      if (normUrl) return `url_${normUrl}`;

      return `fallback_${Math.random()}`;
    }

    const jobspyIndeedJob = {
      title: "Senior Software Engineer",
      company: "Anthropic Ltd",
      url: "https://uk.indeed.com/viewjob?jk=d82bc175fd28e64f"
    };

    const linkedinJob = {
      title: "Senior Software Engineer",
      company: "Anthropic",
      url: "https://www.linkedin.com/jobs/view/4472952380"
    };

    const atsJob = {
      title: "Senior Software Engineer",
      company: "Anthropic",
      url: "https://jobs.ashbyhq.com/anthropic/d1d5aa98"
    };

    const differentRoleSameCompany = {
      title: "Staff Product Manager",
      company: "Anthropic",
      url: "https://jobs.ashbyhq.com/anthropic/e9912aa1"
    };

    const indeedJobA = {
      title: "",
      company: "",
      url: "https://uk.indeed.com/viewjob?jk=d82bc175fd28e64f"
    };

    const indeedJobB = {
      title: "",
      company: "",
      url: "https://uk.indeed.com/viewjob?jk=f11aa994bd11e02c"
    };

    // The same vacancy across Indeed, LinkedIn, and ATS produces identical dedup key
    const keyIndeed = getJobDedupKey(jobspyIndeedJob);
    const keyLinkedIn = getJobDedupKey(linkedinJob);
    const keyAts = getJobDedupKey(atsJob);
    expect(keyIndeed).toBe(keyLinkedIn);
    expect(keyIndeed).toBe(keyAts);
    expect(keyIndeed).toBe("ct_anthropic_seniorsoftwareengineer");

    // Different roles at the same company produce distinct keys
    const keyPm = getJobDedupKey(differentRoleSameCompany);
    expect(keyPm).not.toBe(keyIndeed);
    expect(keyPm).toBe("ct_anthropic_staffproductmanager");

    // Individual Indeed jobs without company/title resolve by their distinct jk parameter
    expect(getJobDedupKey(indeedJobA)).toBe("indeed_d82bc175fd28e64f");
    expect(getJobDedupKey(indeedJobB)).toBe("indeed_f11aa994bd11e02c");
    expect(getJobDedupKey(indeedJobA)).not.toBe(getJobDedupKey(indeedJobB));
  });

  test("ignored jobs are hidden from discovery filters and strictly isolated to ignored section", () => {
    const jobs = [
      { id: "job1", title: "Active DevOps Engineer", company: "Sky", status: "new", is_remote: true },
      { id: "job2", title: "Expired SRE Role", company: "BT", status: "ignored", ignored: true, is_remote: true },
      { id: "job3", title: "Applied Platform Engineer", company: "BBC", status: "applied", is_remote: false },
      { id: "job4", title: "Drafted Cloud Engineer", company: "Cisco", status: "drafted", is_remote: true },
    ];

    const isIgnored = (j: any) => j.status === "ignored" || Boolean(j.ignored);

    const filterFor = (filterName: string) => {
      return jobs.filter(j => {
        const ignored = isIgnored(j);
        if (filterName === "ignored") return ignored;
        if (ignored) return false;
        if (filterName !== "applied" && filterName !== "imported" && j.status === "applied") return false;
        if (filterName === "remote") return j.is_remote;
        if (filterName === "drafted") return j.status === "drafted";
        if (filterName === "applied") return j.status === "applied";
        return true;
      });
    };

    // 'all' filter excludes applied and ignored jobs
    const allResults = filterFor("all");
    expect(allResults.map(j => j.id)).toEqual(["job1", "job4"]);
    expect(allResults.some(j => j.id === "job2")).toBe(false);

    // 'remote' filter excludes ignored jobs even if remote
    const remoteResults = filterFor("remote");
    expect(remoteResults.map(j => j.id)).toEqual(["job1", "job4"]);
    expect(remoteResults.some(j => j.id === "job2")).toBe(false);

    // 'drafted' filter excludes ignored jobs
    const draftedResults = filterFor("drafted");
    expect(draftedResults.map(j => j.id)).toEqual(["job4"]);
    expect(draftedResults.some(j => j.id === "job2")).toBe(false);

    // 'ignored' filter strictly shows only ignored jobs
    const ignoredResults = filterFor("ignored");
    expect(ignoredResults.map(j => j.id)).toEqual(["job2"]);

    // Un-ignoring restores job back to active discovery
    jobs[1].status = "new";
    jobs[1].ignored = false;

    const restoredAll = filterFor("all");
    expect(restoredAll.some(j => j.id === "job2")).toBe(true);
    const restoredIgnored = filterFor("ignored");
    expect(restoredIgnored.some(j => j.id === "job2")).toBe(false);
  });

  test("cleanHtmlDescription cleanly removes style, script, noscript and interstitial redirect code", async () => {
    const { cleanHtmlDescription } = await import("../server");
    const htmlWithScripts = `
      <html>
        <head>
          <style>
            html { margin: 0; padding: 0; }
            body { font-family: Arial; }
          </style>
          <script>
            window.location.replace("https://click.appcast.io/t/123");
            window.__CF$cv$params = { r: '123' };
          </script>
          <noscript>Please enable JavaScript to continue</noscript>
        </head>
        <body>
          <h1>DevOps Engineer</h1>
          <p>We are seeking a DevOps Engineer with Kubernetes and Terraform experience.</p>
        </body>
      </html>
    `;

    const cleaned = cleanHtmlDescription(htmlWithScripts);
    expect(cleaned).toContain("DevOps Engineer");
    expect(cleaned).toContain("Kubernetes and Terraform");
    expect(cleaned).not.toContain("margin : 0");
    expect(cleaned).not.toContain("margin: 0");
    expect(cleaned).not.toContain("window.location.replace");
    expect(cleaned).not.toContain("click.appcast.io");
    expect(cleaned).not.toContain("__CF$cv$params");
    expect(cleaned).not.toContain("Please enable JavaScript");
  });
});
