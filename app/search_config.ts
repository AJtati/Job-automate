import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { SponsorshipMode } from "./sponsorship";

export interface SearchConfig {
  sources: {
    linkedin: boolean;
    freehire: boolean;
    cvLibrary: boolean;
    reed: boolean;
    googleJobs: boolean;
    adzuna: boolean;
    jobicy: boolean;
    arbeitnow: boolean;
    remotive: boolean;
  };
  sponsorshipMode: SponsorshipMode;
  cvLibraryApiKey?: string;
  reedApiKey?: string;
  serpApiKey?: string;
  adzunaAppId?: string;
  adzunaAppKey?: string;
}

const DEFAULT_CONFIG: SearchConfig = {
  sources: {
    linkedin: true,
    freehire: true,
    cvLibrary: false,
    reed: false,
    googleJobs: false,
    adzuna: false,
    jobicy: true,
    arbeitnow: false,
    remotive: true,
  },
  sponsorshipMode: "all",
};

function withCoreSources(sources: SearchConfig["sources"]): SearchConfig["sources"] {
  return { ...sources, linkedin: true, freehire: true };
}

export class SearchConfigManager {
  private configFile: string;
  private config: SearchConfig;

  constructor(rootDir: string) {
    this.configFile = join(rootDir, "data", "search_config.json");
    this.config = this.load();
  }

  private load(): SearchConfig {
    try {
      if (existsSync(this.configFile)) {
        const saved = JSON.parse(readFileSync(this.configFile, "utf-8"));
        return { ...DEFAULT_CONFIG, ...saved, sources: withCoreSources({ ...DEFAULT_CONFIG.sources, ...(saved.sources || {}) }) };
      }
    } catch {}
    return structuredClone(DEFAULT_CONFIG);
  }

  public get(): SearchConfig {
    return this.config;
  }

  public getPublic() {
    const { cvLibraryApiKey, reedApiKey, serpApiKey, adzunaAppId, adzunaAppKey, ...safe } = this.config;
    return {
      ...safe,
      hasCvLibraryKey: Boolean(cvLibraryApiKey),
      hasReedKey: Boolean(reedApiKey),
      hasSerpApiKey: Boolean(serpApiKey),
      hasAdzunaCredentials: Boolean(adzunaAppId && adzunaAppKey),
    };
  }

  public save(update: Partial<SearchConfig>): SearchConfig {
    const clean: Partial<SearchConfig> = { ...update };
    if (!clean.cvLibraryApiKey) delete clean.cvLibraryApiKey;
    if (!clean.reedApiKey) delete clean.reedApiKey;
    if (!clean.serpApiKey) delete clean.serpApiKey;
    if (!clean.adzunaAppId) delete clean.adzunaAppId;
    if (!clean.adzunaAppKey) delete clean.adzunaAppKey;
    this.config = {
      ...this.config,
      ...clean,
      sources: withCoreSources({ ...this.config.sources, ...(update.sources || {}) }),
    };
    mkdirSync(dirname(this.configFile), { recursive: true });
    writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), "utf-8");
    return this.config;
  }
}
