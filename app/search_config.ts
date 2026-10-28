import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
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
    let cfg: SearchConfig = structuredClone(DEFAULT_CONFIG);
    try {
      if (existsSync(this.configFile)) {
        const saved = JSON.parse(readFileSync(this.configFile, "utf-8"));
        cfg = { ...DEFAULT_CONFIG, ...saved, sources: withCoreSources({ ...DEFAULT_CONFIG.sources, ...(saved.sources || {}) }) };
      }
    } catch {}

    // Check candidate config locations (e.g. macOS Application Support or APP_ROOT) to seed missing keys
    const candidatePaths = [
      process.env.AI_JOB_SEARCH_APP_ROOT ? join(process.env.AI_JOB_SEARCH_APP_ROOT, "data", "search_config.json") : null,
      process.env.HOME ? join(process.env.HOME, "Library", "Application Support", "AI Job Search Studio", "data", "search_config.json") : null,
    ].filter(Boolean) as string[];

    for (const seedFile of candidatePaths) {
      if (resolve(seedFile) !== resolve(this.configFile) && existsSync(seedFile)) {
        try {
          const seed = JSON.parse(readFileSync(seedFile, "utf-8"));
          let updated = false;
          if (!cfg.cvLibraryApiKey && seed.cvLibraryApiKey) {
            cfg.cvLibraryApiKey = seed.cvLibraryApiKey;
            updated = true;
          }
          if (!cfg.reedApiKey && seed.reedApiKey) {
            cfg.reedApiKey = seed.reedApiKey;
            updated = true;
          }
          if (!cfg.serpApiKey && seed.serpApiKey) {
            cfg.serpApiKey = seed.serpApiKey;
            updated = true;
          }
          if (!cfg.adzunaAppId && seed.adzunaAppId) {
            cfg.adzunaAppId = seed.adzunaAppId;
            updated = true;
          }
          if (!cfg.adzunaAppKey && seed.adzunaAppKey) {
            cfg.adzunaAppKey = seed.adzunaAppKey;
            updated = true;
          }
          if (updated) {
            mkdirSync(dirname(this.configFile), { recursive: true });
            writeFileSync(this.configFile, JSON.stringify(cfg, null, 2), "utf-8");
          }
        } catch {}
      }
    }

    return cfg;
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

    // Also sync to APP_ROOT/data/search_config.json if running with separate data directory
    const appRoot = process.env.AI_JOB_SEARCH_APP_ROOT;
    if (appRoot) {
      const appConfigFile = join(appRoot, "data", "search_config.json");
      if (resolve(appConfigFile) !== resolve(this.configFile)) {
        try {
          mkdirSync(dirname(appConfigFile), { recursive: true });
          writeFileSync(appConfigFile, JSON.stringify(this.config, null, 2), "utf-8");
        } catch {}
      }
    }

    return this.config;
  }
}
