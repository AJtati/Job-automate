import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { normalizeOrganisation } from "./sponsorship";

export interface NewSponsorRecord {
  organisation: string;
  town?: string;
  industry?: string;
  date: string; // ISO date string e.g. "2026-10-30T00:00:00.000Z"
}

export interface NewSponsorMatch {
  isNew: boolean;
  organisation: string;
  town?: string;
  industry?: string;
  date: string;
  formattedDate: string;
}

interface NewSponsorCache {
  fetchedAt: string;
  sourceUrl: string;
  records: NewSponsorRecord[];
}

const NEW_SPONSORS_URL = "https://uktiersponsorslist.co.uk/sponsors-list/new";

const GENERIC_SINGLE_WORDS = new Set([
  "people", "care", "first", "point", "prime", "smart", "total", "focus", "reach",
  "green", "blue", "data", "tech", "digital", "systems", "solutions", "services",
  "media", "consulting", "health", "recruitment", "engineering", "network", "cloud",
]);

export class NewSponsorsRegistry {
  private cache: NewSponsorCache;
  private cacheFile: string;
  private exactIndex = new Map<string, NewSponsorRecord>();
  private tokenIndex = new Map<string, Array<{ targetNorm: string; record: NewSponsorRecord }>>();
  private isRefreshing = false;

  constructor(rootDir: string) {
    this.cacheFile = join(rootDir, "data", "new_sponsors.json");
    this.cache = this.load();
    this.rebuildIndex();
  }

  private load(): NewSponsorCache {
    try {
      if (existsSync(this.cacheFile)) {
        return JSON.parse(readFileSync(this.cacheFile, "utf-8"));
      }
    } catch (e) {
      console.error("[NewSponsorsRegistry] Failed to read cache:", e);
    }
    return { fetchedAt: "", sourceUrl: NEW_SPONSORS_URL, records: [] };
  }

  private save() {
    try {
      mkdirSync(dirname(this.cacheFile), { recursive: true });
      writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (e) {
      console.error("[NewSponsorsRegistry] Failed to save cache:", e);
    }
  }

  private rebuildIndex() {
    this.exactIndex.clear();
    this.tokenIndex.clear();
    const records = this.cache.records || [];
    for (const record of records) {
      const norm = normalizeOrganisation(record.organisation);
      if (!norm) continue;

      this.exactIndex.set(norm, record);

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

  public records(): NewSponsorRecord[] {
    return this.cache.records || [];
  }

  public status() {
    return {
      fetchedAt: this.cache.fetchedAt || null,
      count: this.records().length,
      sourceUrl: this.cache.sourceUrl,
    };
  }

  public find(company: string): NewSponsorMatch | null {
    if (!company) return null;
    const target = normalizeOrganisation(company);
    if (!target) return null;

    // 1. Exact normalized match
    const exact = this.exactIndex.get(target);
    if (exact) {
      return this.formatMatch(exact);
    }

    // 2. Prefix & token-based fuzzy matching
    const targetTokens = target.split(" ");
    const firstToken = targetTokens[0];
    const isGenericSingle = targetTokens.length === 1 && GENERIC_SINGLE_WORDS.has(target);
    const prefixSafe = !isGenericSingle && (targetTokens.length >= 2 || target.length >= 5);
    if (firstToken && prefixSafe) {
      const candidates = this.tokenIndex.get(firstToken);
      if (candidates && candidates.length > 0) {
        for (const item of candidates) {
          if (
            item.targetNorm.startsWith(`${target} `) ||
            target.startsWith(`${item.targetNorm} `) ||
            item.targetNorm === target
          ) {
            return this.formatMatch(item.record);
          }
        }
      }
    }

    return null;
  }

  private formatMatch(record: NewSponsorRecord): NewSponsorMatch {
    let formattedDate = "Recent (Last 30 Days)";
    try {
      if (record.date) {
        const dt = new Date(record.date);
        if (!isNaN(dt.getTime())) {
          formattedDate = dt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        }
      }
    } catch {}

    return {
      isNew: true,
      organisation: record.organisation,
      town: record.town,
      industry: record.industry,
      date: record.date,
      formattedDate,
    };
  }

  public async refresh(force = false): Promise<{ count: number; fetchedAt: string; error?: string }> {
    if (this.isRefreshing) {
      return { count: this.records().length, fetchedAt: this.cache.fetchedAt };
    }

    // Only refresh once per 24h unless forced
    if (!force && this.cache.fetchedAt) {
      const ageMs = Date.now() - new Date(this.cache.fetchedAt).getTime();
      if (ageMs < 24 * 3600 * 1000 && this.cache.records.length > 0) {
        return { count: this.records().length, fetchedAt: this.cache.fetchedAt };
      }
    }

    this.isRefreshing = true;
    try {
      console.log("[NewSponsorsRegistry] Fetching newly approved sponsors from uktiersponsorslist.co.uk...");
      const pageBatches = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25],
        [26, 27, 28, 29, 30],
      ];

      const allRecords: NewSponsorRecord[] = [];
      const seenOrgs = new Set<string>();

      for (const batch of pageBatches) {
        const responses = await Promise.all(
          batch.map(async (page) => {
            try {
              const res = await fetch(`${NEW_SPONSORS_URL}?page=${page}`, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
                  Accept: "text/html,application/xhtml+xml",
                },
                signal: AbortSignal.timeout(8000),
              });
              return res.ok ? await res.text() : "";
            } catch {
              return "";
            }
          })
        );

        for (const html of responses) {
          if (!html) continue;
          // Regex to parse Next.js RSC serialized sponsor payloads
          const matches = [
            ...html.matchAll(
              /\\\"organisation_name\\\":\\\"([^\\\"]+)\\\"(?:[^}]*?\\\"town\\\":\\\"([^\\\"]*)\\\")?(?:[^}]*?\\\"industry\\\":\\\"([^\\\"]*)\\\")?[^}]*?\\\"date\\\":\\\"([^\\\"]+)\\\"/g
            ),
          ];

          for (const m of matches) {
            const org = m[1]?.trim();
            const town = m[2]?.trim() || "";
            const industry = m[3]?.trim() || "";
            const date = m[4]?.trim();
            if (!org || !date) continue;

            const norm = normalizeOrganisation(org);
            if (!norm || seenOrgs.has(norm)) continue;
            seenOrgs.add(norm);

            allRecords.push({
              organisation: org,
              town,
              industry,
              date,
            });
          }
        }
      }

      if (allRecords.length > 0) {
        this.cache = {
          fetchedAt: new Date().toISOString(),
          sourceUrl: NEW_SPONSORS_URL,
          records: allRecords,
        };
        this.save();
        this.rebuildIndex();
        console.log(`[NewSponsorsRegistry] Successfully loaded ${allRecords.length} newly approved sponsors (last 30 days).`);
        return { count: allRecords.length, fetchedAt: this.cache.fetchedAt };
      } else {
        return { count: this.records().length, fetchedAt: this.cache.fetchedAt, error: "No sponsor records found" };
      }
    } catch (err: any) {
      console.error("[NewSponsorsRegistry] Refresh failed:", err);
      return { count: this.records().length, fetchedAt: this.cache.fetchedAt, error: err.message };
    } finally {
      this.isRefreshing = false;
    }
  }
}
