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
  portal: "cv-library" | "reed" | "google-jobs" | "adzuna" | "jobicy" | "arbeitnow" | "remotive" | "themuse" | "greenhouse" | "lever" | "ashby";
  sourceLabel: string;
}

export interface SourceReport {
  source: string;
  status: "ok" | "failed" | "skipped";
  found: number;
  added?: number;
  enriched?: number;
  filtered?: number;
  reason?: string;
  guidance?: string;
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

export function normalizeTheMuseJobs(payload: any): SourceJob[] {
  return (payload?.results || []).map((job: any) => {
    const locNames = (job.locations || []).map((l: any) => l.name).filter(Boolean);
    const locStr = locNames.length ? locNames.join(", ") : "Flexible / Remote";
    const applyUrl = job.refs?.landing_page || "";
    const rawDesc = (job.contents || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    return {
      externalId: String(job.id || stableId(job.name, job.company?.name, applyUrl)),
      title: text(job.name),
      company: text(job.company?.name || "Unknown employer"),
      location: text(locStr),
      url: String(applyUrl),
      postedDate: dateOnly(job.publication_date),
      description: text(rawDesc),
      portal: "themuse" as const,
      sourceLabel: "The Muse",
    };
  }).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeGreenhouseJobs(company: string, payload: any): SourceJob[] {
  const companyTitle = company.charAt(0).toUpperCase() + company.slice(1);
  return (payload?.jobs || []).map((job: any) => {
    const rawContent = (job.content || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    return {
      externalId: String(job.id || stableId(job.title, company, job.absolute_url)),
      title: text(job.title),
      company: text(companyTitle),
      location: text(job.location?.name || "Global / Remote"),
      url: String(job.absolute_url || ""),
      postedDate: dateOnly(job.updated_at),
      description: text(rawContent),
      portal: "greenhouse" as const,
      sourceLabel: `Greenhouse (${companyTitle})`,
    };
  }).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeLeverJobs(company: string, payload: any): SourceJob[] {
  const companyTitle = company.charAt(0).toUpperCase() + company.slice(1);
  const list = Array.isArray(payload) ? payload : [];
  return list.map((job: any) => {
    const desc = text(job.descriptionPlain || job.additionalPlain || "");
    const loc = job.categories?.location || (job.workplaceType === "remote" ? "Remote" : "Global / Remote");
    return {
      externalId: String(job.id || stableId(job.text, company, job.hostedUrl)),
      title: text(job.text),
      company: text(companyTitle),
      location: text(loc),
      url: String(job.applyUrl || job.hostedUrl || ""),
      postedDate: dateOnly(job.createdAt ? new Date(job.createdAt) : undefined),
      description: desc,
      portal: "lever" as const,
      sourceLabel: `Lever (${companyTitle})`,
    };
  }).filter((job: SourceJob) => job.title && job.company && job.url);
}

export function normalizeAshbyJobs(company: string, payload: any): SourceJob[] {
  const companyTitle = company.charAt(0).toUpperCase() + company.slice(1);
  return (payload?.jobs || []).map((job: any) => {
    const locs = [job.location, ...(job.secondaryLocations || []).map((l: any) => l.location || l)].filter(Boolean);
    const locStr = locs.length ? locs.join(", ") : "Global / Remote";
    return {
      externalId: String(job.id || stableId(job.title, company, job.jobUrl)),
      title: text(job.title),
      company: text(companyTitle),
      location: text(locStr),
      url: String(job.jobUrl || ""),
      postedDate: dateOnly(job.publishedAt),
      description: text(job.descriptionPlain || ""),
      portal: "ashby" as const,
      sourceLabel: `Ashby (${companyTitle})`,
    };
  }).filter((job: SourceJob) => job.title && job.company && job.url);
}

export interface CandidateCountryInfo {
  countryName: string;
  freehireCode: string;
  adzunaCode: string;
  currency: string;
  isUk: boolean;
}

export function detectCandidateCountry(locationStr?: string, targetLocations: string[] = []): CandidateCountryInfo {
  const combined = [locationStr || "", ...targetLocations].join(" ").toLowerCase();

  if (/germany|deutschland|berlin|munich|münchen|frankfurt|hamburg|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|chemnitz|dresden|sachsen|erfurt|bonn|hannover|nürnberg|nuremberg|bremen|kiel|augsburg|mannheim|wiesbaden|mainz|karlsruhe|essen|dortmund/i.test(combined)) {
    return { countryName: "Germany", freehireCode: "DE", adzunaCode: "de", currency: "€", isUk: false };
  }
  if (/india|bangalore|bengaluru|hyderabad|mumbai|delhi|noida|gurgaon|gurugram|pune|chennai|kolkata/i.test(combined)) {
    return { countryName: "India", freehireCode: "IN", adzunaCode: "in", currency: "₹", isUk: false };
  }
  if (/united states|\bua\b|usa|america|new york|california|san francisco|austin|texas|seattle|chicago|boston|los angeles/i.test(combined)) {
    return { countryName: "United States", freehireCode: "US", adzunaCode: "us", currency: "$", isUk: false };
  }
  if (/france|paris|lyon|marseille/i.test(combined)) {
    return { countryName: "France", freehireCode: "FR", adzunaCode: "fr", currency: "€", isUk: false };
  }
  if (/netherlands|holland|amsterdam|rotterdam/i.test(combined)) {
    return { countryName: "Netherlands", freehireCode: "NL", adzunaCode: "nl", currency: "€", isUk: false };
  }
  if (/canada|toronto|vancouver|montreal/i.test(combined)) {
    return { countryName: "Canada", freehireCode: "CA", adzunaCode: "ca", currency: "CA$", isUk: false };
  }
  if (/australia|sydney|melbourne|brisbane/i.test(combined)) {
    return { countryName: "Australia", freehireCode: "AU", adzunaCode: "au", currency: "AU$", isUk: false };
  }

  return { countryName: "United Kingdom", freehireCode: "GB", adzunaCode: "gb", currency: "£", isUk: true };
}

export function detectJobCountry(job: { location?: string; portal?: string }): { countryName: string; isUk: boolean; isRemote: boolean } {
  const loc = (job.location || "").toLowerCase();
  const portal = (job.portal || "").toLowerCase();
  const isRemote = loc.includes("remote") || loc.includes("worldwide") || loc.includes("anywhere") || loc.includes("telecommute");

  if (portal === "reed" || portal === "cv-library") {
    return { countryName: "United Kingdom", isUk: true, isRemote };
  }
  if (portal === "arbeitnow") {
    return { countryName: "Germany", isUk: false, isRemote };
  }

  if (/germany|deutschland|berlin|munich|münchen|frankfurt|hamburg|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|chemnitz|dresden|sachsen|erfurt|bonn|hannover|nürnberg|nuremberg|bremen/i.test(loc)) {
    return { countryName: "Germany", isUk: false, isRemote };
  }
  if (/united kingdom|\buk\b|england|scotland|wales|london|manchester|birmingham|leeds|glasgow|edinburgh|newcastle|bristol|hartlepool|liverpool|sheffield|durham|sunderland|teesside|reading|oxford|cambridge|lutterworth|birchwood|ancoats/i.test(loc)) {
    return { countryName: "United Kingdom", isUk: true, isRemote };
  }
  if (/canada|ontario|mississauga|toronto|vancouver|montreal|quebec|ottawa|calgary|alberta|british columbia/i.test(loc)) {
    return { countryName: "Canada", isUk: false, isRemote };
  }
  if (/india|bangalore|bengaluru|hyderabad|mumbai|delhi|pune|chennai|noida|gurgaon|kolkata|ahmedabad|maharashtra|karnataka|tamil nadu|telangana/i.test(loc)) {
    return { countryName: "India", isUk: false, isRemote };
  }
  if (/united states|\busa\b|\bus\b|new york|california|san francisco|austin|texas|seattle|chicago|boston|los angeles|atlanta|denver|colorado|florida|washington/i.test(loc)) {
    return { countryName: "United States", isUk: false, isRemote };
  }
  if (/australia|sydney|melbourne|brisbane|perth|adelaide/i.test(loc)) {
    return { countryName: "Australia", isUk: false, isRemote };
  }
  if (/ireland|dublin|cork|galway/i.test(loc)) {
    return { countryName: "Ireland", isUk: false, isRemote };
  }
  if (/netherlands|amsterdam|rotterdam|utrecht|hague|eindhoven/i.test(loc)) {
    return { countryName: "Netherlands", isUk: false, isRemote };
  }
  if (/france|paris|lyon|marseille|toulouse/i.test(loc)) {
    return { countryName: "France", isUk: false, isRemote };
  }
  if (/spain|españa|madrid|barcelona|valencia/i.test(loc)) {
    return { countryName: "Spain", isUk: false, isRemote };
  }

  return { countryName: isRemote ? "Remote" : "Unknown", isUk: false, isRemote };
}

export function detectAdzunaCountry(location: string): string {
  const loc = (location || "").toLowerCase();
  if (/germany|deutschland|berlin|munich|frankfurt|hamburg|chemnitz|leipzig|dresden/i.test(loc)) return "de";
  if (/india|bangalore|hyderabad|mumbai|delhi|pune|chennai/i.test(loc)) return "in";
  if (/united states|\bua\b|usa|america|new york|california|texas|san francisco|austin|seattle|chicago/i.test(loc)) return "us";
  if (/france|paris|lyon/i.test(loc)) return "fr";
  if (/canada|toronto|vancouver|montreal/i.test(loc)) return "ca";
  if (/australia|sydney|melbourne|brisbane/i.test(loc)) return "au";
  if (/netherlands|holland|amsterdam|rotterdam/i.test(loc)) return "nl";
  if (/poland|warsaw|krakow/i.test(loc)) return "pl";
  if (/brazil|brasil|sao paulo/i.test(loc)) return "br";
  if (/south africa|johannesburg|cape town/i.test(loc)) return "za";
  if (/italy|italia|milan|rome/i.test(loc)) return "it";
  if (/austria|vienna|wien/i.test(loc)) return "at";
  if (/new zealand|auckland|wellington/i.test(loc)) return "nz";
  if (/singapore/i.test(loc)) return "sg";
  return "gb";
}

export async function searchCvLibrary(config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  if (!config.cvLibraryApiKey) throw new Error("CV-Library API key is not configured");
  const isNonUk = /germany|deutschland|india|united states|\busa\b|france|canada|australia/i.test(location || "");
  if (isNonUk) return [];
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
  const isNonUk = /germany|deutschland|india|united states|\busa\b|france|canada|australia/i.test(location || "");
  if (isNonUk) return [];
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
  const country = detectAdzunaCountry(location);
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", config.adzunaAppId);
  url.searchParams.set("app_key", config.adzunaAppKey);
  url.searchParams.set("results_per_page", "30");
  url.searchParams.set("what", query);
  if (location && !/^(remote|united kingdom|germany|india|united states|usa)$/i.test(location.trim())) {
    url.searchParams.set("where", location);
  }
  url.searchParams.set("max_days_old", "7");
  url.searchParams.set("content-type", "application/json");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Adzuna returned ${response.status}`);
  return normalizeAdzunaJobs(await response.json());
}

function sanitizeJobicyTag(query: string): string | null {
  const cleaned = (query || "").replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  if (cleaned.length >= 3 && cleaned.length <= 20) {
    return cleaned;
  }
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && w.length <= 20);
  const priorityTerms = [
    "devops", "platform", "sre", "cloud", "infrastructure", "kubernetes",
    "dynamics", "testing", "tester", "qa",
    "backend", "frontend", "fullstack", "developer", "engineer"
  ];
  for (const term of priorityTerms) {
    const match = words.find(w => w.toLowerCase() === term || term.includes(w.toLowerCase()));
    if (match) return match.slice(0, 20);
  }
  if (words.length > 0) {
    return words[0].slice(0, 20);
  }
  return null;
}

export async function searchJobicy(_config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  const url = new URL("https://jobicy.com/api/jobs");
  url.searchParams.set("count", "100");
  url.searchParams.set("geo", "europe");
  const tag = sanitizeJobicyTag(query);
  if (tag) {
    url.searchParams.set("tag", tag);
  }
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    // If Jobicy returns 400 for a specific tag, fallback to general feed rather than failing
    const fallbackRes = await fetch("https://jobicy.com/api/jobs?count=100&geo=europe", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    }).catch(() => null);
    if (fallbackRes && fallbackRes.ok) {
      return normalizeJobicyJobs(await fallbackRes.json()).filter(job => matchesQuery(job, query) && matchesUkEligibility(job, location));
    }
    throw new Error(`Jobicy returned ${response.status}`);
  }
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

export async function searchTheMuse(_config: SearchConfig, query: string, location: string): Promise<SourceJob[]> {
  const url = new URL("https://www.themuse.com/api/public/jobs");
  url.searchParams.set("page", "1");
  url.searchParams.set("descending", "true");
  if (/software|engineer|developer|devops|cloud|platform|sre|qa|test|data|infrastructure/i.test(query)) {
    url.searchParams.set("category", "Software Engineering");
  }
  if (/remote/i.test(location || "")) {
    url.searchParams.set("location", "Flexible / Remote");
  } else if (/united kingdom|\buk\b|london|manchester|leeds|birmingham|hartlepool/i.test(location || "")) {
    url.searchParams.set("location", "London, United Kingdom");
  } else if (/germany|deutschland|berlin|munich|frankfurt|chemnitz/i.test(location || "")) {
    url.searchParams.set("location", "Berlin, Germany");
  } else if (location && !/any|all/i.test(location)) {
    url.searchParams.set("location", location);
  }
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`The Muse returned ${response.status}`);
  return normalizeTheMuseJobs(await response.json()).filter(job => matchesQuery(job, query) && matchesUkEligibility(job, location));
}

export const DEFAULT_GREENHOUSE_COMPANIES = [
  "cloudflare", "datadog", "stripe", "figma", "elastic", "gitlab", "docker", "canva", "reddit", "airbnb"
];

export const DEFAULT_LEVER_COMPANIES = [
  "palantir", "spotify", "netflix", "atlassian"
];

export const DEFAULT_ASHBY_COMPANIES = [
  "linear", "notion", "ramp", "anthropic", "openai"
];

function parseCustomAtsCompanies(config: SearchConfig): string[] {
  if (!config.customAtsCompanies) return [];
  return config.customAtsCompanies
    .split(/[,;\s]+/)
    .map(s => s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""))
    .filter(Boolean);
}

export async function searchGreenhouse(
  config: SearchConfig,
  query: string,
  location: string
): Promise<SourceJob[]> {
  const custom = parseCustomAtsCompanies(config);
  const companies = Array.from(new Set([...custom, ...DEFAULT_GREENHOUSE_COMPANIES])).slice(0, 15);
  const allJobs: SourceJob[] = [];

  await Promise.all(companies.map(async (company) => {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs?content=true`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return;
      const data = await res.json();
      const normalized = normalizeGreenhouseJobs(company, data);
      const filtered = normalized.filter(j => matchesQuery(j, query) && matchesUkEligibility(j, location));
      allJobs.push(...filtered);
    } catch {}
  }));

  return allJobs;
}

export async function searchLever(
  config: SearchConfig,
  query: string,
  location: string
): Promise<SourceJob[]> {
  const custom = parseCustomAtsCompanies(config);
  const companies = Array.from(new Set([...custom, ...DEFAULT_LEVER_COMPANIES])).slice(0, 15);
  const allJobs: SourceJob[] = [];

  await Promise.all(companies.map(async (company) => {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return;
      const data = await res.json();
      const normalized = normalizeLeverJobs(company, data);
      const filtered = normalized.filter(j => matchesQuery(j, query) && matchesUkEligibility(j, location));
      allJobs.push(...filtered);
    } catch {}
  }));

  return allJobs;
}

export async function searchAshby(
  config: SearchConfig,
  query: string,
  location: string
): Promise<SourceJob[]> {
  const custom = parseCustomAtsCompanies(config);
  const companies = Array.from(new Set([...custom, ...DEFAULT_ASHBY_COMPANIES])).slice(0, 15);
  const allJobs: SourceJob[] = [];

  await Promise.all(companies.map(async (company) => {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return;
      const data = await res.json();
      const normalized = normalizeAshbyJobs(company, data);
      const filtered = normalized.filter(j => matchesQuery(j, query) && matchesUkEligibility(j, location));
      allJobs.push(...filtered);
    } catch {}
  }));

  return allJobs;
}
