import { createHash } from "crypto";
import type { SearchConfig } from "./search_config";

export interface SourceJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  postedDate: string;
  description: string;
  salary?: string;
  portal: "cv-library" | "reed" | "google-jobs" | "adzuna" | "jobicy" | "arbeitnow" | "remotive";
  sourceLabel: string;
}

export interface SourceReport {
  source: string;
  status: "ok" | "failed" | "skipped";
  found: number;
  added?: number;
  reason?: string;
}

function text(value: unknown): string {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function dateOnly(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString().slice(0, 10);
  }
  const raw = String(value || "");
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || new Date().toISOString().slice(0, 10);
}

function salaryRange(minimum: unknown, maximum: unknown, currency = "£"): string | undefined {
  const min = Number(minimum || 0);
  const max = Number(maximum || 0);
  if (!min && !max) return undefined;
  return `${currency}${Math.round(min || max).toLocaleString()} - ${currency}${Math.round(max || min).toLocaleString()}`;
}

function matchesQuery(job: SourceJob, query: string): boolean {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(term => term.length > 2);
  if (!terms.length) return true;
  const generic = new Set(["senior", "lead", "staff", "principal", "engineer", "engineering", "developer", "roles", "jobs"]);
  const signals = terms.filter(term => !generic.has(term));
  const required = signals.length ? signals : terms;
  const title = job.title.toLowerCase();
  const matches = required.filter(term => title.includes(term)).length;
  return matches >= Math.max(1, Math.ceil(required.length * 0.6));
}

function matchesUkEligibility(job: SourceJob, requestedLocation: string): boolean {
  if (!requestedLocation || /remote/i.test(requestedLocation)) return true;
  const ukSearch = /united kingdom|\buk\b|london|manchester|leeds|edinburgh|glasgow|birmingham|bristol|newcastle|hartlepool/i.test(requestedLocation);
  if (!ukSearch) return true;
  return /united kingdom|\buk\b|europe|worldwide|anywhere|global/i.test(job.location);
}

function stableId(...values: unknown[]): string {
  return createHash("sha256").update(values.map(value => String(value || "")).join("|")).digest("hex").slice(0, 20);
}

export function normalizeCvLibraryJobs(payload: any): SourceJob[] {
  return (payload?.jobs || []).map((job: any) => ({
    externalId: String(job.id || stableId(job.title, job.agency?.title, job.url)),
    title: text(job.title || job.hl_title),
    company: text(job.agency?.title || job.company || "Unknown employer"),
    location: text(job.location || "United Kingdom"),
    url: String(job.url || "").startsWith("http") ? String(job.url) : `https://www.cv-library.co.uk${job.url || ""}`,
    postedDate: dateOnly(job.posted),
    description: text(job.description_full || job.description),
    salary: text(typeof job.salary === "object" ? `${job.salary.min || ""} - ${job.salary.max || ""} ${job.salary.period || ""}` : job.salary),
    portal: "cv-library" as const,
    sourceLabel: "CV-Library",
  })).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeReedJobs(payload: any): SourceJob[] {
  return (payload?.results || []).map((job: any) => ({
    externalId: String(job.jobId || stableId(job.jobTitle, job.employerName, job.jobUrl)),
    title: text(job.jobTitle),
    company: text(job.employerName || "Unknown employer"),
    location: text(job.locationName || "United Kingdom"),
    url: String(job.jobUrl || `https://www.reed.co.uk/jobs/${job.jobId || ""}`),
    postedDate: dateOnly(job.date),
    description: text(job.jobDescription),
    salary: job.minimumSalary ? `£${Number(job.minimumSalary).toLocaleString()} - £${Number(job.maximumSalary || job.minimumSalary).toLocaleString()}` : undefined,
    portal: "reed" as const,
    sourceLabel: "Reed",
  })).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeGoogleJobs(payload: any): SourceJob[] {
  return (payload?.jobs_results || []).map((job: any) => {
    const applyUrl = job.apply_options?.find((option: any) => option.link)?.link || job.share_link || job.related_links?.[0]?.link || "";
    return {
      externalId: String(job.job_id || stableId(job.title, job.company_name, applyUrl)),
      title: text(job.title),
      company: text(job.company_name || "Unknown employer"),
      location: text(job.location || "United Kingdom"),
      url: String(applyUrl),
      postedDate: dateOnly(job.detected_extensions?.posted_at || job.extensions?.find((item: string) => /ago|today/i.test(item))),
      description: text(job.description),
      salary: text(job.detected_extensions?.salary || "") || undefined,
      portal: "google-jobs" as const,
      sourceLabel: text(job.via || "Google Jobs"),
    };
  }).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeAdzunaJobs(payload: any): SourceJob[] {
  return (payload?.results || []).map((job: any) => ({
    externalId: String(job.id || stableId(job.title, job.company?.display_name, job.redirect_url)),
    title: text(job.title),
    company: text(job.company?.display_name || "Unknown employer"),
    location: text(job.location?.display_name || "United Kingdom"),
    url: String(job.redirect_url || ""),
    postedDate: dateOnly(job.created),
    description: text(job.description),
    salary: salaryRange(job.salary_min, job.salary_max),
    portal: "adzuna" as const,
    sourceLabel: "Adzuna",
  })).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeJobicyJobs(payload: any): SourceJob[] {
  return (payload?.jobs || []).map((job: any) => ({
    externalId: String(job.id || stableId(job.jobTitle, job.companyName, job.url)),
    title: text(job.jobTitle),
    company: text(job.companyName || "Unknown employer"),
    location: text(job.jobGeo || job.jobLocation || "Remote"),
    url: String(job.url || ""),
    postedDate: dateOnly(job.pubDate || job.createdAt),
    description: text(job.jobDescription || job.description),
    salary: text(job.annualSalaryMin && job.annualSalaryMax ? `${job.annualSalaryMin} - ${job.annualSalaryMax}` : job.salary) || undefined,
    portal: "jobicy" as const,
    sourceLabel: "Jobicy",
  })).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeArbeitnowJobs(payload: any): SourceJob[] {
  return (payload?.data || []).map((job: any) => ({
    externalId: String(job.slug || stableId(job.title, job.company_name, job.url)),
    title: text(job.title),
    company: text(job.company_name || "Unknown employer"),
    location: text(job.remote ? `${job.location || "Europe"} · Remote` : job.location || "Europe"),
    url: String(job.url || ""),
    postedDate: dateOnly(job.created_at),
    description: text(job.description),
    portal: "arbeitnow" as const,
    sourceLabel: "Arbeitnow",
  })).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeRemotiveJobs(payload: any): SourceJob[] {
  return (payload?.jobs || []).map((job: any) => ({
    externalId: String(job.id || stableId(job.title, job.company_name, job.url)),
    title: text(job.title),
    company: text(job.company_name || "Unknown employer"),
    location: text(job.candidate_required_location || "Remote"),
    url: String(job.url || ""),
    postedDate: dateOnly(job.publication_date),
    description: text(job.description),
    salary: text(job.salary) || undefined,
    portal: "remotive" as const,
    sourceLabel: "Remotive",
  })).filter((job: SourceJob) => job.title && job.company && job.url);
}

export async function searchCvLibrary(config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  if (!config.cvLibraryApiKey) throw new Error("CV-Library API key is not configured");
  const url = new URL("https://www.cv-library.co.uk/search-jobs-json");
  url.searchParams.set("key", config.cvLibraryApiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("geo", location || "United Kingdom");
  url.searchParams.set("distance", "50");
  url.searchParams.set("posted", "7");
  url.searchParams.set("limit", "25");
  url.searchParams.set("description_full", "1");
  url.searchParams.set("nohl", "1");
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`CV-Library returned ${response.status}`);
  return normalizeCvLibraryJobs(await response.json());
}

export async function searchReed(config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  if (!config.reedApiKey) throw new Error("Reed API key is not configured");
  const url = new URL("https://www.reed.co.uk/api/1.0/search");
  url.searchParams.set("keywords", query);
  url.searchParams.set("locationName", location || "United Kingdom");
  url.searchParams.set("distanceFromLocation", "50");
  url.searchParams.set("resultsToTake", "25");
  const authorization = Buffer.from(`${config.reedApiKey}:`).toString("base64");
  const response = await fetch(url, { headers: { Authorization: `Basic ${authorization}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Reed returned ${response.status}`);
  return normalizeReedJobs(await response.json());
}

export async function searchGoogleJobs(config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  if (!config.serpApiKey) throw new Error("SerpAPI key is not configured");
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", query);
  url.searchParams.set("location", location || "United Kingdom");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", config.serpApiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Google Jobs provider returned ${response.status}`);
  return normalizeGoogleJobs(await response.json());
}

export async function searchAdzuna(config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  if (!config.adzunaAppId || !config.adzunaAppKey) throw new Error("Adzuna credentials are not configured");
  const url = new URL("https://api.adzuna.com/v1/api/jobs/gb/search/1");
  url.searchParams.set("app_id", config.adzunaAppId);
  url.searchParams.set("app_key", config.adzunaAppKey);
  url.searchParams.set("results_per_page", "30");
  url.searchParams.set("what", query);
  if (location && !/^(remote|united kingdom)$/i.test(location)) url.searchParams.set("where", location);
  url.searchParams.set("max_days_old", "7");
  url.searchParams.set("content-type", "application/json");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Adzuna returned ${response.status}`);
  return normalizeAdzunaJobs(await response.json());
}

export async function searchJobicy(_config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  const url = new URL("https://jobicy.com/api/jobs");
  url.searchParams.set("count", "100");
  url.searchParams.set("geo", "europe");
  url.searchParams.set("tag", query);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Jobicy returned ${response.status}`);
  return normalizeJobicyJobs(await response.json()).filter(job => matchesQuery(job, query) && matchesUkEligibility(job, location));
}

export async function searchArbeitnow(_config: SearchConfig, query: string, _location: string): Promise<SourceJob[]> {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Arbeitnow returned ${response.status}`);
  return normalizeArbeitnowJobs(await response.json()).filter(job => matchesQuery(job, query));
}

export async function searchRemotive(_config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  url.searchParams.set("search", query);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Remotive returned ${response.status}`);
  return normalizeRemotiveJobs(await response.json()).filter(job => matchesQuery(job, query) && matchesUkEligibility(job, location));
}
