import { serve } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, copyFileSync } from "fs";
import { join, resolve, relative, basename, isAbsolute } from "path";
import { tmpdir, homedir } from "os";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { ProfilesManager, CandidateProfile } from "./profiles_manager";
import { AIService } from "./ai_service";
import { analyzeApplication } from "./application_engine";
import { createLatexBackbone } from "./resume_engine";
import { parseResumeDeterministically } from "./resume_parser";

const PORT = Number(process.env.PORT || process.env.AI_JOB_SEARCH_PORT || 3333);
const ROOT_DIR = process.env.AI_JOB_SEARCH_ROOT || process.cwd();
const SEEN_JOBS_FILE = join(ROOT_DIR, "job_scraper", "seen_jobs.json");
const TRACKER_FILE = join(ROOT_DIR, "job_search_tracker.csv");
const CANDIDATE_PROFILE_FILE = join(ROOT_DIR, ".claude", "skills", "job-application-assistant", "01-candidate-profile.md");

const profilesManager = new ProfilesManager();
const aiService = new AIService();

mkdirSync(join(ROOT_DIR, "job_scraper"), { recursive: true });
mkdirSync(join(ROOT_DIR, "cv"), { recursive: true });
mkdirSync(join(ROOT_DIR, "cover_letters"), { recursive: true });

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

function extractPdfText(bytes: Uint8Array, fileName: string): string {
  const workDir = mkdtempSync(join(tmpdir(), "ai-job-search-pdf-"));
  const input = join(workDir, basename(fileName || "resume.pdf"));
  writeFileSync(input, bytes);
  try {
    const pdftotext = spawnSync("pdftotext", ["-layout", "-enc", "UTF-8", input, "-"], { encoding: "utf-8" });
    if (pdftotext.status === 0 && pdftotext.stdout.trim()) return pdftotext.stdout;
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

async function readResumeRequest(req: Request): Promise<{ text: string; fileName: string; mediaType: string; previewOnly: boolean }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const pastedText = String(form.get("resumeText") || "").trim();
    const previewOnly = String(form.get("previewOnly") || "false") === "true";
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      return {
        text: isPdf ? extractPdfText(bytes, file.name) : new TextDecoder("utf-8", { fatal: false }).decode(bytes),
        fileName: file.name,
        mediaType: file.type || "text/plain",
        previewOnly,
      };
    }
    return { text: pastedText, fileName: "pasted-resume.txt", mediaType: "text/plain", previewOnly };
  }
  const body = await req.json() as any;
  return {
    text: String(body.resumeText || body.text || ""),
    fileName: String(body.fileName || "pasted-resume.txt"),
    mediaType: String(body.mediaType || "text/plain"),
    previewOnly: Boolean(body.previewOnly),
  };
}

// Known A-rated UK Skilled Worker Licensed Sponsors (North East & Major Tech)
const KNOWN_SPONSORS: Record<string, { status: string; license: string; notes: string }> = {
  "opencast software": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "HQ in Newcastle Upon Tyne" },
  "opencast": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "HQ in Newcastle Upon Tyne" },
  "scott logic": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "HQ in Newcastle Upon Tyne (The Lumen)" },
  "version 1": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Offices in Newcastle & Edinburgh" },
  "flutter uk&i": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Current Employer (Leeds)" },
  "sky betting & gaming": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Leeds" },
  "thoughtworks": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Offices in Newcastle & Manchester" },
  "accenture": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Newcastle Advanced Tech Centre" },
  "sage": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "HQ in Newcastle (Cobalt Park)" },
  "dwp digital": { status: "Verified", license: "Public Sector (Civil Service)", notes: "Benton Park View, Newcastle" },
  "balyasny asset management": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "London / Remote" },
  "robinhood": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "London / Remote" },
  "rowden": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Defense & Cloud tech" },
  "arq": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "London / Remote" },
  "our future health uk": { status: "Verified", license: "A-Rated (Skilled Worker)", notes: "Remote / Hybrid" },
};

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

function checkSponsor(companyStr: string): { verified: boolean; label: string; badge: string } {
  const comp = (companyStr || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(KNOWN_SPONSORS)) {
    if (comp.includes(key)) {
      return { verified: true, label: val.license, badge: "A-Rated Sponsor" };
    }
  }
  return { verified: false, label: "Check Register", badge: "Verification Needed" };
}

function readTracker(): Record<string, any> {
  if (!existsSync(TRACKER_FILE)) return {};
  const content = readFileSync(TRACKER_FILE, "utf-8");
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  if (lines.length <= 1) return {};
  
  const map: Record<string, any> = {};
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

function fetchJobDescription(job: { id?: string; url?: string; portal?: string; title?: string }): string | null {
  const url = job.url || "";
  const portal = job.portal || "";

  // 1. LinkedIn detail
  if (portal === "linkedin-search" || url.includes("linkedin.com")) {
    const liCliPath = join(ROOT_DIR, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
    if (existsSync(liCliPath) && url) {
      try {
        const res = spawnSync("bun", ["run", liCliPath, "detail", url, "--format", "json"], {
          cwd: ROOT_DIR,
          encoding: "utf-8",
          timeout: 10000
        });
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
    const freehireCliPath = join(ROOT_DIR, ".agents", "skills", "freehire-search", "cli", "src", "cli.ts");
    if (existsSync(freehireCliPath)) {
      const slugOrUrl = url || job.id?.replace(/^fh_/, "") || "";
      if (slugOrUrl) {
        try {
          const res = spawnSync("bun", ["run", freehireCliPath, "detail", slugOrUrl, "--format", "json"], {
            cwd: ROOT_DIR,
            encoding: "utf-8",
            timeout: 10000
          });
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

  return null;
}

// Scrape and structure any job posting from a direct URL (LinkedIn, Freehire, Greenhouse, Lever, direct web)
async function scrapeJobFromUrl(targetUrl: string): Promise<any> {
  const seen = readSeenJobs();
  const jobId = `ext_${Date.now()}`;
  let title = "Platform / DevOps Engineer";
  let company = "Hiring Company";
  let location = "Remote / United Kingdom";
  let fullJd = "";
  let keySkills: string[] = [];

  // 1. If it's a LinkedIn URL, invoke LinkedIn CLI detail fetcher
  if (targetUrl.includes("linkedin.com")) {
    const liCliPath = join(ROOT_DIR, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
    if (existsSync(liCliPath)) {
      try {
        const res = spawnSync("bun", ["run", liCliPath, "detail", targetUrl, "--format", "json"], {
          cwd: ROOT_DIR,
          encoding: "utf-8",
          timeout: 12000
        });
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

  // 2. Generic HTTP fetch for any web page (Greenhouse, Lever, Workable, direct website)
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

  if (!fullJd || fullJd.length < 50) {
    fullJd = `Role: ${title} at ${company} in ${location}. Ingested directly from URL: ${targetUrl}. Requires cloud platform engineering, automated CI/CD pipelines, container orchestration, and team collaboration.`;
  }

  const newJob = {
    id: jobId,
    company: company || "Company",
    title: title || "Platform Engineer",
    role: title || "Platform Engineer",
    location: location || "Remote / UK",
    status: "new",
    url: targetUrl,
    full_jd: fullJd,
    key_skills: keySkills.length ? keySkills : ["Kubernetes", "AWS", "CI/CD", "Terraform", "Docker"],
    date_scraped: new Date().toISOString(),
    source: "Instant URL Import",
    portal: "external-url",
    sponsor_verified: true,
    fit_score: 95
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
    cv_file: "cv/main_opencast_devops_senior_consultant.tex",
    cover_file: "cover_letters/cover_opencast_devops_senior_consultant.tex",
    status: "drafted",
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
    cv_file: "cv/main_scott_logic_platform_engineer__senior_lead_.tex",
    cover_file: "cover_letters/cover_scott_logic_platform_engineer__senior_lead_.tex",
    status: "drafted",
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

// Start Bun HTTP server
serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    // API: GET /api/jobs
    if (url.pathname === "/api/jobs" && req.method === "GET") {
      const seen = readSeenJobs();
      const tracker = readTracker();
      const activeProfile = profilesManager.getActiveProfile();

      const jobsList = Object.entries(seen).map(([id, item]: [string, any]) => {
        const dist = profilesManager.calculateDistance(item.location || "", activeProfile);
        const sponsor = checkSponsor(item.company || "");
        
        // Check if tracker has an entry via dedupKey, simpleKey, or normKey
        const itemDedupKey = getJobDedupKey(item);
        const simpleKey = `${item.company}_${item.title}`.toLowerCase();
        const normComp = (item.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const normRole = (item.title || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");
        const normKey = `norm_${normComp}_${normRole}`;
        const tracked = tracker[itemDedupKey] || tracker[simpleKey] || tracker[normKey];

        // Status hierarchy: applied > drafted > new
        let status = "new";
        if ((tracked && tracked.status === "applied") || item.status === "applied") {
          status = "applied";
        } else if ((tracked && tracked.status === "drafted") || item.status === "drafted") {
          status = "drafted";
        } else {
          status = (tracked && tracked.status) || item.status || "new";
        }

        const cvFile = (tracked && tracked.cvFile) ? tracked.cvFile : (item.cv_file || "");
        const coverFile = (tracked && tracked.coverFile) ? tracked.coverFile : (item.cover_file || "");

        const fullJd = item.full_jd || item.summary || "";
        const analysis = analyzeApplication(activeProfile, {
          company: item.company || "",
          role: item.title || "",
          location: item.location || "",
          fullJd,
          keySkills: item.key_skills || [],
        });

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
          fit_score: analysis.overallScore,
          fit_verdict: analysis.verdict,
          analysis,
          summary: item.summary || fullJd.slice(0, 260),
          full_jd: fullJd,
          key_skills: item.key_skills || analysis.requirements.filter(r => r.category === "technical").map(r => r.requirement),
          sponsor_verified: sponsor.verified,
          sponsor_badge: sponsor.badge,
          sponsor_label: sponsor.label,
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
        const newProfile: CandidateProfile = {
          id: (parsed.name || "candidate").toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4),
          name: parsed.name || "",
          headline: parsed.headline || "",
          summary: parsed.summary || "",
          email: parsed.email || "",
          phone: parsed.phone || "",
          location: parsed.location || "",
          postcode: parsed.postcode || "",
          linkedin: parsed.linkedin || "",
          github: parsed.github || "",
          portfolio: parsed.portfolio || "",
          visaSponsorshipRequired: parsed.visaSponsorshipRequired ?? false,
          targetRoles: parsed.targetRoles?.filter(Boolean) || (parsed.headline ? [parsed.headline] : []),
          targetLocations: parsed.targetLocations?.filter(Boolean) || [],
          preferredRadiusMiles: parsed.preferredRadiusMiles || 50,
          minSalary: parsed.minSalary || 0,
          skills: parsed.skills || { cloud: [], devops: [], languages: [], tools: [] },
          experience: (parsed.experience as any) || [],
          projects: (parsed.projects as any) || [],
          education: (parsed.education as any) || [],
          certifications: (parsed.certifications as any) || [],
          spokenLanguages: parsed.spokenLanguages || ["English"],
          latexBackbone: createLatexBackbone(),
          profileVersion: 1,
          sourceResume: {
            fileName: incoming.fileName,
            mediaType: incoming.mediaType,
            importedAt: new Date().toISOString(),
            sha256: createHash("sha256").update(resumeText).digest("hex"),
            text: resumeText,
            ...(incoming.fileName.toLowerCase().endsWith(".tex") ? { originalLatex: resumeText } : {}),
          },
          tracker: {},
          scenarioHistory: [`Imported from ${incoming.fileName}`]
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
        const { prompt } = body;
        if (!prompt || !prompt.trim()) {
          return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), { status: 400 });
        }

        const activeProfile = profilesManager.getActiveProfile();
        const outcome = await aiService.processScenario(prompt, activeProfile);

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
            explanation: `⚡ Ingested "${newJob.title} at ${newJob.company}" from URL. Tailoring application...`,
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
      const config = aiService.getConfig();
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
        const updated = aiService.saveConfig(body);
        const health = await aiService.checkHealth();
        return new Response(JSON.stringify({ success: true, config: updated, health }), {
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
        const { provider = "ollama", apiKey } = body;
        const recommendation = await aiService.getRecommendedModel(provider, apiKey);
        let cloudModels: string[] = [];
        if (provider === "openai" || provider === "anthropic") {
          cloudModels = await aiService.fetchCloudModels(provider, apiKey);
        }
        return new Response(JSON.stringify({ success: true, ...recommendation, cloudModels }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/scrape (Trigger Automated Live Search)
    if (url.pathname === "/api/scrape" && req.method === "POST") {
      try {
        console.log("Starting automated live search across priority locations...");
        const activeProfile = profilesManager.getActiveProfile();
        const targetRoles = (activeProfile?.targetRoles && activeProfile.targetRoles.length > 0)
          ? activeProfile.targetRoles.slice(0, 4)
          : [activeProfile?.headline || "Software Engineer"];

        const targetLocations = (activeProfile?.targetLocations && activeProfile.targetLocations.length > 0)
          ? activeProfile.targetLocations.slice(0, 3)
          : [activeProfile?.location || "United Kingdom"];

        // Dynamically build search queries from active candidate's target roles and locations
        const liQueries: Array<{ q: string; l: string }> = [];
        for (const role of targetRoles) {
          liQueries.push({ q: role, l: "United Kingdom" });
          for (const loc of targetLocations) {
            if (loc.toLowerCase() !== "united kingdom" && loc.toLowerCase() !== "remote") {
              liQueries.push({ q: role, l: loc });
            }
          }
        }
        if (targetRoles.length > 0) {
          liQueries.push({ q: targetRoles[0], l: "Remote, United Kingdom" });
        }

        const liCliPath = join(ROOT_DIR, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
        let addedCount = 0;
        let enrichedCount = 0;
        const seen = readSeenJobs();

        // Top candidate skills for default tagging if posting has none
        const activeSkills = Object.values(activeProfile?.skills || {})
          .flat()
          .filter(Boolean)
          .slice(0, 6) as string[];
        const defaultSkills = activeSkills.length ? activeSkills : ["Software Engineering", "Full Stack", "Problem Solving"];

        for (const query of liQueries) {
          const res = spawnSync("bun", ["run", liCliPath, "search", "-q", query.q, "-l", query.l, "--jobage", "7", "--limit", "8"], {
            cwd: ROOT_DIR,
            encoding: "utf-8"
          });

          if (res.status === 0 && res.stdout) {
            try {
              const data = JSON.parse(res.stdout);
              if (data.results && Array.isArray(data.results)) {
                for (const r of data.results) {
                  const jobId = `li_${r.id}`;
                  const candidate = { id: jobId, title: r.title, company: r.company, url: r.url };
                  const candKey = getJobDedupKey(candidate);
                  
                  const existingKey = Object.keys(seen).find((k: string) => getJobDedupKey(seen[k]) === candKey);

                  if (!existingKey && !seen[jobId]) {
                    const sponsor = checkSponsor(r.company);
                    const fullJd = fetchJobDescription({ url: r.url, portal: "linkedin-search" }) || "";
                    seen[jobId] = {
                      title: r.title,
                      company: r.company,
                      url: r.url,
                      location: r.location,
                      posted_date: r.date,
                      first_seen: new Date().toISOString().split("T")[0],
                      fit: "high",
                      fit_score: sponsor.verified ? 94 : 88,
                      summary: `Live posting from ${r.company} for ${r.title} in ${r.location}.`,
                      full_jd: fullJd,
                      key_skills: defaultSkills,
                      status: "new",
                      portal: "linkedin-search",
                      source: "cli"
                    };
                    addedCount++;
                  }
                }
              }
            } catch (err) {
              console.error("Error parsing LinkedIn scrape result:", err);
            }
          }
        }

        // 2. Freehire ATS Aggregator Search (~50 ATS boards: Greenhouse, Lever, Ashby, Workable, Workday)
        const freehireCliPath = join(ROOT_DIR, ".agents", "skills", "freehire-search", "cli", "src", "cli.ts");
        if (existsSync(freehireCliPath)) {
          const freehireArgsList: Array<string[]> = [];
          for (const role of targetRoles.slice(0, 3)) {
            freehireArgsList.push(["search", "-q", role, "--country", "GB", "--jobage", "7", "--limit", "15"]);
          }

          const candidateSkillsFaceted = activeSkills
            .map(s => s.toLowerCase().split(/[\s(/,]/)[0])
            .filter(s => s && s.length > 2 && s.length < 15)
            .slice(0, 4);

          if (candidateSkillsFaceted.length > 0) {
            freehireArgsList.push(["search", "--skill", candidateSkillsFaceted.join(","), "--country", "GB", "--jobage", "7", "--limit", "15"]);
          }

          for (const args of freehireArgsList) {
            const res = spawnSync("bun", ["run", freehireCliPath, ...args], {
              cwd: ROOT_DIR,
              encoding: "utf-8"
            });

            if (res.status === 0 && res.stdout) {
              try {
                const data = JSON.parse(res.stdout);
                const items = data.results || data.jobs || [];
                if (Array.isArray(items)) {
                  for (const job of items) {
                    const cleanSlug = (job.slug || job.id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
                    const jobId = `fh_${cleanSlug}`;
                    const compName = job.company || job.company_name || "Tech Company";
                    const candidate = { id: jobId, title: job.title, company: compName, url: job.url };
                    const candKey = getJobDedupKey(candidate);

                    const existingKey = Object.keys(seen).find((k: string) => getJobDedupKey(seen[k]) === candKey);

                    if (!existingKey && !seen[jobId]) {
                      const sponsor = checkSponsor(compName);
                      seen[jobId] = {
                        title: job.title,
                        company: compName,
                        url: job.url,
                        location: job.location || (job.work_mode === "remote" ? "Remote (UK)" : "United Kingdom"),
                        posted_date: job.date || (job.posted_at ? job.posted_at.split("T")[0] : new Date().toISOString().split("T")[0]),
                        first_seen: new Date().toISOString().split("T")[0],
                        fit: "high",
                        fit_score: sponsor.verified ? 95 : 89,
                        summary: job.summary || `Live direct ATS posting for ${job.title} at ${compName}.`,
                        full_jd: job.description || "",
                        key_skills: (job.skills && job.skills.length > 0) ? job.skills.slice(0, 6) : ["AWS", "Kubernetes", "IaC", "DevOps"],
                        salary: job.salary_min ? `£${job.salary_min.toLocaleString()} - £${(job.salary_max || job.salary_min * 1.3).toLocaleString()}` : "Competitive Market Rate",
                        status: "new",
                        portal: "freehire-ats",
                        source: "cli"
                      };
                      addedCount++;
                    } else if (existingKey) {
                      // Deduplication: Already exists on another portal (e.g. LinkedIn cross-posting)
                      // Enrich existing job with full ATS job description and skills without duplicating
                      if (job.description && (!seen[existingKey].full_jd || seen[existingKey].full_jd.length < job.description.length)) {
                        seen[existingKey].full_jd = job.description;
                        enrichedCount++;
                      }
                      if (!seen[existingKey].key_skills || seen[existingKey].key_skills.length < 3) {
                        seen[existingKey].key_skills = (job.skills && job.skills.length > 0) ? job.skills.slice(0, 6) : seen[existingKey].key_skills;
                      }
                    }
                  }
                }
              } catch (err) {
                console.error("Error parsing Freehire result:", err);
              }
            }
          }
        }

        saveSeenJobs(seen);
        return new Response(JSON.stringify({ success: true, addedCount }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
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

        const company = body.company || storedJob.company || "Company";
        const role = body.role || storedJob.role || storedJob.title || "Platform Engineer";
        const location = body.location || storedJob.location || "United Kingdom";
        const keySkills = (body.keySkills && body.keySkills.length) ? body.keySkills : (storedJob.key_skills || storedJob.keySkills || []);

        let fullJd = String(body.fullJd || storedJob.full_jd || storedJob.summary || "").trim();
        if (fullJd.length < 150) {
          const fetchedJd = fetchJobDescription(storedJob);
          if (fetchedJd && fetchedJd.length > 50) {
            fullJd = fetchedJd;
            storedJob.full_jd = fullJd;
            seen[jobId] = { ...storedJob, full_jd: fullJd };
            saveSeenJobs(seen);
          }
        }
        if (fullJd.length < 40) {
          const defaultFocus = keySkills.length ? keySkills.join(", ") : (activeProfile.targetRoles || []).join(", ") || "core technical requirements";
          fullJd = `Role: ${role} at ${company} in ${location}. Focus competencies and requirements: ${defaultFocus}. High quality delivery, production reliability, and cross-functional collaboration.`;
        }
        const analysis = analyzeApplication(activeProfile, { company, role, location, keySkills, fullJd });
        if (!force && (analysis.gates.eligibility.verdict === "FAIL" || analysis.gates.language.verdict === "FAIL")) {
          return new Response(JSON.stringify({ success: false, error: "This role fails a mandatory eligibility or language gate.", analysis }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        
        const candidateSlug = (activeProfile.name || "candidate").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
        const cleanCompany = (company || "Company").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const cleanRole = (role || "Role").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        
        const cvPath = `cv/main_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;
        const coverPath = `cover_letters/cover_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;

        const cvFullPath = join(ROOT_DIR, cvPath);
        const coverFullPath = join(ROOT_DIR, coverPath);

        let cvContent = "";
        let coverContent = "";

        // Regenerate if force requested, file doesn't exist, or file is a legacy basic stub (< 100 lines)
        const isCvStale = !existsSync(cvFullPath) || force || (existsSync(cvFullPath) && readFileSync(cvFullPath, "utf-8").split("\n").length < 100);
        if (isCvStale) {
          cvContent = await aiService.generateTailoredCV(activeProfile, { company, role, location, keySkills, fullJd });
          writeFileSync(cvFullPath, cvContent);
        } else {
          cvContent = readFileSync(cvFullPath, "utf-8");
        }

        const isCoverStale = !existsSync(coverFullPath) || force || (existsSync(coverFullPath) && readFileSync(coverFullPath, "utf-8").split("\n").length < 30);
        if (isCoverStale) {
          coverContent = await aiService.generateTailoredCoverLetter(activeProfile, { company, role, location, keySkills, fullJd });
          writeFileSync(coverFullPath, coverContent);
        } else {
          coverContent = readFileSync(coverFullPath, "utf-8");
        }

        // Re-score application with tailored content (capturing targeted summary and aligned title)
        const summaryMatch = cvContent.match(/\\section\{Summary\}[\s\S]*?\\small\{([\s\S]*?)\}/i);
        const tailoredSummary = summaryMatch ? summaryMatch[1].replace(/\\([&%$#_{}])/g, "$1").trim() : activeProfile.summary;
        const tailoredProfile = {
          ...activeProfile,
          headline: role,
          summary: tailoredSummary
        };
        const tailoredAnalysis = analyzeApplication(tailoredProfile, { company, role, location, keySkills, fullJd });

        // Update Tracker with tailored fit rating
        updateTracker(company, role, "drafted", cvPath, coverPath, tailoredAnalysis.overallScore);
        profilesManager.updateActiveProfileTracker(jobId || `${cleanCompany}_${cleanRole}`, {
          status: "drafted",
          cvFile: cvPath,
          coverFile: coverPath,
          fitRating: String(tailoredAnalysis.overallScore)
        });

        // Update seen_jobs with tailored analysis and score
        if (seen[jobId]) {
          seen[jobId].status = "drafted";
          seen[jobId].cv_file = cvPath;
          seen[jobId].cover_file = coverPath;
          seen[jobId].fit_score = tailoredAnalysis.overallScore;
          seen[jobId].analysis = tailoredAnalysis;
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
          candidate: activeProfile.name,
          analysis: tailoredAnalysis,
          fit_score: tailoredAnalysis.overallScore,
          status: "drafted",
          message: `Tailored CV & Cover Letter drafted for ${company} (${tailoredAnalysis.overallScore}% ATS Match)`
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

        if (stored.full_jd && stored.full_jd.length > 200) {
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

        const fetched = fetchJobDescription(stored);
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

    // API: POST /api/open-file (Open file in macOS Preview or system default viewer)
    if (url.pathname === "/api/open-file" && req.method === "POST") {
      try {
        const body = await req.json();
        const docPath = body.path;
        if (!docPath || !isAllowedWorkspacePath(docPath)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid path" }), { status: 403 });
        }
        const fullPath = resolve(ROOT_DIR, docPath);
        if (existsSync(fullPath)) {
          spawnSync("open", [fullPath]);
          return new Response(JSON.stringify({ success: true, message: "File opened in system viewer" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ success: false, error: "File not found" }), { status: 404 });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // API: POST /api/reveal-file (Reveal file in macOS Finder)
    if (url.pathname === "/api/reveal-file" && req.method === "POST") {
      try {
        const body = await req.json();
        const docPath = body.path;
        if (!docPath || !isAllowedWorkspacePath(docPath)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid path" }), { status: 403 });
        }
        const fullPath = resolve(ROOT_DIR, docPath);
        if (existsSync(fullPath)) {
          spawnSync("open", ["-R", fullPath]);
          return new Response(JSON.stringify({ success: true, message: "File revealed in Finder" }), {
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

        // Optionally open in Preview or reveal in Finder
        if (body.open) {
          spawnSync("open", [targetPath]);
        } else {
          spawnSync("open", ["-R", targetPath]);
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
      const tracker = readTracker();
      const activeProfile = profilesManager.getActiveProfile();
      const all = Object.values(seen);
      const stats = {
        total_discovered: all.length,
        near_hartlepool: all.filter((j: any) => profilesManager.calculateDistance(j.location || "", activeProfile).miles <= (activeProfile.preferredRadiusMiles || 70) && !profilesManager.calculateDistance(j.location || "", activeProfile).isRemote).length,
        remote_uk: all.filter((j: any) => profilesManager.calculateDistance(j.location || "", activeProfile).isRemote).length,
        sponsors_verified: all.filter((j: any) => checkSponsor(j.company || "").verified).length,
        drafted: all.filter((j: any) => j.status === "drafted").length,
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
    const publicDir = resolve(ROOT_DIR, "app", "public");
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

function updateTracker(company: string, role: string, status: string, cvFile = "", coverFile = "", fit = 0, sourceUrl = "") {
  const today = new Date().toISOString().split("T")[0];
  if (!existsSync(TRACKER_FILE)) {
    writeFileSync(TRACKER_FILE, "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline\n");
  }
  const content = readFileSync(TRACKER_FILE, "utf-8");
  const lines = content.split("\n");
  let found = false;
  const newLines = lines.map(line => {
    if (!line.trim()) return line;
    const cols = parseCsvLine(line);
    const normTrackComp = (cols[1] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetComp = (company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const normTrackRole = (cols[3] || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");
    const targetRole = (role || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]/g, "");

    if (cols.length >= 4 && normTrackComp === targetComp && normTrackRole === targetRole) {
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
      `Created by AI Job Search Studio. Review sponsorship and document evidence before submission.`,
      cvFile || "",
      coverFile || "",
      sourceUrl ? (sourceUrl.includes(",") ? `"${sourceUrl}"` : sourceUrl) : "",
      ""
    ].join(",");
    newLines.push(row);
  }

  writeFileSync(TRACKER_FILE, newLines.filter(l => l.trim().length > 0).join("\n") + "\n");
}
