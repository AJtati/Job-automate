import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
import { createLatexBackbone } from "./resume_engine";

export interface WorkExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  startDate: string;
  endDate: string;
  details?: string;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year?: string;
}

export interface ProjectItem {
  name: string;
  tools: string;
  category?: string;
  bullets: string[];
}

export interface CandidateProfile {
  id: string;
  name: string;
  headline: string;
  summary?: string;
  email: string;
  phone: string;
  location: string;
  postcode: string;
  linkedin: string;
  github: string;
  portfolio?: string;
  visaSponsorshipRequired: boolean;
  targetRoles: string[];
  targetLocations: string[];
  preferredRadiusMiles: number;
  minSalary: number;
  skills: {
    cloud?: string[];
    containers?: string[];
    iac?: string[];
    cicd?: string[];
    monitoring?: string[];
    security?: string[];
    languages?: string[];
    devops?: string[];
    tools?: string[];
    [key: string]: string[] | undefined;
  };
  experience: WorkExperience[];
  projects?: ProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  spokenLanguages?: string[];
  sourceResume?: {
    fileName: string;
    mediaType: string;
    importedAt: string;
    sha256: string;
    text: string;
    originalLatex?: string;
  };
  latexBackbone?: string;
  profileVersion?: number;
  tracker?: Record<string, {
    status: string;
    cvFile?: string;
    coverFile?: string;
    fitRating?: string;
    updatedAt: string;
    notes?: string;
  }>;
  scenarioHistory?: string[];
}

export interface ProfilesData {
  activeProfileId: string;
  profiles: CandidateProfile[];
}

export const EMPTY_PROFILE: CandidateProfile = {
  id: "candidate-profile",
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  postcode: "",
  linkedin: "",
  github: "",
  portfolio: "",
  visaSponsorshipRequired: false,
  targetRoles: [],
  targetLocations: [],
  preferredRadiusMiles: 50,
  minSalary: 0,
  skills: {
    cloud: [],
    devops: [],
    languages: [],
    tools: []
  },
  experience: [],
  education: [],
  certifications: [],
  spokenLanguages: [],
  latexBackbone: createLatexBackbone(),
  profileVersion: 1,
  tracker: {},
  scenarioHistory: []
};

export class ProfilesManager {
  private data: ProfilesData;
  private dataDir: string;
  private profilesFile: string;
  private profilesTemplateFile: string;

  constructor(rootDir = process.env.AI_JOB_SEARCH_ROOT || process.cwd()) {
    this.dataDir = join(rootDir, "data");
    this.profilesFile = join(this.dataDir, "profiles.json");
    this.profilesTemplateFile = join(this.dataDir, "profiles.template.json");
    this.ensureDataDir();
    this.data = this.loadProfiles();
  }

  private ensureDataDir() {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadProfiles(): ProfilesData {
    if (!existsSync(this.profilesFile)) {
      if (existsSync(this.profilesTemplateFile)) {
        try {
          const tmpl = JSON.parse(readFileSync(this.profilesTemplateFile, "utf-8"));
          tmpl.profiles = (tmpl.profiles || []).map((profile: CandidateProfile) => this.normalizeProfile(profile));
          this.saveProfiles(tmpl);
          return tmpl;
        } catch {}
      }

      const initial: ProfilesData = {
        activeProfileId: EMPTY_PROFILE.id,
        profiles: [EMPTY_PROFILE]
      };
      this.saveProfiles(initial);
      return initial;
    }

    try {
      const raw = readFileSync(this.profilesFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.profiles || parsed.profiles.length === 0) {
        parsed.profiles = [EMPTY_PROFILE];
        parsed.activeProfileId = EMPTY_PROFILE.id;
        this.saveProfiles(parsed);
      }
      parsed.profiles = parsed.profiles.map((profile: CandidateProfile) => this.normalizeProfile(profile));
      return parsed;
    } catch (e) {
      console.error("Failed to parse profiles.json, resetting to default:", e);
      const initial: ProfilesData = {
        activeProfileId: EMPTY_PROFILE.id,
        profiles: [EMPTY_PROFILE]
      };
      this.saveProfiles(initial);
      return initial;
    }
  }

  private saveProfiles(data: ProfilesData) {
    this.ensureDataDir();
    const tempFile = `${this.profilesFile}.tmp`;
    writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    renameSync(tempFile, this.profilesFile);
  }

  private normalizeProfile(profile: CandidateProfile): CandidateProfile {
    return {
      ...profile,
      targetRoles: profile.targetRoles || [],
      targetLocations: profile.targetLocations || [],
      skills: {
        ...(profile.skills || {}),
        cloud: profile.skills?.cloud || [],
        containers: profile.skills?.containers || profile.skills?.devops || [],
        devops: profile.skills?.devops || profile.skills?.containers || [],
        iac: profile.skills?.iac || [],
        cicd: profile.skills?.cicd || [],
        monitoring: profile.skills?.monitoring || [],
        security: profile.skills?.security || [],
        languages: profile.skills?.languages || [],
        tools: profile.skills?.tools || [],
      },
      experience: profile.experience || [],
      projects: profile.projects || [],
      education: profile.education || [],
      certifications: profile.certifications || [],
      spokenLanguages: profile.spokenLanguages || ["English"],
      latexBackbone: profile.latexBackbone || createLatexBackbone(),
      profileVersion: profile.profileVersion || 1,
      tracker: profile.tracker || {},
      scenarioHistory: profile.scenarioHistory || [],
    };
  }

  public getAll(): ProfilesData {
    return this.data;
  }

  public getActiveProfile(): CandidateProfile {
    const found = this.data.profiles.find(p => p.id === this.data.activeProfileId);
    if (found) return found;
    return this.data.profiles[0] || EMPTY_PROFILE;
  }

  public setActiveProfile(id: string): CandidateProfile {
    const found = this.data.profiles.find(p => p.id === id);
    if (!found) {
      throw new Error(`Profile with ID '${id}' not found`);
    }
    this.data.activeProfileId = id;
    this.saveProfiles(this.data);
    return found;
  }

  public saveProfile(profile: CandidateProfile): CandidateProfile {
    if (!profile.id) {
      profile.id = profile.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4);
    }
    profile = this.normalizeProfile(profile);
    const idx = this.data.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      this.data.profiles[idx] = { ...this.data.profiles[idx], ...profile };
    } else {
      this.data.profiles.push(profile);
    }
    this.saveProfiles(this.data);
    return profile;
  }

  public deleteProfile(id: string): boolean {
    if (this.data.profiles.length <= 1) {
      throw new Error("Cannot delete the only remaining profile");
    }
    this.data.profiles = this.data.profiles.filter(p => p.id !== id);
    if (this.data.activeProfileId === id) {
      this.data.activeProfileId = this.data.profiles[0].id;
    }
    this.saveProfiles(this.data);
    return true;
  }

  public updateActiveProfileTracker(jobKey: string, update: { status: string; cvFile?: string; coverFile?: string; fitRating?: string; notes?: string }) {
    const profile = this.getActiveProfile();
    if (!profile.tracker) profile.tracker = {};
    profile.tracker[jobKey] = {
      ...profile.tracker[jobKey],
      ...update,
      updatedAt: new Date().toISOString()
    };
    this.saveProfile(profile);
  }

  public calculateDistance(locationStr: string, activeProfile?: CandidateProfile): { miles: number; tag: string; isRemote: boolean } {
    const profile = activeProfile || this.getActiveProfile();
    const loc = (locationStr || "").toLowerCase();
    const profileCity = (profile.location || "").toLowerCase();

    if (loc.includes("remote")) {
      return { miles: 0, tag: "Remote (UK)", isRemote: true };
    }

    // 1. Direct local match against candidate city
    const baseCityName = (profile.location || "").split(",")[0].trim().toLowerCase();
    if (baseCityName && loc.includes(baseCityName)) {
      return { miles: 0, tag: `${profile.location.split(",")[0]} (Local)`, isRemote: false };
    }

    // UK City distance approximations relative to candidate location
    const baseCity = profileCity.includes("hartlepool") ? "hartlepool" :
                     profileCity.includes("manchester") ? "manchester" :
                     profileCity.includes("london") ? "london" :
                     profileCity.includes("leeds") ? "leeds" :
                     profileCity.includes("birmingham") ? "birmingham" :
                     profileCity.includes("edinburgh") ? "edinburgh" :
                     profileCity.includes("glasgow") ? "glasgow" :
                     profileCity.includes("newcastle") ? "newcastle" :
                     profileCity.includes("bristol") ? "bristol" : "uk_general";

    if (baseCity === "hartlepool") {
      if (loc.includes("hartlepool")) return { miles: 0, tag: "Hartlepool (Local)", isRemote: false };
      if (loc.includes("middlesbrough") || loc.includes("stockton") || loc.includes("teesside")) return { miles: 12, tag: "Teesside (~12 mi)", isRemote: false };
      if (loc.includes("durham")) return { miles: 22, tag: "Durham (~22 mi)", isRemote: false };
      if (loc.includes("sunderland")) return { miles: 25, tag: "Sunderland (~25 mi)", isRemote: false };
      if (loc.includes("newcastle") || loc.includes("tyne")) return { miles: 35, tag: "Newcastle (~35 mi)", isRemote: false };
      if (loc.includes("darlington")) return { miles: 28, tag: "Darlington (~28 mi)", isRemote: false };
      if (loc.includes("york")) return { miles: 55, tag: "York (~55 mi)", isRemote: false };
      if (loc.includes("leeds")) return { miles: 70, tag: "Leeds (~70 mi)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 110, tag: "Manchester (~110 mi - Hybrid)", isRemote: false };
      if (loc.includes("edinburgh")) return { miles: 145, tag: "Edinburgh (~145 mi - Hybrid)", isRemote: false };
      if (loc.includes("birmingham")) return { miles: 170, tag: "Birmingham (~170 mi - Hybrid)", isRemote: false };
      if (loc.includes("glasgow")) return { miles: 175, tag: "Glasgow (~175 mi - Hybrid)", isRemote: false };
      if (loc.includes("cambridge")) return { miles: 200, tag: "Cambridge (~200 mi - Hybrid)", isRemote: false };
      if (loc.includes("london")) return { miles: 250, tag: "London (~250 mi - Hybrid)", isRemote: false };
      if (loc.includes("bristol")) return { miles: 260, tag: "Bristol (~260 mi - Hybrid)", isRemote: false };
    } else if (baseCity === "manchester") {
      if (loc.includes("manchester") || loc.includes("salford")) return { miles: 0, tag: "Manchester (Local)", isRemote: false };
      if (loc.includes("liverpool")) return { miles: 35, tag: "Liverpool (~35 mi)", isRemote: false };
      if (loc.includes("leeds")) return { miles: 44, tag: "Leeds (~44 mi)", isRemote: false };
      if (loc.includes("sheffield")) return { miles: 40, tag: "Sheffield (~40 mi)", isRemote: false };
      if (loc.includes("birmingham")) return { miles: 85, tag: "Birmingham (~85 mi - Hybrid)", isRemote: false };
      if (loc.includes("newcastle")) return { miles: 140, tag: "Newcastle (~140 mi - Hybrid)", isRemote: false };
      if (loc.includes("london")) return { miles: 200, tag: "London (~200 mi - Hybrid)", isRemote: false };
      if (loc.includes("edinburgh")) return { miles: 220, tag: "Edinburgh (~220 mi - Hybrid)", isRemote: false };
      if (loc.includes("glasgow")) return { miles: 215, tag: "Glasgow (~215 mi - Hybrid)", isRemote: false };
    } else if (baseCity === "london") {
      if (loc.includes("london")) return { miles: 0, tag: "London (Local)", isRemote: false };
      if (loc.includes("reading")) return { miles: 40, tag: "Reading (~40 mi)", isRemote: false };
      if (loc.includes("cambridge")) return { miles: 55, tag: "Cambridge (~55 mi)", isRemote: false };
      if (loc.includes("oxford")) return { miles: 55, tag: "Oxford (~55 mi)", isRemote: false };
      if (loc.includes("brighton")) return { miles: 55, tag: "Brighton (~55 mi)", isRemote: false };
      if (loc.includes("birmingham")) return { miles: 120, tag: "Birmingham (~120 mi - Hybrid)", isRemote: false };
      if (loc.includes("bristol")) return { miles: 120, tag: "Bristol (~120 mi - Hybrid)", isRemote: false };
      if (loc.includes("leeds")) return { miles: 195, tag: "Leeds (~195 mi - Hybrid)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 200, tag: "Manchester (~200 mi - Hybrid)", isRemote: false };
      if (loc.includes("newcastle")) return { miles: 280, tag: "Newcastle (~280 mi - Hybrid)", isRemote: false };
      if (loc.includes("edinburgh")) return { miles: 400, tag: "Edinburgh (~400 mi - Travel)", isRemote: false };
    } else if (baseCity === "leeds") {
      if (loc.includes("leeds")) return { miles: 0, tag: "Leeds (Local)", isRemote: false };
      if (loc.includes("york")) return { miles: 25, tag: "York (~25 mi)", isRemote: false };
      if (loc.includes("sheffield")) return { miles: 35, tag: "Sheffield (~35 mi)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 44, tag: "Manchester (~44 mi)", isRemote: false };
      if (loc.includes("liverpool")) return { miles: 75, tag: "Liverpool (~75 mi)", isRemote: false };
      if (loc.includes("newcastle")) return { miles: 95, tag: "Newcastle (~95 mi)", isRemote: false };
      if (loc.includes("birmingham")) return { miles: 115, tag: "Birmingham (~115 mi - Hybrid)", isRemote: false };
      if (loc.includes("london")) return { miles: 195, tag: "London (~195 mi - Hybrid)", isRemote: false };
      if (loc.includes("edinburgh")) return { miles: 220, tag: "Edinburgh (~220 mi - Hybrid)", isRemote: false };
    } else if (baseCity === "newcastle") {
      if (loc.includes("newcastle") || loc.includes("tyne")) return { miles: 0, tag: "Newcastle (Local)", isRemote: false };
      if (loc.includes("sunderland")) return { miles: 12, tag: "Sunderland (~12 mi)", isRemote: false };
      if (loc.includes("durham")) return { miles: 18, tag: "Durham (~18 mi)", isRemote: false };
      if (loc.includes("middlesbrough") || loc.includes("teesside")) return { miles: 38, tag: "Teesside (~38 mi)", isRemote: false };
      if (loc.includes("hartlepool")) return { miles: 35, tag: "Hartlepool (~35 mi)", isRemote: false };
      if (loc.includes("leeds")) return { miles: 95, tag: "Leeds (~95 mi)", isRemote: false };
      if (loc.includes("edinburgh")) return { miles: 120, tag: "Edinburgh (~120 mi - Hybrid)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 140, tag: "Manchester (~140 mi - Hybrid)", isRemote: false };
      if (loc.includes("glasgow")) return { miles: 150, tag: "Glasgow (~150 mi - Hybrid)", isRemote: false };
      if (loc.includes("london")) return { miles: 280, tag: "London (~280 mi - Hybrid)", isRemote: false };
    } else if (baseCity === "edinburgh") {
      if (loc.includes("edinburgh")) return { miles: 0, tag: "Edinburgh (Local)", isRemote: false };
      if (loc.includes("glasgow")) return { miles: 47, tag: "Glasgow (~47 mi)", isRemote: false };
      if (loc.includes("dundee")) return { miles: 60, tag: "Dundee (~60 mi)", isRemote: false };
      if (loc.includes("newcastle")) return { miles: 120, tag: "Newcastle (~120 mi)", isRemote: false };
      if (loc.includes("aberdeen")) return { miles: 125, tag: "Aberdeen (~125 mi)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 220, tag: "Manchester (~220 mi - Hybrid)", isRemote: false };
      if (loc.includes("london")) return { miles: 400, tag: "London (~400 mi - Hybrid)", isRemote: false };
    } else if (baseCity === "glasgow") {
      if (loc.includes("glasgow")) return { miles: 0, tag: "Glasgow (Local)", isRemote: false };
      if (loc.includes("edinburgh")) return { miles: 47, tag: "Edinburgh (~47 mi)", isRemote: false };
      if (loc.includes("stirling")) return { miles: 28, tag: "Stirling (~28 mi)", isRemote: false };
      if (loc.includes("newcastle")) return { miles: 150, tag: "Newcastle (~150 mi)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 215, tag: "Manchester (~215 mi - Hybrid)", isRemote: false };
      if (loc.includes("london")) return { miles: 400, tag: "London (~400 mi - Hybrid)", isRemote: false };
    } else if (baseCity === "birmingham") {
      if (loc.includes("birmingham")) return { miles: 0, tag: "Birmingham (Local)", isRemote: false };
      if (loc.includes("coventry")) return { miles: 20, tag: "Coventry (~20 mi)", isRemote: false };
      if (loc.includes("wolverhampton")) return { miles: 18, tag: "Wolverhampton (~18 mi)", isRemote: false };
      if (loc.includes("leicester")) return { miles: 45, tag: "Leicester (~45 mi)", isRemote: false };
      if (loc.includes("nottingham")) return { miles: 50, tag: "Nottingham (~50 mi)", isRemote: false };
      if (loc.includes("manchester")) return { miles: 85, tag: "Manchester (~85 mi)", isRemote: false };
      if (loc.includes("leeds")) return { miles: 115, tag: "Leeds (~115 mi)", isRemote: false };
      if (loc.includes("london")) return { miles: 120, tag: "London (~120 mi)", isRemote: false };
      if (loc.includes("bristol")) return { miles: 90, tag: "Bristol (~90 mi)", isRemote: false };
    }

    return { miles: 60, tag: locationStr || "United Kingdom", isRemote: false };
  }
}
