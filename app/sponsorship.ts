import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export type SponsorshipMode = "all" | "licensed" | "explicit";
export type VacancySponsorshipStatus = "offered" | "unavailable" | "not-stated";

export interface SponsorRecord {
  organisation: string;
  town: string;
  county: string;
  rating: string;
  route: string;
}

export interface SponsorMatch {
  verified: boolean;
  organisation?: string;
  rating?: string;
  route?: string;
  source: "gov-uk-register" | "none";
}

export interface SponsorshipAssessment {
  employer: SponsorMatch;
  vacancyStatus: VacancySponsorshipStatus;
  vacancyEvidence: string[];
  eligibleForExplicitFilter: boolean;
}

interface SponsorCache {
  fetchedAt: string;
  publishedAt?: string;
  sourceUrl: string;
  records: SponsorRecord[];
}

const CONTENT_API = "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers";
const LEGAL_STOP_WORDS = new Set([
  "ltd", "limited", "plc", "llp", "inc", "incorporated", "corp", "corporation", "company", "co",
  "holdings", "holding", "group", "uk", "united", "kingdom", "global", "international", "europe",
  "and", "u", "k", "ireland", "britain", "great", "northern",
]);

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index++;
      row.push(value.trim());
      value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

export function parseSponsorCsv(csv: string): SponsorRecord[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const header = rows[0].map(item => item.toLowerCase());
  const column = (name: string) => header.findIndex(item => item.includes(name));
  const organisationIndex = column("organisation");
  const townIndex = column("town");
  const countyIndex = column("county");
  const ratingIndex = column("type & rating");
  const routeIndex = column("route");
  if (organisationIndex < 0 || routeIndex < 0) return [];
  return rows.slice(1).map(row => ({
    organisation: row[organisationIndex] || "",
    town: townIndex >= 0 ? row[townIndex] || "" : "",
    county: countyIndex >= 0 ? row[countyIndex] || "" : "",
    rating: ratingIndex >= 0 ? row[ratingIndex] || "" : "",
    route: row[routeIndex] || "",
  })).filter(record => record.organisation && record.route);
}

export function normalizeOrganisation(value: string): string {
  return (value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(token => !LEGAL_STOP_WORDS.has(token))
    .join(" ");
}

export function findSponsor(records: SponsorRecord[], company: string): SponsorMatch {
  const target = normalizeOrganisation(company);
  if (!target) return { verified: false, source: "none" };
  const targetTokens = target.split(" ");
  const candidates = records.filter(record => {
    const registered = normalizeOrganisation(record.organisation);
    if (registered === target) return true;
    const prefixSafe = targetTokens.length >= 2 || target.length >= 8;
    return prefixSafe && (registered.startsWith(`${target} `) || target.startsWith(`${registered} `));
  });
  const match = candidates.find(record => /skilled worker/i.test(record.route)) || candidates[0];
  return match
    ? { verified: true, organisation: match.organisation, rating: match.rating, route: match.route, source: "gov-uk-register" }
    : { verified: false, source: "none" };
}

export function classifyVacancySponsorship(description: string): { status: VacancySponsorshipStatus; evidence: string[] } {
  const text = String(description || "").replace(/\s+/g, " ");
  const negativePatterns = [
    /(?:cannot|can't|unable to|do not|don't|does not|doesn't|will not|won't)\s+(?:offer|provide)?\s*(?:visa\s+)?sponsorship/i,
    /(?:visa\s+)?sponsorship\s+(?:is\s+)?(?:not available|not provided|unavailable)/i,
    /must already have (?:the )?(?:right|permission) to work in the uk/i,
    /no\s+(?:visa\s+)?sponsorship/i,
  ];
  const positivePatterns = [
    /(?:visa|skilled worker|tier\s*2)\s+sponsorship\s+(?:is\s+)?(?:available|provided|offered)/i,
    /(?:we|the employer|this role)\s+(?:can|will|is able to)\s+(?:provide|offer)?\s*(?:visa\s+)?sponsorship/i,
    /certificate of sponsorship\s+(?:is\s+)?(?:available|provided|offered)/i,
    /applications? (?:requiring|needing) (?:visa\s+)?sponsorship (?:are|is) welcome/i,
  ];
  const negative = negativePatterns.map(pattern => text.match(pattern)?.[0]).filter(Boolean) as string[];
  if (negative.length) return { status: "unavailable", evidence: negative.slice(0, 2) };
  const positive = positivePatterns.map(pattern => text.match(pattern)?.[0]).filter(Boolean) as string[];
  if (positive.length) return { status: "offered", evidence: positive.slice(0, 2) };
  return { status: "not-stated", evidence: [] };
}

export function assessSponsorship(recordsOrRegistry: SponsorRecord[] | SponsorRegistry, company: string, description: string): SponsorshipAssessment {
  const employer = recordsOrRegistry instanceof SponsorRegistry
    ? recordsOrRegistry.find(company)
    : findSponsor(recordsOrRegistry, company);
  const vacancy = classifyVacancySponsorship(description);
  return {
    employer,
    vacancyStatus: vacancy.status,
    vacancyEvidence: vacancy.evidence,
    eligibleForExplicitFilter: employer.verified && vacancy.status === "offered",
  };
}

export function matchesSponsorshipMode(assessment: SponsorshipAssessment, mode: SponsorshipMode): boolean {
  if (mode === "licensed") return assessment.employer.verified;
  if (mode === "explicit") return assessment.eligibleForExplicitFilter;
  return true;
}

export class SponsorRegistry {
  private cache: SponsorCache;
  private cacheFile: string;
  private exactIndex = new Map<string, SponsorRecord[]>();
  private tokenIndex = new Map<string, Array<{ targetNorm: string; record: SponsorRecord }>>();

  constructor(rootDir: string) {
    this.cacheFile = join(rootDir, "data", "sponsor_register.json");
    this.cache = this.load();
    this.rebuildIndex();
  }

  private load(): SponsorCache {
    try {
      if (existsSync(this.cacheFile)) return JSON.parse(readFileSync(this.cacheFile, "utf-8"));
    } catch {}
    return { fetchedAt: "", sourceUrl: CONTENT_API, records: [] };
  }

  private rebuildIndex() {
    this.exactIndex.clear();
    this.tokenIndex.clear();
    const records = this.cache.records || [];
    for (const record of records) {
      const norm = normalizeOrganisation(record.organisation);
      if (!norm) continue;

      let exact = this.exactIndex.get(norm);
      if (!exact) {
        exact = [];
        this.exactIndex.set(norm, exact);
      }
      exact.push(record);

      const firstToken = norm.split(" ")[0];
      if (firstToken && firstToken.length >= 3) {
        let list = this.tokenIndex.get(firstToken);
        if (!list) {
          list = [];
          this.tokenIndex.set(firstToken, list);
        }
        list.push({ targetNorm: norm, record });
      }
    }
  }

  public records(): SponsorRecord[] {
    return this.cache.records || [];
  }

  public status() {
    return { fetchedAt: this.cache.fetchedAt || null, publishedAt: this.cache.publishedAt || null, count: this.records().length, sourceUrl: this.cache.sourceUrl };
  }

  public find(company: string): SponsorMatch {
    const target = normalizeOrganisation(company);
    if (!target) return { verified: false, source: "none" };

    const exact = this.exactIndex.get(target);
    if (exact && exact.length > 0) {
      const best = exact.find(r => /skilled worker/i.test(r.route)) || exact[0];
      return { verified: true, organisation: best.organisation, rating: best.rating, route: best.route, source: "gov-uk-register" };
    }

    const targetTokens = target.split(" ");
    const firstToken = targetTokens[0];
    const prefixSafe = targetTokens.length >= 2 || target.length >= 8;
    if (firstToken && prefixSafe) {
      const candidates = this.tokenIndex.get(firstToken);
      if (candidates) {
        const matches: SponsorRecord[] = [];
        for (const item of candidates) {
          if (item.targetNorm.startsWith(`${target} `) || target.startsWith(`${item.targetNorm} `)) {
            matches.push(item.record);
          }
        }
        if (matches.length > 0) {
          const best = matches.find(r => /skilled worker/i.test(r.route)) || matches[0];
          return { verified: true, organisation: best.organisation, rating: best.rating, route: best.route, source: "gov-uk-register" };
        }
      }
    }

    return { verified: false, source: "none" };
  }

  public async refresh(force = false): Promise<{ refreshed: boolean; error?: string } & ReturnType<SponsorRegistry["status"]>> {
    const age = this.cache.fetchedAt ? Date.now() - new Date(this.cache.fetchedAt).getTime() : Number.POSITIVE_INFINITY;
    if (!force && age < 24 * 60 * 60 * 1000 && this.records().length) return { refreshed: false, ...this.status() };
    try {
      const metadataResponse = await fetch(CONTENT_API, { signal: AbortSignal.timeout(10000) });
      if (!metadataResponse.ok) throw new Error(`GOV.UK metadata returned ${metadataResponse.status}`);
      const metadata: any = await metadataResponse.json();
      const attachment = (metadata.details?.attachments || []).find((item: any) => item.content_type === "text/csv" && item.url);
      if (!attachment?.url) throw new Error("GOV.UK sponsor CSV attachment was not found");
      const csvResponse = await fetch(attachment.url, { signal: AbortSignal.timeout(30000) });
      if (!csvResponse.ok) throw new Error(`GOV.UK sponsor CSV returned ${csvResponse.status}`);
      const records = parseSponsorCsv(await csvResponse.text());
      if (records.length < 1000) throw new Error("GOV.UK sponsor CSV did not contain the expected records");
      this.cache = {
        fetchedAt: new Date().toISOString(),
        publishedAt: metadata.public_updated_at || metadata.updated_at,
        sourceUrl: attachment.url,
        records,
      };
      this.rebuildIndex();
      mkdirSync(dirname(this.cacheFile), { recursive: true });
      writeFileSync(this.cacheFile, JSON.stringify(this.cache), "utf-8");
      return { refreshed: true, ...this.status() };
    } catch (error: any) {
      return { refreshed: false, error: error.message, ...this.status() };
    }
  }
}
