import { serve } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, copyFileSync, accessSync, constants } from "fs";
import { join, resolve, relative, basename, dirname, isAbsolute } from "path";
import { tmpdir, homedir } from "os";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { ProfilesManager, CandidateProfile, type ProfileScheduleConfig } from "./profiles_manager";
import { AIService } from "./ai_service";
import { analyzeApplication, analyzeTailoredResume } from "./application_engine";
import { createLatexBackbone, LANGUAGE_PACKS, detectLanguageDeterministically, type SupportedLanguage } from "./resume_engine";
import { parseResumeDeterministically } from "./resume_parser";
import { SchedulerService, computeNextRun, type ScrapeExecutionResult } from "./scheduler_service";
import { SponsorRegistry, assessSponsorship, matchesSponsorshipMode, type SponsorshipMode } from "./sponsorship";
import { SearchConfigManager } from "./search_config";
import {
  detectCandidateCountry, detectJobCountry, type CandidateCountryInfo,
  searchAdzuna, searchArbeitnow, searchCvLibrary, searchGoogleJobs,
  searchJobicy, searchReed, searchRemotive, searchTheMuse,
  searchGreenhouse, searchLever, searchAshby,
  type SourceJob, type SourceReport,
} from "./job_sources";

const PORT = Number(process.env.PORT || process.env.AI_JOB_SEARCH_PORT || 3333);
const APP_ROOT = process.env.AI_JOB_SEARCH_APP_ROOT || process.cwd();
const ROOT_DIR = process.env.AI_JOB_SEARCH_ROOT || process.env.AI_JOB_SEARCH_DATA_ROOT || process.cwd();
const APP_PROTOCOL_VERSION = "2026-10-27.2";
const INSTANCE_TOKEN = process.env.AI_JOB_SEARCH_INSTANCE_TOKEN || "development";
const BUN_EXECUTABLE = process.execPath;
const SEEN_JOBS_FILE = join(ROOT_DIR, "job_scraper", "seen_jobs.json");
const TRACKER_FILE = join(ROOT_DIR, "job_search_tracker.csv");
const LAST_SEARCH_STATUS_FILE = join(ROOT_DIR, "data", "last_search_status.json");

const profilesManager = new ProfilesManager(ROOT_DIR);
const aiService = new AIService();
const sponsorRegistry = new SponsorRegistry(ROOT_DIR);
const searchConfigManager = new SearchConfigManager(ROOT_DIR);

mkdirSync(join(ROOT_DIR, "job_scraper"), { recursive: true });
mkdirSync(join(ROOT_DIR, "cv"), { recursive: true });
mkdirSync(join(ROOT_DIR, "cover_letters"), { recursive: true });
mkdirSync(join(ROOT_DIR, "data"), { recursive: true });

function getRuntimeDiagnostics() {
  const linkedinPath = join(APP_ROOT, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
  const freehirePath = join(APP_ROOT, ".agents", "skills", "freehire-search", "cli", "src", "cli.ts");
  let dataWritable = true;
  try { accessSync(ROOT_DIR, constants.W_OK); } catch { dataWritable = false; }
  const issues: Array<{ code: string; message: string; guidance: string }> = [];
  if (!existsSync(linkedinPath)) issues.push({ code: "LINKEDIN_FILES_MISSING", message: "The built-in LinkedIn scraper files are missing.", guidance: "Reinstall the latest app package. Your candidate data is stored separately and will be preserved." });
  if (!existsSync(freehirePath)) issues.push({ code: "ATS_FILES_MISSING", message: "The built-in Direct ATS scraper files are missing.", guidance: "Reinstall the latest app package. Your candidate data is stored separately and will be preserved." });
  if (!dataWritable) issues.push({ code: "DATA_NOT_WRITABLE", message: "The app cannot write to its data folder.", guidance: `Grant write permission to ${ROOT_DIR} or choose a writable AI_JOB_SEARCH_ROOT.` });
  const profileWarning = profilesManager.getLoadWarning();
  if (profileWarning) issues.push({ code: "PROFILE_DATA_RECOVERED", message: profileWarning, guidance: "Open the recovery copy to repair or re-import the profile. The app has created a new empty profile so it can still start." });
  return {
    healthy: issues.length === 0,
    protocolVersion: APP_PROTOCOL_VERSION,
    instanceToken: INSTANCE_TOKEN,
    platform: process.platform,
    runtime: `Bun ${Bun.version}`,
    appRoot: APP_ROOT,
    dataRoot: ROOT_DIR,
    sources: { linkedin: existsSync(linkedinPath), directAts: existsSync(freehirePath) },
    issues,
  };
}

function readLastSearchStatus(): any | null {
  try { return existsSync(LAST_SEARCH_STATUS_FILE) ? JSON.parse(readFileSync(LAST_SEARCH_STATUS_FILE, "utf-8")) : null; } catch { return null; }
}

function isAllowedWorkspacePath(path: string): boolean {
  const candidate = resolve(ROOT_DIR, path);
  const allowed = ["cv", "cover_letters", "documents", "templates"].map(folder => resolve(ROOT_DIR, folder));
  return allowed.some(folder => {
    const child = relative(folder, candidate);
    return child === "" || (!child.startsWith("..") && !isAbsolute(child));
  });
}

function safeSlug(value: string): string {
  return (value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "item";
}

function profileEvidenceText(profile: CandidateProfile): string {
  return [
    profile.sourceResume?.text || "",
    profile.summary || "",
    Object.values(profile.skills || {}).flat().join(" "),
    ...(profile.experience || []).flatMap(item => [item.role, item.company, ...(item.bullets || [])]),
    ...(profile.projects || []).flatMap(item => [item.name, item.tools, ...(item.bullets || [])]),
  ].join("\n").toLowerCase();
}

function makeResumeConcise(latex: string): string {
  let bulletCount = 0;
  return latex.split("\n").filter(line => {
    if (line.includes("\\resumeSubheading") || line.includes("\\resumeProjectHeading")) bulletCount = 0;
    if (line.includes("\\resumeItem{")) {
      bulletCount += 1;
      return bulletCount <= 2;
    }
    return true;
  }).join("\n");
}

function removeGroundedTerm(latex: string, term: string): string {
  const needle = term.toLowerCase();
  return latex.split("\n").filter(line => {
    if (!line.toLowerCase().includes(needle)) return true;
    return !(line.includes("\\resumeItem{") || (!line.startsWith("\\") && line.trim().length > 0));
  }).join("\n");
}

function openSystemPath(filePath: string, reveal = false) {
  if (process.platform === "darwin") return spawnSync("open", reveal ? ["-R", filePath] : [filePath]);
  if (process.platform === "win32") return spawnSync("explorer.exe", reveal ? [`/select,${filePath}`] : [filePath]);
  return spawnSync("xdg-open", [reveal ? dirname(filePath) : filePath]);
}

function extractPdfText(bytes: Uint8Array, fileName: string): string {
  const workDir = mkdtempSync(join(tmpdir(), "ai-job-search-pdf-"));
  const input = join(workDir, basename(fileName || "resume.pdf"));
  writeFileSync(input, bytes);
  try {
    // 1. Native macOS PDFKit (works natively on 100% of Macs with zero third-party dependencies)
    if (process.platform === "darwin") {
      const swiftCode = `import Foundation; import PDFKit; if CommandLine.arguments.count > 1, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) { for i in 0..<doc.pageCount { if let p = doc.page(at: i), let s = p.string { print(s) } } }`;
      const swiftRes = spawnSync("swift", ["-e", swiftCode, input], { encoding: "utf-8", timeout: 15000 });
      if (swiftRes.status === 0 && swiftRes.stdout.trim().length > 30) {
        return swiftRes.stdout;
      }
    }

    // 2. pdftotext (Poppler CLI)
    const pdftotext = spawnSync("pdftotext", ["-layout", "-enc", "UTF-8", input, "-"], { encoding: "utf-8" });
    if (pdftotext.status === 0 && pdftotext.stdout.trim()) return pdftotext.stdout;

    // 3. python / python3 with pypdf or pdfminer
    for (const python of process.platform === "win32" ? ["python", "py"] : ["python3", "python"]) {
      const script = "import sys; from pypdf import PdfReader; print('\\n'.join((p.extract_text() or '') for p in PdfReader(sys.argv[1]).pages))";
      const result = spawnSync(python, ["-c", script, input], { encoding: "utf-8" });
      if (result.status === 0 && result.stdout.trim()) return result.stdout;
    }
    throw new Error("PDF text extraction is unavailable. Install pypdf or Poppler pdftotext, then retry.");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function readResumeRequest(req: Request): Promise<{ text: string; fileName: string; mediaType: string; previewOnly: boolean; targetProfileId?: string }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const pastedText = String(form.get("resumeText") || "").trim();
    const previewOnly = String(form.get("previewOnly") || "false") === "true";
    const targetProfileId = String(form.get("targetProfileId") || "").trim() || undefined;
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      return {
        text: isPdf ? extractPdfText(bytes, file.name) : new TextDecoder("utf-8", { fatal: false }).decode(bytes),
        fileName: file.name,
        mediaType: file.type || "text/plain",
        previewOnly,
        targetProfileId,
      };
    }
    return { text: pastedText, fileName: "pasted-resume.txt", mediaType: "text/plain", previewOnly, targetProfileId };
  }
  const body = await req.json() as any;
  return {
    text: String(body.resumeText || body.text || ""),
    fileName: String(body.fileName || "pasted-resume.txt"),
    mediaType: String(body.mediaType || "text/plain"),
    previewOnly: Boolean(body.previewOnly),
    targetProfileId: body.targetProfileId ? String(body.targetProfileId).trim() : undefined,
  };
}

// Distance matrix from Hartlepool (approx road miles)
function getDistanceFromHartlepool(locationStr: string): { miles: number; tag: string; isRemote: boolean } {
  const loc = (locationStr || "").toLowerCase();
  if (loc.includes("remote")) return { miles: 0, tag: "Remote (UK)", isRemote: true };
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
  return { miles: 50, tag: locationStr || "United Kingdom", isRemote: false };
}

function checkSponsor(company: string, description = "") {
  const assessment = assessSponsorship(sponsorRegistry, company, description);
  return {
    verified: assessment.employer.verified,
    label: assessment.employer.verified
      ? [assessment.employer.rating, assessment.employer.route].filter(Boolean).join(" · ")
      : "Not found on cached GOV.UK register",
    badge: assessment.employer.verified ? "Licensed employer" : "Not verified",
    assessment,
  };
}

interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  url: string;
  location: string;
  postedDate?: string;
  description?: string;
  summary?: string;
  skills?: string[];
  salary?: string;
  portal: string;
  source: string;
}

function isJobRelevantToProfile(item: any, profile: CandidateProfile): boolean {
  if (!item || !profile) return false;

  // If a job was explicitly tagged with a different candidate's profileId, isolate it
  if (item.profileId && item.profileId !== profile.id) {
    return false;
  }

  // Geographic / Country Filter:
  // Isolate cross-country non-remote jobs unless candidate explicitly targeted that country/city
  const candidateCountry = detectCandidateCountry(profile.location, profile.targetLocations);
  const targetLocationsCombined = (profile.targetLocations || []).join(" ").toLowerCase();
  const jobCountry = detectJobCountry(item);

  if (!jobCountry.isRemote) {
    if (candidateCountry.isUk) {
      // Candidate is in UK: reject any non-remote job located outside the UK (India, Canada, US, Germany, etc.)
      // unless candidate explicitly included that country or city in targetLocations
      if (!jobCountry.isUk) {
        const countryTerm = (jobCountry.countryName || "").toLowerCase();
        const targeted = countryTerm && countryTerm !== "unknown" && targetLocationsCombined.includes(countryTerm);
        if (!targeted) {
          return false;
        }
      }
    } else {
      // Candidate is outside UK (e.g. Germany, India, US):
      // Reject jobs located in other countries unless candidate explicitly targeted that country
      if (jobCountry.countryName !== "Unknown" && jobCountry.countryName !== candidateCountry.countryName) {
        const countryTerm = (jobCountry.countryName || "").toLowerCase();
        const targeted = countryTerm && targetLocationsCombined.includes(countryTerm);
        if (!targeted) {
          return false;
        }
      }
    }
  } else {
    // If job is remote, check if it specifies another country's restriction
    const jobLoc = (item.location || "").toLowerCase();
    if (!candidateCountry.isUk && /uk\s*only|united kingdom only|must reside in the uk/i.test(jobLoc)) {
      return false;
    }
    if (candidateCountry.isUk && /germany only|eu only|must reside in the eu|us only|india only/i.test(jobLoc)) {
      return false;
    }
  }

  const title = (item.title || "").toLowerCase();
  const summary = (item.summary || "").toLowerCase();
  const fullJd = (item.full_jd || "").toLowerCase();
  const skillsText = (item.key_skills || []).join(" ").toLowerCase();
  const text = `${title} ${summary} ${fullJd} ${skillsText}`;

  // Analyze candidate's target domain from headline, target roles, and profile skills
  const profileHeadline = (profile.headline || "").toLowerCase();
  const targetRoles = (profile.targetRoles || []).map(r => r.toLowerCase().trim()).filter(Boolean);
  const profileRolesText = `${profileHeadline} ${targetRoles.join(" ")}`;

  // Domain flags for candidate
  const isCandidateDynamics = /dynamics|power\s*platform|dataverse|power\s*apps|power\s*automate|d365|\bcrm\b/.test(profileRolesText);
  const isCandidateDevops = /devops|platform\s*engineer|sre|site\s*reliability|infrastructure|kubernetes|terraform|cloud\s*engineer/.test(profileRolesText);
  const isCandidateQA = /\bqa\b|quality\s*assurance|tester|test\s*engineer|automation\s*engineer|sdet/.test(profileRolesText);

  // 1. Strict Domain Segregation: DYNAMICS / POWER PLATFORM / CRM
  if (isCandidateDynamics && !isCandidateDevops && !isCandidateQA) {
    // Negative filter: Disallow pure DevOps, SRE, Platform, QA, Infrastructure, or generic Hardware roles
    const isDevopsOrInfra = /platform\s*engineer|sre\b|site\s*reliability|kubernetes|terraform|devops|cloud\s*engineer|infrastructure\s*engineer/.test(title);
    const hasDynamicsInTitle = /dynamics|d365|power\s*platform|power\s*apps|powerapps|power\s*automate|dataverse|\bcrm\b/i.test(title);
    if (isDevopsOrInfra && !hasDynamicsInTitle) {
      return false;
    }
    if (/\bqa\b|tester\b|test\s*automation|sdet\b/.test(title) && !hasDynamicsInTitle) {
      return false;
    }

    // Positive filter: Must have Dynamics / Power Platform / Dataverse / CRM in title, or strong match in JD with relevant title
    if (hasDynamicsInTitle) return true;

    // If title has developer / consultant / analyst, check if JD is heavily Dynamics 365 or Power Platform
    const isDevTitle = /developer|consultant|specialist|architect|engineer|analyst/.test(title);
    const hasStrongDynamicsJd = /dynamics\s*365|dynamics\s*crm|power\s*platform|dataverse/.test(text);
    return isDevTitle && hasStrongDynamicsJd;
  }

  // 2. Strict Domain Segregation: DEVOPS / PLATFORM / SRE / CLOUD INFRASTRUCTURE
  if (isCandidateDevops && !isCandidateDynamics && !isCandidateQA) {
    // Negative filter: Disallow Dynamics, CRM, Power Apps, QA, Salesforce
    if (/dynamics\s*365|dynamics\s*crm|power\s*platform|power\s*apps|power\s*automate|d365|\bsalesforce\b/.test(title)) {
      return false;
    }
    if (/\bqa\b|tester\b|test\s*automation|sdet\b/.test(title)) {
      return false;
    }

    // Positive filter: Must match DevOps, Platform, Cloud, Infrastructure, SRE
    const hasDevopsInTitle = /devops|platform\s*engineer|sre\b|site\s*reliability|cloud\s*engineer|infrastructure|kubernetes|systems\s*engineer|reliability\s*engineer/.test(title);
    if (hasDevopsInTitle) return true;

    // Or title has engineer/developer and key skills are kubernetes/terraform/aws/docker/devops
    const isTechRole = /engineer|architect|lead|specialist/.test(title);
    const hasDevopsSkills = (item.key_skills || []).some((k: string) => /kubernetes|terraform|aws|docker|ci\/cd|devops/i.test(k));
    return isTechRole && hasDevopsSkills;
  }

  // 3. Strict Domain Segregation: QA / TEST AUTOMATION
  if (isCandidateQA && !isCandidateDevops && !isCandidateDynamics) {
    if (/devops|platform\s*engineer|sre\b|dynamics\s*365|dynamics\s*crm|power\s*platform/.test(title)) {
      return false;
    }
    return /\bqa\b|quality\s*assurance|tester\b|test\s*engineer|automation\s*engineer|sdet\b|software\s*testing/i.test(title);
  }

  // 4. Universal target roles matching for other disciplines (e.g. Frontend, Data/ML, Mobile, Security, Product, etc.)
  if (targetRoles.length > 0 || profileHeadline) {
    // Cross-domain negative guards: do not leak pure DevOps, Dynamics, or QA to other disciplines
    if (!isCandidateDevops && /kubernetes|terraform|platform\s*engineer|sre\b|site\s*reliability|cloud\s*infrastructure/.test(title)) {
      return false;
    }
    if (!isCandidateDynamics && /dynamics\s*365|dynamics\s*crm|power\s*platform|power\s*apps|power\s*automate|dataverse|\bd365\b/.test(title)) {
      return false;
    }
    if (!isCandidateQA && /\bqa\b|tester\b|test\s*automation|sdet\b/.test(title)) {
      return false;
    }

    const GENERIC_ROLE_WORDS = new Set([
      "senior", "junior", "lead", "principal", "staff", "head", "director", "manager",
      "engineer", "developer", "consultant", "specialist", "analyst", "architect",
      "officer", "associate", "intern", "graduate", "executive", "expert", "professional",
      "with", "from", "into", "your", "full", "time", "part"
    ]);

    const rolesToMatch = [...targetRoles];
    if (profileHeadline) rolesToMatch.push(profileHeadline);

    return rolesToMatch.some(role => {
      const cleanRole = role.toLowerCase().trim();
      if (!cleanRole) return false;
      if (title.includes(cleanRole)) return true;

      const allWords = cleanRole.replace(/[^a-z0-9]/g, " ").trim().split(/\s+/).filter(w => w.length > 2);
      const domainWords = allWords.filter(w => !GENERIC_ROLE_WORDS.has(w));

      if (domainWords.length > 0) {
        // At least one non-generic domain keyword must be found in the job title
        const hasDomainWord = domainWords.some(dw => title.includes(dw));
        if (!hasDomainWord) return false;

        const matchCount = allWords.filter(w => title.includes(w)).length;
        return matchCount >= Math.min(2, allWords.length);
      }

      return title.includes(cleanRole);
    });
  }

  return false;
}

function ingestDiscoveredJob(
  seen: Record<string, any>,
  job: DiscoveredJob,
  profile: CandidateProfile,
  sponsorshipMode: SponsorshipMode,
): "added" | "enriched" | "filtered" | "unchanged" {
  const description = String(job.description || "").trim();
  const sponsorship = assessSponsorship(sponsorRegistry, job.company, description);
  if (!matchesSponsorshipMode(sponsorship, sponsorshipMode)) return "filtered";

  const dedupKey = getJobDedupKey(job);
  const existingKey = Object.keys(seen).find(key => getJobDedupKey(seen[key]) === dedupKey);
  if (existingKey) {
    if (job.source === "manual" && !seen[existingKey].profileId) {
      seen[existingKey].profileId = profile.id;
    }
    if (description && (!seen[existingKey].full_jd || seen[existingKey].full_jd.length < description.length)) {
      seen[existingKey].full_jd = description;
      if (job.skills?.length) seen[existingKey].key_skills = job.skills.slice(0, 8);
      return "enriched";
    }
    return "unchanged";
  }

  const analysis = description.length >= 80
    ? analyzeApplication(profile, { company: job.company, role: job.title, location: job.location, fullJd: description, keySkills: job.skills || [] })
    : null;
  seen[job.id] = {
    ...(job.source === "manual" ? { profileId: profile.id } : {}),
    title: job.title,
    company: job.company,
    url: job.url,
    location: job.location,
    posted_date: job.postedDate || new Date().toISOString().slice(0, 10),
    first_seen: new Date().toISOString().slice(0, 10),
    fit: analysis?.verdict === "strong" ? "high" : analysis?.verdict === "possible" ? "medium" : "unscored",
    fit_score: analysis?.overallScore || 0,
    summary: job.summary || description.slice(0, 280),
    full_jd: description,
    key_skills: (job.skills || []).slice(0, 8),
    salary: job.salary || "Not advertised",
    status: "new",
    portal: job.portal,
    source: job.source,
  };
  return "added";
}

function readTracker(activeProfile?: CandidateProfile): Record<string, any> {
  const map: Record<string, any> = {};

  // 1. Seed from activeProfile.tracker if available
  if (activeProfile?.tracker) {
    for (const [key, record] of Object.entries(activeProfile.tracker)) {
      map[key] = record;
    }
  }

  // 2. Read TRACKER_FILE (job_search_tracker.csv)
  if (!existsSync(TRACKER_FILE)) return map;
  const content = readFileSync(TRACKER_FILE, "utf-8");
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  if (lines.length <= 1) return map;
  
  const candidateId = activeProfile?.id || "";
  const candidateNameNorm = (activeProfile?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length >= 4) {
      const company = cols[1]?.trim() || "";
      const role = cols[3]?.trim() || "";
      const status = cols[6]?.trim() || "new";
      const cvFile = cols[10]?.trim() || "";
      const coverFile = cols[11]?.trim() || "";
      const fitRating = cols[8]?.trim() || "92";
      const sourceUrl = cols[12]?.trim() || "";

      // Scope check: do not assign rows containing another candidate's name or CV file
      if (activeProfile) {
        const cvNorm = cvFile.toLowerCase().replace(/[^a-z0-9]/g, "");
        const coverNorm = coverFile.toLowerCase().replace(/[^a-z0-9]/g, "");
        const candidateSlugNorm = candidateId.toLowerCase().replace(/[^a-z0-9]/g, "");

        const isSelf = (candidateSlugNorm && (cvNorm.includes(candidateSlugNorm) || coverNorm.includes(candidateSlugNorm))) ||
                       (candidateNameNorm && (cvNorm.includes(candidateNameNorm) || coverNorm.includes(candidateNameNorm)));

        const isAjith = cvNorm.includes("ajith") || coverNorm.includes("ajith");
        const isManju = cvNorm.includes("manju") || coverNorm.includes("manju");

        if (candidateId === "manjubhargavi-cherupally" && isAjith && !isManju) {
          continue;
        }
        if (candidateId === "ajith-surya-thati" && isManju && !isAjith) {
          continue;
        }
        if (cvFile && !isSelf && (isAjith || isManju)) {
          continue;
        }
      }

      const record = { company, role, status, cvFile, coverFile, fitRating, sourceUrl };
      
      // Index by dedupKey (canonical URL / job ID / normalized company+role)
      const dedupKey = getJobDedupKey({ company, title: role, url: sourceUrl });
      map[dedupKey] = record;
      
      // Also index by simple lowercase key
      const simpleKey = `${company}_${role}`.toLowerCase();
      map[simpleKey] = record;
      
      // Also index by company-only fallback if role matches
      const normCompany = company.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normRole = role.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");
      map[`norm_${normCompany}_${normRole}`] = record;
    }
  }
  return map;
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function readSeenJobs(): Record<string, any> {
  if (!existsSync(SEEN_JOBS_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(SEEN_JOBS_FILE, "utf-8"));
    return raw.seen || {};
  } catch {
    return {};
  }
}

function saveSeenJobs(data: Record<string, any>) {
  writeFileSync(SEEN_JOBS_FILE, JSON.stringify({ seen: data }, null, 2));
}

async function runCliAsync(cmd: string[], timeoutMs: number = 15000): Promise<{ status: number; stdout: string; stderr: string }> {
  try {
    const proc = Bun.spawn(cmd, {
      cwd: APP_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });

    let timer: any;
    const timeoutPromise = new Promise<{ status: number; stdout: string; stderr: string }>((_, reject) => {
      timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        reject(new Error("Process timed out"));
      }, timeoutMs);
    });

    const execPromise = (async () => {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const status = await proc.exited;
      clearTimeout(timer);
      return { status, stdout, stderr };
    })();

    return await Promise.race([execPromise, timeoutPromise]);
  } catch (err: any) {
    return { status: 1, stdout: "", stderr: err.message };
  }
}

function cleanHtmlDescription(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchJobDescription(job: { id?: string; url?: string; portal?: string; title?: string }): Promise<string | null> {
  const url = job.url || "";
  const portal = job.portal || "";

  // 1. LinkedIn detail
  if (portal === "linkedin-search" || url.includes("linkedin.com")) {
    const liCliPath = join(APP_ROOT, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
    if (existsSync(liCliPath) && url) {
      try {
        const res = await runCliAsync([BUN_EXECUTABLE, "run", liCliPath, "detail", url, "--format", "json"], 10000);
        if (res.status === 0 && res.stdout) {
          const parsed = JSON.parse(res.stdout);
          if (parsed.description && parsed.description.length > 50) {
            return parsed.description;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch LinkedIn detail for:", url, e);
      }
    }
  }

  // 2. Freehire detail
  if (portal === "freehire-ats" || url.includes("freehire.me")) {
    const freehireCliPath = join(APP_ROOT, ".agents", "skills", "freehire-search", "cli", "src", "cli.ts");
    if (existsSync(freehireCliPath)) {
      const slugOrUrl = url || job.id?.replace(/^fh_/, "") || "";
      if (slugOrUrl) {
        try {
          const res = await runCliAsync([BUN_EXECUTABLE, "run", freehireCliPath, "detail", slugOrUrl, "--format", "json"], 10000);
          if (res.status === 0 && res.stdout) {
            const parsed = JSON.parse(res.stdout);
            if (parsed.description && parsed.description.length > 50) {
              return parsed.description;
            }
          }
        } catch (e) {
          console.warn("Failed to fetch Freehire detail for:", slugOrUrl, e);
        }
      }
    }
  }

  // 3. Reed detail (Full job description from official API or web page)
  if (portal === "reed" || url.includes("reed.co.uk")) {
    const reedJobIdMatch = url.match(/reed\.co\.uk\/jobs\/[^/]+\/(\d+)/i) ||
                           url.match(/\/(\d{6,10})/i) ||
                           (job.id ? job.id.match(/^reed_(\d+)/) : null);
    const reedJobId = reedJobIdMatch ? reedJobIdMatch[1] : null;
    const config = searchConfigManager.get();

    // 3a. Use official Reed Job Details API if API key is configured
    if (config.reedApiKey && reedJobId) {
      try {
        const auth = Buffer.from(`${config.reedApiKey}:`).toString("base64");
        const resp = await fetch(`https://www.reed.co.uk/api/1.0/jobs/${reedJobId}`, {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(10000)
        });
        if (resp.ok) {
          const data = (await resp.json()) as any;
          const desc = data?.jobDescription;
          if (desc && desc.length > 50) {
            return cleanHtmlDescription(desc);
          }
        }
      } catch (e) {
        console.warn("Reed API detail fetch error:", e);
      }
    }

    // 3b. Fallback to Reed web page __NEXT_DATA__ extraction
    const targetUrl = url || (reedJobId ? `https://www.reed.co.uk/jobs/${reedJobId}` : "");
    if (targetUrl) {
      try {
        const resp = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(10000)
        });
        if (resp.ok) {
          const html = await resp.text();
          const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
          if (nextDataMatch) {
            const data = JSON.parse(nextDataMatch[1]);
            const desc = data?.props?.pageProps?.consolidatedJobDetails?.jobDetails?.description;
            if (desc && desc.length > 50) {
              return cleanHtmlDescription(desc);
            }
          }
        }
      } catch (e) {
        console.warn("Reed web detail fetch error:", e);
      }
    }
  }

  return null;
}

// Scrape and structure any job posting from a direct URL (LinkedIn, Freehire, Reed, Greenhouse, Lever, direct web)
async function scrapeJobFromUrl(targetUrl: string): Promise<any> {
  const seen = readSeenJobs();
  const jobId = `ext_${Date.now()}`;
  let title = "Job Vacancy";
  let company = "Hiring Company";
  let location = "Remote / United Kingdom";
  let salary = "Competitive";
  let fullJd = "";
  let keySkills: string[] = [];

  // 1. If it's a LinkedIn URL, invoke LinkedIn CLI detail fetcher
  if (targetUrl.includes("linkedin.com")) {
    const liCliPath = join(APP_ROOT, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
    if (existsSync(liCliPath)) {
      try {
        const res = await runCliAsync([BUN_EXECUTABLE, "run", liCliPath, "detail", targetUrl, "--format", "json"], 12000);
        if (res.status === 0 && res.stdout) {
          const parsed = JSON.parse(res.stdout);
          if (parsed.title) title = parsed.title;
          if (parsed.company) company = parsed.company;
          if (parsed.location) location = parsed.location;
          if (parsed.description) fullJd = parsed.description;
          if (parsed.key_skills) keySkills = parsed.key_skills;
        }
      } catch (e) {
        console.warn("LinkedIn CLI detail error:", e);
      }
    }
  }

  // 2. If it's a Reed URL, fetch via official Reed API or __NEXT_DATA__
  if (targetUrl.includes("reed.co.uk")) {
    const reedJobIdMatch = targetUrl.match(/reed\.co\.uk\/jobs\/[^/]+\/(\d+)/i) || targetUrl.match(/\/(\d{6,10})/i);
    const reedJobId = reedJobIdMatch ? reedJobIdMatch[1] : null;
    const config = searchConfigManager.get();

    if (config.reedApiKey && reedJobId) {
      try {
        const auth = Buffer.from(`${config.reedApiKey}:`).toString("base64");
        const resp = await fetch(`https://www.reed.co.uk/api/1.0/jobs/${reedJobId}`, {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(10000)
        });
        if (resp.ok) {
          const data = (await resp.json()) as any;
          if (data.jobTitle) title = data.jobTitle;
          if (data.employerName) company = data.employerName;
          if (data.locationName) location = data.locationName;
          if (data.salary) salary = data.salary;
          if (data.jobDescription) fullJd = cleanHtmlDescription(data.jobDescription);
        }
      } catch (e) {
        console.warn("Reed API scrape error:", e);
      }
    }

    if (!fullJd) {
      try {
        const resp = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(10000)
        });
        if (resp.ok) {
          const html = await resp.text();
          const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
          if (nextDataMatch) {
            const data = JSON.parse(nextDataMatch[1]);
            const cjd = data?.props?.pageProps?.consolidatedJobDetails;
            const jd = cjd?.jobDetails;
            const ga = cjd?.gaTags;
            if (ga?.jobTitle) title = ga.jobTitle;
            if (ga?.jobRecruiterName) company = ga.jobRecruiterName;
            if (ga?.jobLocation) location = ga.jobLocation;
            if (jd?.jobSalary?.displaySalary) salary = jd.jobSalary.displaySalary;
            if (jd?.description) fullJd = cleanHtmlDescription(jd.description);
          }
        }
      } catch (e) {
        console.warn("Reed web scrape error:", e);
      }
    }
  }

  // 3. Generic HTTP fetch for any web page (Greenhouse, Lever, Workable, direct website)
  if (!fullJd || fullJd.length < 50) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          const rawTitle = titleMatch[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
          const parts = rawTitle.split(/\s*[-|–—·]\s*/);
          if (parts.length >= 2) {
            title = parts[0].trim();
            company = parts[1].replace(/careers|jobs|recruitment|at /i, "").trim();
          } else {
            title = rawTitle;
          }
        }
        const cleanText = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (cleanText.length > 100) {
          fullJd = cleanText.slice(0, 6000);
        }
      }
    } catch (e) {
      console.warn("Generic web fetch error for URL:", targetUrl, e);
    }
  }

  const activeProfile = profilesManager.getActiveProfile();
  const analysis = fullJd.length >= 80
    ? analyzeApplication(activeProfile, { company, role: title, location, fullJd, keySkills })
    : null;
  const sponsor = checkSponsor(company, fullJd);

  const newJob = {
    id: jobId,
    company: company || "Company",
    title: title || "Platform Engineer",
    role: title || "Platform Engineer",
    location: location || "Remote / UK",
    status: "new",
    url: targetUrl,
    full_jd: fullJd,
    key_skills: keySkills,
    date_scraped: new Date().toISOString(),
    source: "Instant URL Import",
    portal: "external-url",
    sponsor_verified: sponsor.verified,
    sponsorship_status: sponsor.assessment.vacancyStatus,
    sponsorship_evidence: sponsor.assessment.vacancyEvidence,
    fit_score: analysis?.overallScore || 0
  };

  seen[jobId] = newJob;
  saveSeenJobs(seen);
  return newJob;
}

// Initial verified seed postings
const INITIAL_SEED_JOBS = [
  {
    id: "opencast_devops_sr",
    title: "Devops - Senior Consultant",
    company: "Opencast Software Europe Limited",
    location: "Newcastle Upon Tyne, England, United Kingdom",
    salary: "£61,000 - £85,000",
    url: "https://www.linkedin.com/jobs/view/4472952380",
    posted_date: "2026-10-24",
    fit_score: 95,
    summary: "Build and scale high-impact platform systems with AWS EKS, Terraform, CI/CD, and GitOps for UK government & healthcare clients. B-Corp certified.",
    key_skills: ["AWS", "Kubernetes", "EKS", "Terraform", "CI/CD", "Consulting", "GitOps", "Python"],
    cv_file: "",
    cover_file: "",
    status: "new",
    full_jd: `Devops - Senior Consultant\nOpencast | B Corp™ · Newcastle Upon Tyne, England, United Kingdom\nSalary: £61,000 - £85,000\n\nReady to automate, innovate and make a real impact? We’re a growing tech consultancy that creates user-centred solutions with purpose for our clients in government, healthcare and purpose-driven businesses.\n\nKey Responsibilities:\n- Outage response, triaging issues, balancing stakeholder concerns.\n- Designing, developing, and implementing continuous deployment solutions.\n- Collaborating with clients to understand ways of working; learning new tools.\n- Mentoring other developers.\n- Contributing within Opencast communities.\n- Adhering to information security and quality policies.`
  },
  {
    id: "scott_logic_platform_lead",
    title: "Platform Engineer (Senior/Lead)",
    company: "Scott Logic",
    location: "Newcastle Upon Tyne, England, United Kingdom",
    salary: "£65,000 - £85,000",
    url: "https://uk.linkedin.com/jobs/view/platform-engineer-senior-lead-at-scott-logic-4457398385",
    posted_date: "2026-10-22",
    fit_score: 96,
    summary: "Lead client-facing cloud platforms and DevOps practices. Modern IaC (Terraform, CloudFormation), AWS cloud engineering, Kubernetes, and Python automation. Newcastle Helix HQ.",
    key_skills: ["Terraform", "AWS", "CI/CD", "Python", "Kubernetes", "CloudFormation", "Architecture", "Mentorship"],
    cv_file: "",
    cover_file: "",
    status: "new",
    full_jd: `Platform Engineer (Senior/Lead)\nScott Logic · Newcastle Upon Tyne, England, United Kingdom (The Lumen, Newcastle Helix)\n\nAt Scott Logic, we have a reputation for world-class software delivery. We are trusted by some of the world’s leading organisations to build reliable, high-performance, business-critical solutions – and expert advice.\n\nOur Platform Engineers design, build and manage cloud infrastructure and delivery platforms to support modern DevOps practices: CI/CD processes, deployment pipelines, building robust platform infrastructure, and migrating complex systems from on-premises to cloud providers.\n\nWhat are we looking for?\n- Modern Infrastructure as Code tools: Terraform, CloudFormation, Bicep.\n- Familiarity with major cloud platforms, particularly AWS or Azure.\n- Good CI/CD and deployment automation experience.\n- Python or other scripting languages for DevOps tasks.\n- Problem-solving, communication skills, and collaborative approach.\n- Good practices around security, reliability, observability, cost efficiency, performance, and governance.\n- For lead roles: good technical leadership experience, understanding what makes a team successful, and supporting colleagues.\n- Experience with containerisation, Kubernetes, or data platforms (nice-to-have).`
  },
  {
    id: "version1_aws_sr",
    title: "Senior AWS Engineer",
    company: "Version 1",
    location: "Newcastle Upon Tyne, England, United Kingdom",
    salary: "£60,000 - £75,000",
    url: "https://uk.linkedin.com/jobs/view/senior-aws-engineer-at-version-1-4474822459",
    posted_date: "2026-10-08",
    fit_score: 91,
    summary: "Enterprise AWS cloud migrations, IaC infrastructure with Terraform, automated pipeline creation, container orchestration, and multi-account governance.",
    key_skills: ["AWS", "Terraform", "Docker", "DevOps", "Python", "Linux"],
    cv_file: "",
    cover_file: "",
    status: "new"
  },
  {
    id: "balyasny_platform_accel",
    title: "Senior Software Engineer, Platform Engineering",
    company: "Balyasny Asset Management L.P.",
    location: "Remote / London Area, United Kingdom",
    salary: "£90,000 - £120,000",
    url: "https://uk.linkedin.com/jobs/view/4478479759",
    posted_date: "2026-10-14",
    fit_score: 94,
    summary: "Developer acceleration, modern containerized platforms, Kubernetes orchestration, telemetry, CI/CD tooling, and internal developer platforms (IDP).",
    key_skills: ["Kubernetes", "AWS", "Developer Experience", "CI/CD", "Go/Python", "Terraform"],
    cv_file: "",
    cover_file: "",
    status: "new"
  },
  {
    id: "robinhood_custody_platform",
    title: "Senior Platform / Custody Services Engineer",
    company: "Robinhood",
    location: "Remote (United Kingdom)",
    salary: "£95,000 - £130,000",
    url: "https://uk.linkedin.com/jobs/view/4448423549",
    posted_date: "2026-10-09",
    fit_score: 92,
    summary: "High-throughput financial cloud infrastructure, fault-tolerant distributed systems, AWS EKS, Kafka streaming pipelines, and microservices security.",
    key_skills: ["AWS", "Kubernetes", "Kafka", "High Availability", "Terraform", "SRE"],
    cv_file: "",
    cover_file: "",
    status: "new"
  }
];

// Helper to seed initial jobs if empty
function getJobDedupKey(job: { url?: string; company?: string; title?: string }): string {
  const url = (job.url || "").trim();
  // Extract 6+ digit portal job ID (e.g. LinkedIn 4472952380)
  const idMatch = url.match(/(\d{6,})/);
  if (idMatch) return `job_id_${idMatch[1]}`;
  
  // Normalized URL without query parameters or subdomains
  const normUrl = url.split("?")[0].replace(/^https?:\/\/(www\.|uk\.)?/, "").replace(/\/$/, "");
  if (normUrl) return `url_${normUrl}`;

  // Fallback to normalized company + role
  const normCompany = (job.company || "").toLowerCase()
    .replace(/\b(europe limited|limited|ltd|b corp™|b corp|l\.p\.|lp|inc|llc|uk & ireland|plc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  const normTitle = (job.title || "").toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]/g, "");
  return `ct_${normCompany}_${normTitle}`;
}

function initializeSeed() {
  const seen = readSeenJobs();
  let changed = false;
  for (const job of INITIAL_SEED_JOBS) {
    const seedDedupKey = getJobDedupKey(job);
    const existingKey = Object.keys(seen).find(k => getJobDedupKey(seen[k]) === seedDedupKey);

    if (!existingKey) {
      seen[job.id] = {
        title: job.title,
        company: job.company,
        url: job.url,
        location: job.location,
        salary: job.salary,
        posted_date: job.posted_date,
        first_seen: "2026-10-25",
        fit: "high",
        fit_score: job.fit_score,
        summary: job.summary,
        key_skills: job.key_skills,
        status: job.status,
        cv_file: job.cv_file,
        cover_file: job.cover_file,
        full_jd: (job as any).full_jd || "",
        portal: "linkedin-search",
        source: "cli"
      };
      changed = true;
    } else if ((job as any).full_jd && !seen[existingKey].full_jd) {
      seen[existingKey].full_jd = (job as any).full_jd;
      if (!seen[existingKey].cv_file) seen[existingKey].cv_file = job.cv_file;
      if (!seen[existingKey].cover_file) seen[existingKey].cover_file = job.cover_file;
      changed = true;
    }
  }
  if (changed) {
    saveSeenJobs(seen);
  }
}

initializeSeed();

export interface ScrapeOutcome {
  success: boolean;
  addedCount: number;
  enrichedCount: number;
  filteredCount: number;
  foundCount: number;
  sponsorshipMode: SponsorshipMode;
  sponsorRegistry?: any;
  sources: SourceReport[];
  query: string | null;
  location: string | null;
  completedAt: string;
  error?: string;
}

export async function runScrapeForProfile(
  profile: CandidateProfile,
  options?: { query?: string; location?: string; minSalary?: number; sponsorshipMode?: SponsorshipMode }
): Promise<ScrapeOutcome> {
  const config = searchConfigManager.get();
  const sponsorshipMode = ["all", "licensed", "explicit"].includes(options?.sponsorshipMode || "")
    ? options!.sponsorshipMode!
    : config.sponsorshipMode;
  const registry = await sponsorRegistry.refresh(false);
  const targetRoles = options?.query
    ? [options.query]
    : (profile?.targetRoles && profile.targetRoles.length > 0)
    ? profile.targetRoles.slice(0, 4)
    : [profile?.headline || "Software Engineer"];

  const countryInfo = detectCandidateCountry(profile?.location, options?.location ? [options.location] : profile?.targetLocations);
  const defaultFallbackLoc = profile?.location || countryInfo.countryName;
  const targetLocations = options?.location
    ? [options.location]
    : (profile?.targetLocations && profile.targetLocations.length > 0)
    ? profile.targetLocations.slice(0, 3)
    : [defaultFallbackLoc];

  const primaryLoc = targetLocations[0] || defaultFallbackLoc;

  // Dynamically build search queries from active candidate's target roles and actual locations
  const liQueries: Array<{ q: string; l: string }> = [];
  for (const role of targetRoles) {
    liQueries.push({ q: role, l: primaryLoc });
    for (const loc of targetLocations.slice(1)) {
      if (loc.toLowerCase() !== primaryLoc.toLowerCase() && loc.toLowerCase() !== "remote") {
        liQueries.push({ q: role, l: loc });
      }
    }
  }
  if (targetRoles.length > 0) {
    liQueries.push({ q: targetRoles[0], l: `Remote, ${countryInfo.countryName}` });
  }

  let addedCount = 0;
  let enrichedCount = 0;
  let filteredCount = 0;
  let totalFoundCount = 0;
  const seen = readSeenJobs();
  const activeSkills = Object.values(profile?.skills || {})
    .flat()
    .filter(Boolean)
    .slice(0, 6) as string[];
  const reports: SourceReport[] = [];
  const countResult = (result: ReturnType<typeof ingestDiscoveredJob>) => {
    if (result === "added") addedCount++;
    else if (result === "enriched") enrichedCount++;
    else if (result === "filtered") filteredCount++;
  };
  const counters = () => ({ addedCount, enrichedCount, filteredCount });
  const withCounts = (report: SourceReport, before: ReturnType<typeof counters>): SourceReport => ({
    ...report,
    added: addedCount - before.addedCount,
    enriched: enrichedCount - before.enrichedCount,
    filtered: filteredCount - before.filteredCount,
  });

  if (config.sources.linkedin) {
    const before = counters();
    const liCliPath = join(APP_ROOT, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
    let found = 0;
    let successfulQueries = 0;
    let lastError = "";
    if (existsSync(liCliPath)) {
      for (const query of liQueries.slice(0, 4)) {
        const res = await runCliAsync([BUN_EXECUTABLE, "run", liCliPath, "search", "-q", query.q, "-l", query.l, "--jobage", "7", "--limit", "8"]);
        if (res.status !== 0 || !res.stdout) {
          lastError = res.stderr || "Search process failed";
          continue;
        }
        try {
          const data = JSON.parse(res.stdout);
          successfulQueries++;
          for (const item of Array.isArray(data.results) ? data.results : []) {
            found++;
            totalFoundCount++;
            countResult(ingestDiscoveredJob(seen, {
              id: `li_${item.id}`, title: item.title, company: item.company, url: item.url,
              location: item.location || "United Kingdom", postedDate: item.date, description: item.snippet || item.summary || "",
              skills: activeSkills, portal: "linkedin-search", source: "cli",
            }, profile, sponsorshipMode));
          }
        } catch (error: any) { lastError = `Unreadable scraper response: ${error.message}`; }
      }
    } else {
      lastError = "Built-in LinkedIn scraper files are missing from this installation.";
    }
    reports.push(withCounts({ source: "LinkedIn", status: successfulQueries ? "ok" : "failed", found, reason: successfulQueries ? undefined : (lastError || "Search returned no readable response"), guidance: successfulQueries ? undefined : "Reinstall the latest app package, then retry. If the files are present, check the internet connection and wait before retrying to avoid rate limits." }, before));
  } else reports.push({ source: "LinkedIn", status: "skipped", found: 0, reason: "Disabled" });

  if (config.sources.freehire) {
    const before = counters();
    const freehireCliPath = join(APP_ROOT, ".agents", "skills", "freehire-search", "cli", "src", "cli.ts");
    let found = 0;
    let successfulQueries = 0;
    let lastError = "";
    if (existsSync(freehireCliPath)) {
      const freehireArgsList: Array<string[]> = [];
      for (const role of targetRoles.slice(0, 3)) {
        freehireArgsList.push(["search", "-q", role, "--country", countryInfo.freehireCode, "--jobage", "7", "--limit", "15"]);
      }

      const candidateSkillsFaceted = activeSkills
        .map(s => s.toLowerCase().split(/[\s(/,]/)[0])
        .filter(s => s && s.length > 2 && s.length < 15)
        .slice(0, 4);

      if (candidateSkillsFaceted.length > 0) {
        freehireArgsList.push(["search", "--skill", candidateSkillsFaceted.join(","), "--country", countryInfo.freehireCode, "--jobage", "7", "--limit", "15"]);
      }

      for (const args of freehireArgsList.slice(0, 4)) {
        const res = await runCliAsync([BUN_EXECUTABLE, "run", freehireCliPath, ...args]);

        if (res.status === 0 && res.stdout) {
          try {
            const data = JSON.parse(res.stdout);
            successfulQueries++;
            const items = data.results || data.jobs || [];
            if (Array.isArray(items)) {
              for (const job of items) {
                found++;
                totalFoundCount++;
                const cleanSlug = (job.slug || job.id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
                const compName = job.company || job.company_name || "Tech Company";
                countResult(ingestDiscoveredJob(seen, {
                  id: `fh_${cleanSlug}`, title: job.title, company: compName, url: job.url,
                  location: job.location || (job.work_mode === "remote" ? `Remote (${countryInfo.countryName})` : countryInfo.countryName),
                  postedDate: job.date || job.posted_at?.split("T")[0], description: job.description || "",
                  summary: job.summary || "", skills: job.skills || [],
                  salary: job.salary_min ? `£${job.salary_min.toLocaleString()} - £${(job.salary_max || job.salary_min).toLocaleString()}` : undefined,
                  portal: "freehire-ats", source: "cli",
                }, profile, sponsorshipMode));
              }
            }
          } catch (err) {
            console.error("Error parsing Freehire result:", err);
            lastError = `Unreadable scraper response: ${String(err)}`;
          }
        } else lastError = res.stderr || "Search process failed";
      }
    } else lastError = "Built-in Direct ATS scraper files are missing from this installation.";
    reports.push(withCounts({ source: "Direct ATS", status: successfulQueries ? "ok" : "failed", found, reason: successfulQueries ? undefined : (lastError || "Search returned no readable response"), guidance: successfulQueries ? undefined : "Reinstall the latest app package, then retry. If the files are present, check the internet connection." }, before));
  } else reports.push({ source: "Direct ATS", status: "skipped", found: 0, reason: "Disabled" });

  const apiLocation = targetLocations.find(location => location.toLowerCase() !== "remote") || primaryLoc;
  const apiSources: Array<{ enabled: boolean; name: string; keyReady: boolean; search: (query: string, location: string) => Promise<SourceJob[]> }> = [
    { enabled: config.sources.cvLibrary, name: "CV-Library", keyReady: Boolean(config.cvLibraryApiKey), search: (q, l) => searchCvLibrary(config, q, l) },
    { enabled: config.sources.reed, name: "Reed", keyReady: Boolean(config.reedApiKey), search: (q, l) => searchReed(config, q, l) },
    { enabled: config.sources.googleJobs, name: "Google Jobs", keyReady: Boolean(config.serpApiKey), search: (q, l) => searchGoogleJobs(config, q, l) },
    { enabled: config.sources.adzuna, name: "Adzuna", keyReady: Boolean(config.adzunaAppId && config.adzunaAppKey), search: (q, l) => searchAdzuna(config, q, l) },
    { enabled: config.sources.jobicy, name: "Jobicy", keyReady: true, search: (q, l) => searchJobicy(config, q, l) },
    { enabled: config.sources.arbeitnow, name: "Arbeitnow", keyReady: true, search: (q, l) => searchArbeitnow(config, q, l) },
    { enabled: config.sources.remotive, name: "Remotive", keyReady: true, search: (q, l) => searchRemotive(config, q, l) },
    { enabled: config.sources.themuse, name: "The Muse", keyReady: true, search: (q, l) => searchTheMuse(config, q, l) },
    { enabled: config.sources.greenhouse, name: "Greenhouse ATS", keyReady: true, search: (q, l) => searchGreenhouse(config, q, l) },
    { enabled: config.sources.lever, name: "Lever ATS", keyReady: true, search: (q, l) => searchLever(config, q, l) },
    { enabled: config.sources.ashby, name: "Ashby ATS", keyReady: true, search: (q, l) => searchAshby(config, q, l) },
  ];
  for (const provider of apiSources) {
    const before = counters();
    if (!provider.enabled) {
      reports.push({ source: provider.name, status: "skipped", found: 0, reason: "Disabled" });
      continue;
    }
    if (!provider.keyReady) {
      reports.push({ source: provider.name, status: "skipped", found: 0, reason: "API key not configured", guidance: `Open Sources, enter the ${provider.name} credentials, save, and retry.` });
      continue;
    }
    try {
      const jobs = (await Promise.all(targetRoles.slice(0, 2).map(role => provider.search(role, apiLocation)))).flat();
      for (const job of jobs) {
        totalFoundCount++;
        countResult(ingestDiscoveredJob(seen, {
          id: `${job.portal}_${job.externalId}`, title: job.title, company: job.company, url: job.url,
          location: job.location, postedDate: job.postedDate, description: job.description,
          salary: job.salary, portal: job.portal, source: "api",
        }, profile, sponsorshipMode));
      }
      reports.push(withCounts({ source: provider.name, status: "ok", found: jobs.length }, before));
    } catch (error: any) {
      reports.push(withCounts({ source: provider.name, status: "failed", found: 0, reason: error.message, guidance: "Check the internet connection and provider availability, or disable this supplemental source temporarily." }, before));
    }
  }

  saveSeenJobs(seen);
  const searchStatus: ScrapeOutcome = {
    success: true, addedCount, enrichedCount, filteredCount,
    foundCount: totalFoundCount,
    sponsorshipMode,
    sponsorRegistry: registry, sources: reports,
    query: options?.query || null, location: options?.location || null,
    completedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(LAST_SEARCH_STATUS_FILE, JSON.stringify(searchStatus, null, 2), "utf-8");
  } catch (e) {
    console.error("Could not write LAST_SEARCH_STATUS_FILE:", e);
  }
  return searchStatus;
}

const schedulerService = new SchedulerService(profilesManager, async (profile) => {
  const result = await runScrapeForProfile(profile);
  return {
    foundCount: result.foundCount,
    addedCount: result.addedCount,
    error: result.success ? undefined : (result.error || "Failed"),
  };
});
schedulerService.start();

// Start Bun HTTP server
serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/health" && req.method === "GET") {
      const diagnostics = getRuntimeDiagnostics();
      return Response.json({ status: diagnostics.healthy ? "ok" : "degraded", ...diagnostics });
    }

    if (url.pathname === "/api/diagnostics" && req.method === "GET") {
      return Response.json({ runtime: getRuntimeDiagnostics(), lastSearch: readLastSearchStatus(), sponsorRegistry: sponsorRegistry.status() });
    }

    if (url.pathname === "/api/search/status" && req.method === "GET") {
      const lastSearch = readLastSearchStatus();
      const activeProfile = profilesManager.getActiveProfile();
      const scheduleStatus = schedulerService.getStatus(activeProfile.id);
      const seen = readSeenJobs();
      const relevantJobsCount = Object.values(seen).filter((item: any) => isJobRelevantToProfile(item, activeProfile)).length;
      const totalJobsCount = Object.keys(seen).length;

      return Response.json({
        lastSearch,
        relevantJobsCount,
        totalJobsCount,
        scheduleStatus: scheduleStatus.activeProfileSchedule,
        serverTime: new Date().toISOString(),
      });
    }

    // API: GET /api/jobs
    if (url.pathname === "/api/jobs" && req.method === "GET") {
      const seen = readSeenJobs();
      const activeProfile = profilesManager.getActiveProfile();
      const tracker = readTracker(activeProfile);

      const jobsList = Object.entries(seen)
        .filter(([id, item]: [string, any]) => isJobRelevantToProfile(item, activeProfile))
        .map(([id, item]: [string, any]) => {
          const dist = profilesManager.calculateDistance(item.location || "", activeProfile);
          const fullJd = item.full_jd || item.summary || "";
          const sponsor = checkSponsor(item.company || "", fullJd);
          
          // Check if tracker has an entry via dedupKey, simpleKey, or normKey
          const itemDedupKey = getJobDedupKey(item);
          const simpleKey = `${item.company}_${item.title}`.toLowerCase();
          const normComp = (item.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const normRole = (item.title || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");
          const normKey = `norm_${normComp}_${normRole}`;
          const tracked = tracker[itemDedupKey] || tracker[simpleKey] || tracker[normKey];

          // Status hierarchy scoped to the active candidate
          let status = "new";
          if (tracked && tracked.status) {
            status = tracked.status;
          } else if (item.profileId && item.profileId === activeProfile.id && item.status) {
            status = item.status;
          } else {
            status = "new";
          }

          const cvFile = (tracked && tracked.cvFile) ? tracked.cvFile : (item.profileId === activeProfile.id ? (item.cv_file || "") : "");
          const coverFile = (tracked && tracked.coverFile) ? tracked.coverFile : (item.profileId === activeProfile.id ? (item.cover_file || "") : "");

          const analysis = analyzeApplication(activeProfile, {
            company: item.company || "",
            role: item.title || "",
            location: item.location || "",
            fullJd,
            keySkills: item.key_skills || [],
          });

          const baselineScore = analysis.overallScore;
          let tailoredScore = item.tailored_score || null;
          let effectiveAnalysis = analysis;

          if (cvFile && existsSync(join(ROOT_DIR, cvFile))) {
            try {
              const cvText = readFileSync(join(ROOT_DIR, cvFile), "utf-8");
              const tailoredAnalysis = analyzeTailoredResume(cvText, {
                company: item.company || "",
                role: item.title || "",
                location: item.location || "",
                fullJd,
                keySkills: item.key_skills || [],
              }, activeProfile, analysis);
              tailoredScore = tailoredAnalysis.overallScore;
              effectiveAnalysis = tailoredAnalysis;
            } catch (err) {
              console.warn("Error calculating tailored ATS score for", cvFile, err);
            }
          }

        return {
          id,
          title: item.title,
          company: item.company,
          location: item.location,
          distance_miles: dist.miles,
          commute_tag: dist.tag,
          is_remote: dist.isRemote,
          salary: item.salary || "Competitive Market Rate",
          url: item.url,
          posted_date: item.posted_date || item.first_seen,
          fit_score: tailoredScore ?? analysis.overallScore,
          baseline_score: baselineScore,
          tailored_score: tailoredScore,
          fit_verdict: effectiveAnalysis.verdict,
          analysis: effectiveAnalysis,
          baseline_analysis: analysis,
          summary: item.summary || fullJd.slice(0, 260),
          full_jd: fullJd,
          key_skills: item.key_skills || analysis.requirements.filter(r => r.category === "technical").map(r => r.requirement),
          sponsor_verified: sponsor.verified,
          sponsor_badge: sponsor.badge,
          sponsor_label: sponsor.label,
          sponsorship_status: sponsor.assessment.vacancyStatus,
          sponsorship_evidence: sponsor.assessment.vacancyEvidence,
          sponsorship_employer: sponsor.assessment.employer.organisation || "",
          sponsorship_source: sponsor.assessment.employer.source,
          status,
          cv_file: cvFile,
          cover_file: coverFile,
          portal: item.portal || "linkedin-search"
        };
      });

      // Deduplicate jobsList across keys by canonical job ID / URL / company+title
      const uniqueJobsMap = new Map<string, any>();
      for (const job of jobsList) {
        const dedupKey = getJobDedupKey(job);
        const existing = uniqueJobsMap.get(dedupKey);
        if (!existing) {
          uniqueJobsMap.set(dedupKey, job);
        } else {
          // Never downgrade status: "applied" always wins over "drafted" and "new"
          const mergedStatus = (existing.status === "applied" || job.status === "applied") ? "applied"
                             : (existing.status === "drafted" || job.status === "drafted") ? "drafted"
                             : (existing.status || job.status || "new");

          const mergedCvFile = existing.cv_file || job.cv_file || "";
          const mergedCoverFile = existing.cover_file || job.cover_file || "";
          const mergedFullJd = existing.full_jd || job.full_jd || "";

          uniqueJobsMap.set(dedupKey, {
            ...existing,
            ...job,
            status: mergedStatus,
            cv_file: mergedCvFile,
            cover_file: mergedCoverFile,
            full_jd: mergedFullJd
          });
        }
      }
      const uniqueJobsList = Array.from(uniqueJobsMap.values());

      // Sort: applied first, then drafted, then by newest posted_date first, then fit_score
      uniqueJobsList.sort((a, b) => {
        const statusRank = (s: string) => s === "applied" ? 3 : s === "drafted" ? 2 : 1;
        const rankDiff = statusRank(b.status) - statusRank(a.status);
        if (rankDiff !== 0) return rankDiff;

        // Recency: Newest postings from today / yesterday first
        const dateA = a.posted_date || "2026-01-01";
        const dateB = b.posted_date || "2026-01-01";
        if (dateB !== dateA) {
          return dateB.localeCompare(dateA);
        }

        return (b.fit_score || 0) - (a.fit_score || 0);
      });

      return new Response(JSON.stringify({
        jobs: uniqueJobsList,
        total: uniqueJobsList.length,
        activeProfile: {
          id: activeProfile.id,
          name: activeProfile.name,
          headline: activeProfile.headline,
          location: activeProfile.location,
          postcode: activeProfile.postcode,
          visaSponsorshipRequired: activeProfile.visaSponsorshipRequired,
          targetLocations: activeProfile.targetLocations,
          preferredRadiusMiles: activeProfile.preferredRadiusMiles
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // API: GET /api/profiles (List all candidate profiles)
    if (url.pathname === "/api/profiles" && req.method === "GET") {
      return new Response(JSON.stringify(profilesManager.getAll()), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // API: POST /api/profiles/active (Switch active profile)
    if (url.pathname === "/api/profiles/active" && req.method === "POST") {
      try {
        const body = await req.json();
        const active = profilesManager.setActiveProfile(body.id);
        return new Response(JSON.stringify({ success: true, activeProfile: active }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
      }
    }

    // API: POST /api/profiles (Create or update candidate profile)
    if (url.pathname === "/api/profiles" && req.method === "POST") {
      try {
        const body = await req.json();
        const saved = profilesManager.saveProfile(body);
        return new Response(JSON.stringify({ success: true, profile: saved }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
      }
    }

    // API: DELETE /api/profiles (Delete a candidate profile)
    if (url.pathname === "/api/profiles" && req.method === "DELETE") {
      try {
        const body = await req.json();
        const ok = profilesManager.deleteProfile(body.id);
        return new Response(JSON.stringify({ success: ok, all: profilesManager.getAll() }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
      }
    }

    // API: POST /api/profiles/import-resume (Parse and optionally persist a resume)
    if ((url.pathname === "/api/profiles/import-resume" || url.pathname === "/api/profiles/parse-resume") && req.method === "POST") {
      try {
        const incoming = await readResumeRequest(req);
        const resumeText = incoming.text;
        if (!resumeText || resumeText.trim().length < 50) {
          return new Response(JSON.stringify({ success: false, error: "The resume did not contain enough readable text." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const deterministic = parseResumeDeterministically(resumeText);
        const parsed = await aiService.parseResumeText(resumeText);
        const allProfilesList = profilesManager.getAll().profiles;

        // Check if an existing profile should be updated:
        // Only update an existing profile if targetProfileId was explicitly specified (Update Mode)
        let resolvedProfileId: string | undefined = undefined;
        let existingRecord: CandidateProfile | undefined = undefined;

        if (incoming.targetProfileId) {
          const matchTarget = allProfilesList.find(p => p.id === incoming.targetProfileId);
          if (matchTarget) {
            resolvedProfileId = matchTarget.id;
            existingRecord = matchTarget;
          }
        }

        // Generate unique clean slug if creating a new profile (supports multiple profiles per person)
        let finalId: string;
        if (resolvedProfileId) {
          finalId = resolvedProfileId;
        } else {
          const candidateName = parsed.name || deterministic.profile.name || "candidate";
          const candidateHeadline = (parsed.headline || deterministic.profile.headline || "").toLowerCase();
          const baseSlug = candidateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";

          // If a profile for this candidate already exists, differentiate with their role/discipline
          if (allProfilesList.some(p => p.id === baseSlug)) {
            const roleWord = candidateHeadline.match(/dynamics|devops|qa|tester|frontend|backend|cloud|sre|platform|data|security|mobile|nurse|accountant|analyst/)?.[0];
            const candidateRoleSlug = roleWord ? `${baseSlug}-${roleWord}` : "";
            if (candidateRoleSlug && !allProfilesList.some(p => p.id === candidateRoleSlug)) {
              finalId = candidateRoleSlug;
            } else {
              let counter = 2;
              finalId = `${baseSlug}-${counter}`;
              while (allProfilesList.some(p => p.id === finalId)) {
                finalId = `${baseSlug}-${++counter}`;
              }
            }
          } else {
            finalId = baseSlug;
          }
        }

        const newProfile: CandidateProfile = {
          id: finalId,
          name: parsed.name || deterministic.profile.name || existingRecord?.name || "Candidate",
          headline: parsed.headline || deterministic.profile.headline || existingRecord?.headline || "Software Professional",
          summary: parsed.summary || deterministic.profile.summary || existingRecord?.summary || "",
          email: parsed.email || deterministic.profile.email || existingRecord?.email || "",
          phone: parsed.phone || deterministic.profile.phone || existingRecord?.phone || "",
          location: parsed.location || deterministic.profile.location || existingRecord?.location || "",
          postcode: parsed.postcode || deterministic.profile.postcode || existingRecord?.postcode || "",
          linkedin: parsed.linkedin || deterministic.profile.linkedin || existingRecord?.linkedin || "",
          github: parsed.github || deterministic.profile.github || existingRecord?.github || "",
          portfolio: parsed.portfolio || deterministic.profile.portfolio || existingRecord?.portfolio || "",
          visaSponsorshipRequired: (typeof parsed.visaSponsorshipRequired === "boolean")
            ? parsed.visaSponsorshipRequired
            : ((typeof deterministic.profile.visaSponsorshipRequired === "boolean")
              ? deterministic.profile.visaSponsorshipRequired
              : (existingRecord?.visaSponsorshipRequired ?? false)),
          targetRoles: (parsed.targetRoles?.filter(Boolean)?.length)
            ? parsed.targetRoles.filter(Boolean)
            : (deterministic.profile.targetRoles?.length ? deterministic.profile.targetRoles : (existingRecord?.targetRoles?.length ? existingRecord.targetRoles : [parsed.headline || deterministic.profile.headline || "Professional"].filter(Boolean))),
          targetLocations: (parsed.targetLocations?.filter(Boolean)?.length)
            ? parsed.targetLocations.filter(Boolean)
            : (deterministic.profile.targetLocations?.length ? deterministic.profile.targetLocations : (existingRecord?.targetLocations?.length ? existingRecord.targetLocations : ["Remote", parsed.location || deterministic.profile.location].filter(Boolean))),
          preferredRadiusMiles: parsed.preferredRadiusMiles || deterministic.profile.preferredRadiusMiles || existingRecord?.preferredRadiusMiles || 50,
          minSalary: parsed.minSalary || deterministic.profile.minSalary || existingRecord?.minSalary || 0,
          skills: (parsed.skills && Object.keys(parsed.skills).length > 0)
            ? parsed.skills
            : (deterministic.profile.skills || existingRecord?.skills || { cloud: [], devops: [], languages: [], tools: [] }),
          keywords: (parsed as any).keywords || deterministic.profile.keywords || [],
          experience: (parsed.experience && parsed.experience.length > 0)
            ? (parsed.experience as any)
            : (deterministic.profile.experience?.length ? (deterministic.profile.experience as any) : (existingRecord?.experience || [])),
          projects: (parsed.projects && parsed.projects.length > 0)
            ? (parsed.projects as any)
            : (deterministic.profile.projects?.length ? (deterministic.profile.projects as any) : (existingRecord?.projects || [])),
          education: (parsed.education && parsed.education.length > 0)
            ? (parsed.education as any)
            : (deterministic.profile.education?.length ? (deterministic.profile.education as any) : (existingRecord?.education || [])),
          certifications: (parsed.certifications && parsed.certifications.length > 0)
            ? (parsed.certifications as any)
            : (deterministic.profile.certifications?.length ? (deterministic.profile.certifications as any) : (existingRecord?.certifications || [])),
          spokenLanguages: parsed.spokenLanguages || deterministic.profile.spokenLanguages || existingRecord?.spokenLanguages || ["English"],
          latexBackbone: existingRecord?.latexBackbone || createLatexBackbone(),
          profileVersion: (existingRecord?.profileVersion || 0) + 1,
          sourceResume: {
            fileName: incoming.fileName,
            mediaType: incoming.mediaType,
            importedAt: new Date().toISOString(),
            sha256: createHash("sha256").update(resumeText).digest("hex"),
            text: resumeText,
            ...(incoming.fileName.toLowerCase().endsWith(".tex") ? { originalLatex: resumeText } : {}),
          },
          tracker: existingRecord?.tracker || {},
          scenarioHistory: [
            ...(existingRecord?.scenarioHistory || []),
            `Imported from ${incoming.fileName}`
          ]
        };

        const warnings = [...deterministic.warnings];
        if (!newProfile.name) warnings.push("Name is required before this profile can be saved.");
        if (!newProfile.experience.length) warnings.push("No work-experience entries were confirmed.");
        const response = { success: true, profile: newProfile, warnings: [...new Set(warnings)], confidence: deterministic.confidence };
        if (url.pathname === "/api/profiles/parse-resume" || incoming.previewOnly) {
          return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } });
        }
        if (!newProfile.name) {
          return new Response(JSON.stringify({ success: false, error: "Review the parsed resume and add the candidate name before saving.", ...response }), { status: 422, headers: { "Content-Type": "application/json" } });
        }

        const saved = profilesManager.saveProfile(newProfile);
        profilesManager.setActiveProfile(saved.id);

        return new Response(JSON.stringify({ ...response, profile: saved }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/ai/scenario (Execute natural language scenario command)
    if (url.pathname === "/api/ai/scenario" && req.method === "POST") {
      try {
        const body = await req.json();
        const { prompt, jobId, currentTab } = body;
        if (!prompt || !prompt.trim()) {
          return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), { status: 400 });
        }

        const activeProfile = profilesManager.getActiveProfile();
        const outcome = await aiService.processScenario(prompt, activeProfile, { jobId, currentTab });

        if (outcome.action === "unsupported") {
          return new Response(JSON.stringify({ success: false, error: outcome.explanation }), { status: 422, headers: { "Content-Type": "application/json" } });
        }

        if (outcome.action === "edit_application") {
          if (!jobId) {
            return new Response(JSON.stringify({ success: false, error: "Open a job before asking Scenario AI to edit its application." }), { status: 422, headers: { "Content-Type": "application/json" } });
          }
          const seen = readSeenJobs();
          const job = seen[jobId];
          if (!job) {
            return new Response(JSON.stringify({ success: false, error: "The open job is no longer in the saved feed. Refresh and select it again." }), { status: 404, headers: { "Content-Type": "application/json" } });
          }
          const edit = outcome.documentEdit!;
          const term = edit.term?.trim();
          if (edit.mode === "emphasize" && (!term || !profileEvidenceText(activeProfile).includes(term.toLowerCase()))) {
            return new Response(JSON.stringify({ success: false, error: `The profile does not contain evidence for “${term || "that term"}”. Add verified evidence before emphasizing it.` }), { status: 422, headers: { "Content-Type": "application/json" } });
          }
          const fullJd = String(job.full_jd || job.summary || "").trim();
          if (fullJd.length < 80) {
            return new Response(JSON.stringify({ success: false, error: "Add the complete job description before editing this application." }), { status: 422, headers: { "Content-Type": "application/json" } });
          }
          const company = job.company || "Company";
          const role = job.title || job.role || "Role";
          const location = job.location || "";
          const keySkills = [...(job.key_skills || [])];
          if (edit.mode === "emphasize" && term) keySkills.unshift(term);
          const cleanCompany = safeSlug(company).replace(/-/g, "_");
          const cleanRole = safeSlug(role).replace(/-/g, "_");
          const candidateSlug = safeSlug(activeProfile.name || "candidate").replace(/-/g, "_");
          const cvPath = job.cv_file || `cv/main_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;
          const coverPath = job.cover_file || `cover_letters/cover_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;
          let cvContent = await aiService.generateTailoredCV(activeProfile, { company, role, location, keySkills, fullJd });
          let coverContent = await aiService.generateTailoredCoverLetter(activeProfile, { company, role, location, keySkills, fullJd });
          if (edit.mode === "concise") cvContent = makeResumeConcise(cvContent);
          if (edit.mode === "remove" && term) {
            cvContent = removeGroundedTerm(cvContent, term);
            coverContent = removeGroundedTerm(coverContent, term);
          }
          if (edit.kind !== "cover") writeFileSync(join(ROOT_DIR, cvPath), cvContent, "utf-8");
          if (edit.kind !== "cv") writeFileSync(join(ROOT_DIR, coverPath), coverContent, "utf-8");
          const baselineAnalysis = analyzeApplication(activeProfile, { company, role, location, keySkills, fullJd });
          const tailoredAnalysis = analyzeTailoredResume(cvContent, { company, role, location, keySkills, fullJd }, activeProfile, baselineAnalysis);
          seen[jobId] = {
            ...job,
            cv_file: cvPath,
            cover_file: coverPath,
            status: "drafted",
            analysis: tailoredAnalysis,
            baseline_analysis: baselineAnalysis,
            fit_score: tailoredAnalysis.overallScore,
            baseline_score: baselineAnalysis.overallScore,
            tailored_score: tailoredAnalysis.overallScore
          };
          saveSeenJobs(seen);
          profilesManager.updateActiveProfileTracker(jobId, { status: "drafted", cvFile: cvPath, coverFile: coverPath, fitRating: String(tailoredAnalysis.overallScore), notes: `Scenario edit: ${prompt}` });
          return new Response(JSON.stringify({
            success: true,
            action: "edit_application",
            explanation: `Updated the open ${edit.kind === "cv" ? "resume" : edit.kind === "cover" ? "cover letter" : "application documents"}.`,
            cvPath,
            coverPath,
            cvContent,
            coverContent,
            analysis: tailoredAnalysis,
            baselineAnalysis,
            fit_score: tailoredAnalysis.overallScore,
            baseline_score: baselineAnalysis.overallScore,
            tailored_score: tailoredAnalysis.overallScore,
            status: "drafted"
          }), { headers: { "Content-Type": "application/json" } });
        }

        // Apply profile updates if any (e.g. removing/adding certs, changing location)
        if (Object.keys(outcome.profileUpdates).length > 0) {
          const updated = {
            ...activeProfile,
            ...outcome.profileUpdates,
            scenarioHistory: [...(activeProfile.scenarioHistory || []), prompt]
          };
          profilesManager.saveProfile(updated);
        }

        // If outcome is a direct URL scrape request
        if (outcome.action === "scrape_and_tailor" && outcome.jobUrl) {
          const newJob = await scrapeJobFromUrl(outcome.jobUrl);
          const currentProfile = profilesManager.getActiveProfile();
          const initialAnalysis = analyzeApplication(currentProfile, {
            company: newJob.company,
            role: newJob.title,
            location: newJob.location,
            keySkills: newJob.key_skills,
            fullJd: newJob.full_jd
          });
          newJob.analysis = initialAnalysis;
          newJob.fit_score = initialAnalysis.overallScore;
          const seen = readSeenJobs();
          seen[newJob.id] = newJob;
          saveSeenJobs(seen);

          return new Response(JSON.stringify({
            success: true,
            action: "scrape_and_tailor",
            job: newJob,
            jobId: newJob.id,
            explanation: `Imported "${newJob.title} at ${newJob.company}" from the URL. Preparing the application.`,
            profileUpdates: outcome.profileUpdates,
            activeProfile: profilesManager.getActiveProfile()
          }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          explanation: outcome.explanation,
          profileUpdates: outcome.profileUpdates,
          feedFilters: outcome.feedFilters,
          action: outcome.action || "update_profile",
          activeProfile: profilesManager.getActiveProfile()
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: GET /api/ai/config (Get AI settings and status)
    if (url.pathname === "/api/ai/config" && req.method === "GET") {
      const config = aiService.getPublicConfig();
      const health = await aiService.checkHealth();
      const models = await aiService.getAvailableModels();
      return new Response(JSON.stringify({ config, health, models }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // API: POST /api/ai/config (Update AI settings)
    if (url.pathname === "/api/ai/config" && req.method === "POST") {
      try {
        const body = await req.json();
        aiService.saveConfig(body);
        const health = await aiService.checkHealth();
        return new Response(JSON.stringify({ success: true, config: aiService.getPublicConfig(), health }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/ai/recommend (Smart Recommend Best & Cheap Model)
    if (url.pathname === "/api/ai/recommend" && req.method === "POST") {
      try {
        const body = await req.json();
        const { provider = "ollama", apiKey, baseUrl } = body;
        const recommendation = await aiService.getRecommendedModel(provider, apiKey, baseUrl);
        let cloudModels: string[] = [];
        if (provider === "openai" || provider === "anthropic" || provider === "gemini" || provider === "openrouter" || provider === "nvidia") {
          cloudModels = await aiService.fetchCloudModels(provider, apiKey, baseUrl);
        }
        return new Response(JSON.stringify({ success: true, ...recommendation, cloudModels }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/ai/models (Live query verified available models for a provider)
    if (url.pathname === "/api/ai/models" && req.method === "POST") {
      try {
        const body = await req.json();
        const { provider = "anthropic", apiKey, host, baseUrl } = body;
        const result = await aiService.getAvailableModelsForProvider(provider, apiKey, host, baseUrl);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: search-source configuration. API keys are write-only and never returned.
    if (url.pathname === "/api/search/config" && req.method === "GET") {
      return Response.json({
        config: searchConfigManager.getPublic(),
        sponsorRegistry: sponsorRegistry.status(),
        providers: {
          linkedin: "Public LinkedIn search",
          freehire: "Direct company ATS boards",
          cvLibrary: "CV-Library official API (partner key required)",
          reed: "Reed API (key required)",
          googleJobs: "Google Jobs via SerpAPI (third-party key required)",
          adzuna: "Adzuna official API (free credentials required)",
          jobicy: "Jobicy public API",
          arbeitnow: "Arbeitnow public API",
          remotive: "Remotive public API (24-hour delayed remote jobs)",
        },
      });
    }

    if (url.pathname === "/api/search/config" && req.method === "POST") {
      try {
        const body = await req.json() as any;
        const mode = body.sponsorshipMode;
        if (mode && !["all", "licensed", "explicit"].includes(mode)) {
          return Response.json({ success: false, error: "Invalid sponsorship mode" }, { status: 400 });
        }
        const allowedSources = searchConfigManager.get().sources;
        const sources = body.sources && typeof body.sources === "object"
          ? Object.fromEntries(Object.keys(allowedSources).map(key => [key, Boolean(body.sources[key])]))
          : undefined;
        searchConfigManager.save({
          ...(mode ? { sponsorshipMode: mode } : {}),
          ...(sources ? { sources: sources as any } : {}),
          ...(typeof body.cvLibraryApiKey === "string" ? { cvLibraryApiKey: body.cvLibraryApiKey.trim() } : {}),
          ...(typeof body.reedApiKey === "string" ? { reedApiKey: body.reedApiKey.trim() } : {}),
          ...(typeof body.serpApiKey === "string" ? { serpApiKey: body.serpApiKey.trim() } : {}),
          ...(typeof body.adzunaAppId === "string" ? { adzunaAppId: body.adzunaAppId.trim() } : {}),
          ...(typeof body.adzunaAppKey === "string" ? { adzunaAppKey: body.adzunaAppKey.trim() } : {}),
          ...(typeof body.customAtsCompanies === "string" ? { customAtsCompanies: body.customAtsCompanies.trim() } : {}),
        });
        return Response.json({ success: true, config: searchConfigManager.getPublic(), sponsorRegistry: sponsorRegistry.status() });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    if (url.pathname === "/api/sponsors/refresh" && req.method === "POST") {
      const result = await sponsorRegistry.refresh(true);
      return Response.json({ success: !result.error, ...result }, { status: result.error && !result.count ? 502 : 200 });
    }

    // API: POST /api/scrape (Trigger Automated Live Search)
    if (url.pathname === "/api/scrape" && req.method === "POST") {
      try {
        console.log("Starting automated live search across priority locations...");
        const scrapeRequest = await req.json().catch(() => ({})) as { query?: string; location?: string; minSalary?: number; sponsorshipMode?: SponsorshipMode };
        const activeProfile = profilesManager.getActiveProfile();
        const searchStatus = await runScrapeForProfile(activeProfile, scrapeRequest);
        return new Response(JSON.stringify(searchStatus), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: GET /api/schedule (Fetch active profile schedule and all candidate schedules)
    if (url.pathname === "/api/schedule" && req.method === "GET") {
      const targetProfileId = url.searchParams.get("profileId") || profilesManager.getActiveProfile().id;
      const status = schedulerService.getStatus(targetProfileId);
      return Response.json(status);
    }

    // API: POST /api/schedule (Update schedule for candidate profile or sync to all)
    if (url.pathname === "/api/schedule" && req.method === "POST") {
      try {
        const body = await req.json();
        const targetProfileId = body.profileId || profilesManager.getActiveProfile().id;
        const targetProfile = profilesManager.getProfile(targetProfileId) || profilesManager.getActiveProfile();
        const enabled = Boolean(body.enabled);
        const mode = body.mode === "daily" ? "daily" : "interval";
        const intervalHours = Math.max(1, Math.min(168, Number(body.intervalHours) || 4));
        const dailyTime = (body.dailyTime || "08:00").trim();

        const scheduleConfig: ProfileScheduleConfig = {
          enabled,
          mode,
          intervalHours,
          dailyTime,
          lastRunAt: targetProfile.schedule?.lastRunAt,
          nextRunAt: computeNextRun({
            enabled,
            mode,
            intervalHours,
            dailyTime,
            lastRunAt: targetProfile.schedule?.lastRunAt,
          }) || undefined,
          lastRunResult: targetProfile.schedule?.lastRunResult,
        };

        if (body.applyToAll) {
          profilesManager.applyScheduleToAll(scheduleConfig);
        } else {
          profilesManager.updateProfileSchedule(targetProfile.id, scheduleConfig);
        }

        return Response.json({ success: true, schedule: scheduleConfig });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    // API: POST /api/schedule/run-now (Immediately test-run scraping for target profile)
    if (url.pathname === "/api/schedule/run-now" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const targetProfileId = body.profileId || profilesManager.getActiveProfile().id;
        const result = await schedulerService.executeForProfile(targetProfileId);
        return Response.json({ success: !result.error, ...result });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // API: POST /api/job-chat (In-Posting AI Assistant Chat & Copilot)
    if (url.pathname === "/api/job-chat" && req.method === "POST") {
      try {
        const body = await req.json();
        const { jobId, message, history, profileId, job: incomingJob } = body;
        if (!message || typeof message !== "string") {
          return Response.json({ success: false, error: "A message prompt is required." }, { status: 400 });
        }
        const activeProfile = profileId ? (profilesManager.getProfile(profileId) || profilesManager.getActiveProfile()) : profilesManager.getActiveProfile();
        const seen = readSeenJobs();
        const storedJob = (jobId && seen[jobId]) ? seen[jobId] : (incomingJob || {});

        const company = incomingJob?.company || storedJob.company || "Company";
        const role = incomingJob?.title || incomingJob?.role || storedJob.title || storedJob.role || "Role";
        const location = incomingJob?.location || storedJob.location || "";
        const fullJd = incomingJob?.full_jd || incomingJob?.fullJd || storedJob.full_jd || storedJob.summary || "";
        const salary = incomingJob?.salary || storedJob.salary || "";
        const keySkills = incomingJob?.key_skills || storedJob.key_skills || storedJob.keySkills || [];

        const jobForChat = {
          ...storedJob,
          ...incomingJob,
          company,
          role,
          location,
          fullJd,
          keySkills,
          salary,
        };

        const reply = await aiService.generateJobChatResponse(activeProfile, jobForChat, message, history || []);
        return Response.json({ success: true, reply });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // API: POST /api/tailor (Curate Tailored CV & Cover Letter for a Role)
    if (url.pathname === "/api/tailor" && req.method === "POST") {
      try {
        const body = await req.json();
        const { jobId, force } = body;
        const activeProfile = profilesManager.getActiveProfile();
        const seen = readSeenJobs();
        const storedJob = seen[jobId] || {};

        const incomingJob = body.job || {};
        const company = body.company || incomingJob.company || storedJob.company || "Company";
        const role = body.role || incomingJob.role || incomingJob.title || storedJob.role || storedJob.title || "Platform Engineer";
        const location = body.location || incomingJob.location || storedJob.location || "United Kingdom";
        const keySkills = (body.keySkills && body.keySkills.length) ? body.keySkills : (incomingJob.keySkills || incomingJob.key_skills || storedJob.key_skills || storedJob.keySkills || []);

        let fullJd = String(body.fullJd || body.full_jd || incomingJob.fullJd || incomingJob.full_jd || storedJob.full_jd || storedJob.summary || "").trim();
        if (fullJd.length < 150) {
          const fetchedJd = await fetchJobDescription(storedJob);
          if (fetchedJd && fetchedJd.length > 50) {
            fullJd = fetchedJd;
            storedJob.full_jd = fullJd;
            seen[jobId] = { ...storedJob, full_jd: fullJd };
            saveSeenJobs(seen);
          }
        }
        if (fullJd.length < 80) {
          return new Response(JSON.stringify({ success: false, error: "Add the complete job description before tailoring. A title and skill list are not enough for a trustworthy ATS analysis." }), { status: 422, headers: { "Content-Type": "application/json" } });
        }
        const analysis = analyzeApplication(activeProfile, { company, role, location, keySkills, fullJd });
        if (!force && (analysis.gates.eligibility.verdict === "FAIL" || analysis.gates.language.verdict === "FAIL")) {
          return new Response(JSON.stringify({ success: false, error: "This role fails a mandatory eligibility or language gate.", analysis }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        
        const candidateSlug = (activeProfile.name || "candidate").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
        const cleanCompany = (company || "Company").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const cleanRole = (role || "Role").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        
        const detectedLang = (activeProfile.preferredLanguage as SupportedLanguage) ||
                             detectLanguageDeterministically(activeProfile.sourceResume?.text) ||
                             detectLanguageDeterministically(fullJd) ||
                             "en";
        const isNonEnglish = detectedLang !== "en";
        const langPack = LANGUAGE_PACKS[detectedLang] || LANGUAGE_PACKS.en;

        const cvPath = isNonEnglish
          ? `cv/main_${candidateSlug}_${cleanCompany}_${cleanRole}_${detectedLang}.tex`
          : `cv/main_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;
        const coverPath = isNonEnglish
          ? `cover_letters/cover_${candidateSlug}_${cleanCompany}_${cleanRole}_${detectedLang}.tex`
          : `cover_letters/cover_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;

        const cvFullPath = join(ROOT_DIR, cvPath);
        const coverFullPath = join(ROOT_DIR, coverPath);

        let cvContent = "";
        let coverContent = "";

        // Regenerate if force requested, file doesn't exist, or file is a legacy basic stub / wrong language
        const isCvStale = !existsSync(cvFullPath) || force || (() => {
          const content = readFileSync(cvFullPath, "utf-8");
          if (content.split("\n").length < 100) return true;
          if (detectedLang === "de" && !/\\section\{Profil\}/i.test(content)) return true;
          return false;
        })();
        if (isCvStale) {
          cvContent = await aiService.generateTailoredCV(activeProfile, { company, role, location, keySkills, fullJd }, detectedLang);
          writeFileSync(cvFullPath, cvContent);
        } else {
          cvContent = readFileSync(cvFullPath, "utf-8");
        }

        const isCoverStale = !existsSync(coverFullPath) || force || (() => {
          const content = readFileSync(coverFullPath, "utf-8");
          if (content.split("\n").length < 20) return true;
          if (detectedLang === "de" && /Dear Hiring/i.test(content)) return true;
          if (/proven track record|proven ability|solid track record|deep practical experience|dedication to building scalable|superficial patches|technical craftsmanship with active empathy|CI\/CD:\s*DevOps|not as boxes to tick|operate without heroics|systems serve the people|whether that means|—|\\vspace\{12pt\}|12pt/i.test(content)) return true;
          return false;
        })();
        if (isCoverStale) {
          coverContent = await aiService.generateTailoredCoverLetter(activeProfile, { company, role, location, keySkills, fullJd }, detectedLang);
          coverContent = aiService.humanizeText(coverContent);
          writeFileSync(coverFullPath, coverContent);
        } else {
          coverContent = readFileSync(coverFullPath, "utf-8");
        }

        // Dual-Language Support: If the resume/job is non-English, also generate/provide the English version!
        let cvEnglishPath = "";
        let cvEnglishContent = "";
        let coverEnglishPath = "";
        let coverEnglishContent = "";

        if (isNonEnglish) {
          cvEnglishPath = `cv/main_${candidateSlug}_${cleanCompany}_${cleanRole}_en.tex`;
          coverEnglishPath = `cover_letters/cover_${candidateSlug}_${cleanCompany}_${cleanRole}_en.tex`;
          const cvEnFull = join(ROOT_DIR, cvEnglishPath);
          const coverEnFull = join(ROOT_DIR, coverEnglishPath);

          const isCvEnStale = !existsSync(cvEnFull) || force || (() => {
            const content = readFileSync(cvEnFull, "utf-8");
            if (content.split("\n").length < 100) return true;
            if (/\\resumeItem\{(?:Automatisierung|Konzeption|Entwicklung|Implementierung|Zusammenarbeit|Vorbereitung|Mitarbeit|Durchf\u00fchrung|Anwendung|Master Thesis)/i.test(content)) return true;
            if (/\\resumeSubheading\{[^}]*\}\{[^}]*\}\{[^}]*(?:Ingenieurin|Mitarbeiterin|Praktikant|Wissenschaftliche)/i.test(content)) return true;
            return false;
          })();

          if (isCvEnStale) {
            cvEnglishContent = await aiService.generateTailoredCV(activeProfile, { company, role, location, keySkills, fullJd }, "en");
            writeFileSync(cvEnFull, cvEnglishContent);
          } else {
            cvEnglishContent = readFileSync(cvEnFull, "utf-8");
          }

          const isCoverEnStale = !existsSync(coverEnFull) || force || (() => {
            const content = readFileSync(coverEnFull, "utf-8");
            if (content.split("\n").length < 20) return true;
            if (/Sehr geehrte|Mit freundlichen|hiermit bewerbe/i.test(content)) return true;
            if (/proven track record|proven ability|solid track record|deep practical experience|dedication to building scalable|superficial patches|technical craftsmanship with active empathy|CI\/CD:\s*DevOps|not as boxes to tick|operate without heroics|systems serve the people|whether that means|—|\\vspace\{12pt\}|12pt/i.test(content)) return true;
            return false;
          })();

          if (isCoverEnStale) {
            coverEnglishContent = await aiService.generateTailoredCoverLetter(activeProfile, { company, role, location, keySkills, fullJd }, "en");
            coverEnglishContent = aiService.humanizeText(coverEnglishContent);
            writeFileSync(coverEnFull, coverEnglishContent);
          } else {
            coverEnglishContent = readFileSync(coverEnFull, "utf-8");
          }
        }

        // Dual ATS Evaluation: Baseline master profile fit vs. Tailored document score
        const baselineAnalysis = analysis;
        const tailoredAnalysis = analyzeTailoredResume(
          cvContent,
          { company, role, location, keySkills, fullJd },
          activeProfile,
          baselineAnalysis
        );

        // Update Tracker with tailored fit rating
        updateTracker(company, role, "drafted", cvPath, coverPath, tailoredAnalysis.overallScore);
        profilesManager.updateActiveProfileTracker(jobId || `${cleanCompany}_${cleanRole}`, {
          status: "drafted",
          cvFile: cvPath,
          coverFile: coverPath,
          fitRating: String(tailoredAnalysis.overallScore)
        });

        // Update seen_jobs with tailored analysis and dual scores
        if (seen[jobId]) {
          seen[jobId].status = "drafted";
          seen[jobId].cv_file = cvPath;
          seen[jobId].cover_file = coverPath;
          seen[jobId].fit_score = tailoredAnalysis.overallScore;
          seen[jobId].baseline_score = baselineAnalysis.overallScore;
          seen[jobId].tailored_score = tailoredAnalysis.overallScore;
          seen[jobId].analysis = tailoredAnalysis;
          seen[jobId].baseline_analysis = baselineAnalysis;
          saveSeenJobs(seen);
        }

        return new Response(JSON.stringify({
          success: true,
          cvPath,
          coverPath,
          cvFile: cvPath,
          coverFile: coverPath,
          cvContent,
          coverContent,
          language: detectedLang,
          languageName: langPack.name,
          hasDualLanguage: isNonEnglish,
          cvEnglishPath,
          cvEnglishContent,
          coverEnglishPath,
          coverEnglishContent,
          candidate: activeProfile.name,
          analysis: tailoredAnalysis,
          baselineAnalysis: baselineAnalysis,
          fit_score: tailoredAnalysis.overallScore,
          baseline_score: baselineAnalysis.overallScore,
          tailored_score: tailoredAnalysis.overallScore,
          status: "drafted",
          message: isNonEnglish
            ? `Tailored CV & Cover Letter drafted in ${langPack.name} (plus English edition) for ${company}`
            : `Tailored CV & Cover Letter drafted for ${company} (${baselineAnalysis.overallScore}% Baseline ➔ ${tailoredAnalysis.overallScore}% Tailored ATS)`
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/status (Mark as Applied / Status Update)
    if (url.pathname === "/api/status" && req.method === "POST") {
      try {
        const body = await req.json();
        const { jobId, company, role, status, url: jobUrl } = body;
        
        const activeProfile = profilesManager.getActiveProfile();
        const seenForScore = readSeenJobs();
        const sourceJob = seenForScore[jobId] || { company, title: role, url: jobUrl };
        const statusAnalysis = analyzeApplication(activeProfile, {
          company: company || sourceJob.company || "",
          role: role || sourceJob.title || "",
          location: sourceJob.location || "",
          fullJd: sourceJob.full_jd || sourceJob.summary || "",
          keySkills: sourceJob.key_skills || [],
        });
        updateTracker(company, role, status, "", "", statusAnalysis.overallScore, jobUrl);

        const seen = seenForScore;
        const targetDedup = getJobDedupKey({ company, title: role, url: jobUrl });

        let updatedCount = 0;
        for (const [k, v] of Object.entries(seen)) {
          if (k === jobId || getJobDedupKey(v) === targetDedup) {
            seen[k].status = status;
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          saveSeenJobs(seen);
        }

        return new Response(JSON.stringify({ success: true, status }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/jobs/update-jd (Update full job posting text)
    if (url.pathname === "/api/jobs/update-jd" && req.method === "POST") {
      try {
        const body = await req.json();
        const { jobId, fullJd } = body;
        if (!jobId || !fullJd) {
          return new Response(JSON.stringify({ success: false, error: "Missing jobId or fullJd" }), { status: 400 });
        }
        const seen = readSeenJobs();
        if (seen[jobId]) {
          seen[jobId].full_jd = fullJd;
          saveSeenJobs(seen);
          return new Response(JSON.stringify({ success: true, message: "Job description updated" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ success: false, error: "Job ID not found" }), { status: 404 });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/jobs/hydrate-jd (Fetch complete description from portal on demand)
    if (url.pathname === "/api/jobs/hydrate-jd" && req.method === "POST") {
      try {
        const body = await req.json();
        const { jobId } = body;
        if (!jobId) {
          return new Response(JSON.stringify({ success: false, error: "Missing jobId" }), { status: 400 });
        }
        const seen = readSeenJobs();
        const stored = seen[jobId];
        if (!stored) {
          return new Response(JSON.stringify({ success: false, error: "Job ID not found" }), { status: 404 });
        }

        const isTruncatedSnippet = !stored.full_jd ||
          stored.full_jd.length < 500 ||
          stored.full_jd.endsWith("...") ||
          stored.full_jd.endsWith("…") ||
          (stored.portal === "reed" && stored.full_jd.length < 800);

        if (stored.full_jd && stored.full_jd.length >= 500 && !isTruncatedSnippet && !body.force) {
          const activeProfile = profilesManager.getActiveProfile();
          const analysis = analyzeApplication(activeProfile, {
            company: stored.company || "",
            role: stored.title || "",
            location: stored.location || "",
            fullJd: stored.full_jd,
            keySkills: stored.key_skills || []
          });
          return new Response(JSON.stringify({ success: true, fullJd: stored.full_jd, alreadyHydrated: true, analysis }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        const fetched = await fetchJobDescription(stored);
        if (fetched && fetched.length > 50) {
          stored.full_jd = fetched;
          seen[jobId] = stored;
          saveSeenJobs(seen);
          const activeProfile = profilesManager.getActiveProfile();
          const analysis = analyzeApplication(activeProfile, {
            company: stored.company || "",
            role: stored.title || "",
            location: stored.location || "",
            fullJd: fetched,
            keySkills: stored.key_skills || []
          });
          return new Response(JSON.stringify({ success: true, fullJd: fetched, analysis }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: false, error: "Unable to retrieve description from posting portal." }), { status: 404 });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: GET /api/document
    if (url.pathname === "/api/document" && req.method === "GET") {
      const docPath = url.searchParams.get("path");
      if (!docPath) return new Response(JSON.stringify({ error: "Missing path" }), { status: 400 });
      if (!isAllowedWorkspacePath(docPath)) return new Response(JSON.stringify({ error: "Path is outside allowed document folders" }), { status: 403 });
      const fullPath = resolve(ROOT_DIR, docPath);
      if (existsSync(fullPath) && !fullPath.toLowerCase().endsWith(".pdf")) {
        const content = readFileSync(fullPath, "utf-8");
        return new Response(JSON.stringify({ content, path: docPath }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
    }

    if (url.pathname === "/api/pdf" && req.method === "GET") {
      const docPath = url.searchParams.get("path");
      const isDownload = url.searchParams.get("download") === "1";
      if (!docPath || !isAllowedWorkspacePath(docPath) || !docPath.toLowerCase().endsWith(".pdf")) {
        return new Response(JSON.stringify({ error: "Invalid PDF path" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      const fullPath = resolve(ROOT_DIR, docPath);
      if (!existsSync(fullPath)) return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
      return new Response(readFileSync(fullPath), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${basename(fullPath)}"`,
        },
      });
    }

    // API: POST /api/open-file (Open file in the system default viewer)
    if (url.pathname === "/api/open-file" && req.method === "POST") {
      try {
        const body = await req.json();
        const docPath = body.path;
        if (!docPath || !isAllowedWorkspacePath(docPath)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid path" }), { status: 403 });
        }
        const fullPath = resolve(ROOT_DIR, docPath);
        if (existsSync(fullPath)) {
          openSystemPath(fullPath);
          return new Response(JSON.stringify({ success: true, message: "File opened in system viewer" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ success: false, error: "File not found" }), { status: 404 });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/reveal-file (Reveal file in the system file browser)
    if (url.pathname === "/api/reveal-file" && req.method === "POST") {
      try {
        const body = await req.json();
        const docPath = body.path;
        if (!docPath || !isAllowedWorkspacePath(docPath)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid path" }), { status: 403 });
        }
        const fullPath = resolve(ROOT_DIR, docPath);
        if (existsSync(fullPath)) {
          openSystemPath(fullPath, true);
          return new Response(JSON.stringify({ success: true, message: "File shown in system file browser" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ success: false, error: "File not found" }), { status: 404 });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/save-to-downloads (Copy compiled file directly to user's ~/Downloads directory)
    if (url.pathname === "/api/save-to-downloads" && req.method === "POST") {
      try {
        const body = await req.json();
        const docPath = body.path;
        if (!docPath || !isAllowedWorkspacePath(docPath)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid path" }), { status: 403 });
        }
        const fullSourcePath = resolve(ROOT_DIR, docPath);
        if (!existsSync(fullSourcePath)) {
          return new Response(JSON.stringify({ success: false, error: "Source file not found" }), { status: 404 });
        }
        const targetFilename = body.filename || basename(fullSourcePath);
        const downloadsDir = join(homedir(), "Downloads");
        if (!existsSync(downloadsDir)) {
          mkdirSync(downloadsDir, { recursive: true });
        }
        const targetPath = join(downloadsDir, targetFilename);
        copyFileSync(fullSourcePath, targetPath);

        // Optionally open the file or reveal it in the system file browser.
        if (body.open) {
          openSystemPath(targetPath);
        } else {
          openSystemPath(targetPath, true);
        }

        return new Response(JSON.stringify({
          success: true,
          targetPath,
          filename: targetFilename,
          message: `Saved to Downloads: ${targetFilename}`
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: GET /api/stats
    if (url.pathname === "/api/stats" && req.method === "GET") {
      const seen = readSeenJobs();
      const activeProfile = profilesManager.getActiveProfile();
      const tracker = readTracker(activeProfile);
      const all = Object.values(seen).filter((j: any) => isJobRelevantToProfile(j, activeProfile));
      const stats = {
        total_discovered: all.length,
        near_hartlepool: all.filter((j: any) => profilesManager.calculateDistance(j.location || "", activeProfile).miles <= (activeProfile.preferredRadiusMiles || 70) && !profilesManager.calculateDistance(j.location || "", activeProfile).isRemote).length,
        remote_uk: all.filter((j: any) => profilesManager.calculateDistance(j.location || "", activeProfile).isRemote).length,
        sponsors_verified: all.filter((j: any) => checkSponsor(j.company || "", j.full_jd || j.summary || "").verified).length,
        sponsorship_explicit: all.filter((j: any) => {
          const sponsor = checkSponsor(j.company || "", j.full_jd || j.summary || "");
          return sponsor.verified && sponsor.assessment.vacancyStatus === "offered";
        }).length,
        drafted: all.filter((j: any) => {
          const key = getJobDedupKey(j);
          const t = tracker[key] || tracker[`${j.company}_${j.title}`.toLowerCase()];
          return (t && t.status === "drafted") || (j.profileId === activeProfile.id && j.status === "drafted");
        }).length,
        applied: Object.values(tracker).filter((t: any) => t.status === "applied").length,
        activeCandidate: activeProfile.name
      };
      return new Response(JSON.stringify(stats), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // API: POST /api/compile (local-only LaTeX compiler supporting Tectonic, LuaLaTeX, XeLaTeX, PDFLaTeX)
    if (url.pathname === "/api/compile" && req.method === "POST") {
      try {
        const body = await req.json();
        const { latexCode, filename = "document.pdf", kind = "cv" } = body;
        
        if (!latexCode || typeof latexCode !== "string") {
          return new Response(JSON.stringify({ error: "Missing latexCode" }), { status: 400 });
        }

        // Compiler discovery: Prefer modern self-contained tectonic, then lualatex/xelatex/pdflatex
        const candidates = [
          { name: "tectonic", paths: ["/opt/homebrew/bin/tectonic", "/usr/local/bin/tectonic", "tectonic"], isTectonic: true },
          { name: kind === "cover" ? "xelatex" : "lualatex", paths: [`/Library/TeX/texbin/${kind === "cover" ? "xelatex" : "lualatex"}`], isTectonic: false },
          { name: "xelatex", paths: ["/Library/TeX/texbin/xelatex", "/usr/local/bin/xelatex", "xelatex"], isTectonic: false },
          { name: "lualatex", paths: ["/Library/TeX/texbin/lualatex", "/usr/local/bin/lualatex", "lualatex"], isTectonic: false },
          { name: "pdflatex", paths: ["/Library/TeX/texbin/pdflatex", "/usr/local/bin/pdflatex", "pdflatex"], isTectonic: false },
        ];

        let compiler: { name: string; path: string; isTectonic: boolean } | null = null;
        for (const cand of candidates) {
          for (const p of cand.paths) {
            try {
              const chk = spawnSync(p, ["--version"], { encoding: "utf-8" });
              if (!chk.error && chk.status === 0) {
                compiler = { name: cand.name, path: p, isTectonic: cand.isTectonic };
                break;
              }
            } catch {}
          }
          if (compiler) break;
        }

        if (!compiler) {
          return new Response(JSON.stringify({
            error: "No LaTeX compiler found on system. Install tectonic via 'brew install tectonic' or TeX Live.",
            engine: "none",
          }), { status: 503, headers: { "Content-Type": "application/json" } });
        }

        const workDir = mkdtempSync(join(tmpdir(), "ai-job-search-tex-"));
        try {
          const texPath = join(workDir, "document.tex");
          let cleanLatex = latexCode;
          if (compiler.isTectonic && !cleanLatex.includes("\\ifx\\pdfgentounicode")) {
            cleanLatex = cleanLatex
              .replace(/\\input\{glyphtounicode\}/g, "\\ifx\\pdfgentounicode\\undefined\\else\\input{glyphtounicode}\\fi")
              .replace(/\\pdfgentounicode=1/g, "\\ifx\\pdfgentounicode\\undefined\\else\\pdfgentounicode=1\\fi");
          }
          writeFileSync(texPath, cleanLatex, "utf-8");

          const cmdArgs = compiler.isTectonic
            ? ["--outdir", workDir, texPath]
            : ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, texPath];

          const result = spawnSync(compiler.path, cmdArgs, {
            cwd: ROOT_DIR,
            encoding: "utf-8",
            timeout: 120000,
          });

          const pdfPath = join(workDir, "document.pdf");
          if (result.status !== 0 || !existsSync(pdfPath)) {
            return new Response(JSON.stringify({
              error: "LaTeX compilation failed.",
              engine: compiler.name,
              details: `${result.stdout || ""}\n${result.stderr || ""}`.slice(-12000),
            }), { status: 422, headers: { "Content-Type": "application/json" } });
          }

          const folder = kind === "cover" ? "cover_letters" : "cv";
          const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.tex$/i, ".pdf");
          const repoFilePath = join(ROOT_DIR, folder, safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`);
          writeFileSync(repoFilePath, readFileSync(pdfPath));
          const repoRelative = relative(ROOT_DIR, repoFilePath).split("\\").join("/");
          return new Response(JSON.stringify({
            success: true,
            filename: basename(repoFilePath),
            repoPath: repoRelative,
            downloadUrl: `/api/pdf?download=1&path=${encodeURIComponent(repoRelative)}`,
            engine: compiler.name,
            message: "Native ATS vector PDF compiled successfully.",
          }), { headers: { "Content-Type": "application/json" } });
        } finally {
          rmSync(workDir, { recursive: true, force: true });
        }
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Serve Static UI Assets from app/public
    const publicDir = resolve(APP_ROOT, "app", "public");
    const requestedAsset = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const filePath = resolve(publicDir, requestedAsset);
    const assetRelative = relative(publicDir, filePath);
    if (!assetRelative.startsWith("..") && !isAbsolute(assetRelative) && existsSync(filePath)) {
      const ext = filePath.split(".").pop();
      const contentType = ext === "css" ? "text/css" : ext === "js" ? "application/javascript" : ext === "svg" ? "image/svg+xml" : "text/html";
      return new Response(readFileSync(filePath), {
        headers: { "Content-Type": contentType }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`AI Job Search Studio is running at http://127.0.0.1:${PORT}`);

function updateTracker(
  company: string,
  role: string,
  status: string,
  cvFile = "",
  coverFile = "",
  fit = 0,
  sourceUrl = "",
  profile?: CandidateProfile
) {
  const activeProfile = profile || profilesManager.getActiveProfile();
  const dedupKey = getJobDedupKey({ company, title: role, url: sourceUrl });
  const simpleKey = `${company}_${role}`.toLowerCase();

  // Save on candidate profile tracker
  if (!activeProfile.tracker) activeProfile.tracker = {};
  activeProfile.tracker[dedupKey] = {
    status,
    cvFile,
    coverFile,
    fitRating: fit ? fit.toString() : "90",
    updatedAt: new Date().toISOString()
  };
  activeProfile.tracker[simpleKey] = activeProfile.tracker[dedupKey];
  profilesManager.saveProfile(activeProfile);

  const today = new Date().toISOString().split("T")[0];
  if (!existsSync(TRACKER_FILE)) {
    writeFileSync(TRACKER_FILE, "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline\n");
  }
  const content = readFileSync(TRACKER_FILE, "utf-8");
  const lines = content.split("\n");
  let found = false;

  const candidateSlug = activeProfile.id.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const isAjithProfile = activeProfile.id === "ajith-surya-thati";
  const isManjuProfile = activeProfile.id === "manjubhargavi-cherupally";

  const newLines = lines.map(line => {
    if (!line.trim()) return line;
    const cols = parseCsvLine(line);
    const normTrackComp = (cols[1] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetComp = (company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const normTrackRole = (cols[3] || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");
    const targetRole = (role || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");
    const lineCv = (cols[10] || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const isAjithRow = lineCv.includes("ajith");
    const isManjuRow = lineCv.includes("manju");
    const matchesCandidate = (isManjuProfile && !isAjithRow) ||
                             (isAjithProfile && !isManjuRow) ||
                             lineCv.includes(candidateSlug);

    if (cols.length >= 4 && normTrackComp === targetComp && normTrackRole === targetRole && matchesCandidate) {
      found = true;
      cols[6] = status;
      if (fit) cols[8] = fit.toString();
      if (cvFile) cols[10] = cvFile;
      if (coverFile) cols[11] = coverFile;
      if (sourceUrl && !cols[12]) cols[12] = sourceUrl;
      return cols.map(c => (c || "").includes(",") ? `"${c}"` : (c || "")).join(",");
    }
    return line;
  });

  if (!found) {
    const safeComp = company || "Company";
    const safeRole = role || "Role";
    const row = [
      today,
      safeComp.includes(",") ? `"${safeComp}"` : safeComp,
      "Technology & Cloud Engineering",
      safeRole.includes(",") ? `"${safeRole}"` : safeRole,
      "Permanent / Hybrid",
      "portal",
      status || "drafted",
      "",
      (fit || 0).toString(),
      `Candidate: ${activeProfile.name}. Created by AI Job Search Studio. Review sponsorship and document evidence before submission.`,
      cvFile || "",
      coverFile || "",
      sourceUrl ? (sourceUrl.includes(",") ? `"${sourceUrl}"` : sourceUrl) : "",
      ""
    ].join(",");
    newLines.push(row);
  }

  writeFileSync(TRACKER_FILE, newLines.filter(l => l.trim().length > 0).join("\n") + "\n");
}
