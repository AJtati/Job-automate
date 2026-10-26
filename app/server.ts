import { serve } from "bun";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";
import { ProfilesManager, CandidateProfile } from "./profiles_manager";
import { AIService } from "./ai_service";

const PORT = 3333;
const ROOT_DIR = process.cwd();
const SEEN_JOBS_FILE = join(ROOT_DIR, "job_scraper", "seen_jobs.json");
const TRACKER_FILE = join(ROOT_DIR, "job_search_tracker.csv");
const CANDIDATE_PROFILE_FILE = join(ROOT_DIR, ".claude", "skills", "job-application-assistant", "01-candidate-profile.md");

const profilesManager = new ProfilesManager();
const aiService = new AIService();

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

        // Dynamic fit score based on active profile target roles and skills
        let fitScore = item.fit_score || 85;
        const titleLower = (item.title || "").toLowerCase();
        const targetRoles = activeProfile.targetRoles || [];
        const isTargetMatch = targetRoles.some(r => titleLower.includes(r.toLowerCase()) || r.toLowerCase().includes(titleLower));
        if (isTargetMatch) fitScore = Math.max(fitScore, sponsor.verified ? 96 : 92);

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
          fit_score: fitScore,
          summary: item.summary || `Senior Cloud / DevOps role at ${item.company} requiring modern cloud architecture and automation.`,
          full_jd: item.full_jd || item.summary || "",
          key_skills: item.key_skills || ["AWS", "Kubernetes", "Terraform", "CI/CD"],
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

    // API: POST /api/profiles/import-resume (Parse pasted plain text CV into profile)
    if (url.pathname === "/api/profiles/import-resume" && req.method === "POST") {
      try {
        const body = await req.json();
        const { resumeText } = body;
        if (!resumeText || resumeText.trim().length < 50) {
          return new Response(JSON.stringify({ success: false, error: "Please paste a complete resume or CV text." }), { status: 400 });
        }

        const parsed = await aiService.parseResumeText(resumeText);
        const newProfile: CandidateProfile = {
          id: (parsed.name || "candidate").toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4),
          name: parsed.name || "New Candidate",
          headline: parsed.headline || "Software / Platform Engineer",
          email: parsed.email || "",
          phone: parsed.phone || "",
          location: parsed.location || "United Kingdom",
          postcode: parsed.postcode || "",
          linkedin: parsed.linkedin || "",
          github: parsed.github || "",
          portfolio: "",
          visaSponsorshipRequired: parsed.visaSponsorshipRequired ?? true,
          targetRoles: parsed.targetRoles || [parsed.headline || "Senior Platform Engineer"],
          targetLocations: parsed.targetLocations || ["Remote", "London", "Manchester", "Leeds"],
          preferredRadiusMiles: parsed.preferredRadiusMiles || 60,
          minSalary: parsed.minSalary || 75000,
          skills: parsed.skills || { cloud: ["AWS"], devops: ["Kubernetes", "Terraform"], languages: ["Python"], tools: ["Git"] },
          experience: (parsed.experience as any) || [],
          education: (parsed.education as any) || [],
          certifications: (parsed.certifications as any) || [],
          tracker: {},
          scenarioHistory: ["Imported from raw resume"]
        };

        const saved = profilesManager.saveProfile(newProfile);
        profilesManager.setActiveProfile(saved.id);

        return new Response(JSON.stringify({ success: true, profile: saved }), {
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

        // Apply profile updates if any
        if (Object.keys(outcome.profileUpdates).length > 0) {
          const updated = {
            ...activeProfile,
            ...outcome.profileUpdates,
            scenarioHistory: [...(activeProfile.scenarioHistory || []), prompt]
          };
          profilesManager.saveProfile(updated);
        }

        return new Response(JSON.stringify({
          success: true,
          explanation: outcome.explanation,
          profileUpdates: outcome.profileUpdates,
          feedFilters: outcome.feedFilters,
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
        // 1. LinkedIn Search across priority UK regions & nationwide
        const liQueries = [
          { q: "Senior Platform Engineer", l: "United Kingdom" },
          { q: "Senior DevOps Engineer", l: "United Kingdom" },
          { q: "Site Reliability Engineer", l: "United Kingdom" },
          { q: "Senior Platform Engineer", l: "Remote, United Kingdom" },
          { q: "Senior Platform Engineer", l: "Newcastle upon Tyne" },
          { q: "Senior DevOps Engineer", l: "Leeds" },
          { q: "Platform Engineer", l: "Edinburgh" },
          { q: "Senior Platform Engineer", l: "London" },
          { q: "Senior DevOps Engineer", l: "Manchester" }
        ];

        const liCliPath = join(ROOT_DIR, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts");
        let addedCount = 0;
        let enrichedCount = 0;
        const seen = readSeenJobs();

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
                      key_skills: ["AWS", "Kubernetes", "DevOps", "CI/CD"],
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
          const freehireArgsList = [
            ["search", "-q", "Platform Engineer", "--country", "GB", "--jobage", "7", "--limit", "15"],
            ["search", "-q", "DevOps Engineer", "--country", "GB", "--jobage", "7", "--limit", "15"],
            ["search", "-q", "Site Reliability Engineer", "--country", "GB", "--jobage", "7", "--limit", "15"],
            ["search", "-q", "Cloud Infrastructure", "--country", "GB", "--jobage", "7", "--limit", "15"],
            ["search", "--skill", "kubernetes,aws,terraform", "--country", "GB", "--jobage", "7", "--limit", "15"]
          ];

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
        const { jobId, company, role, location, keySkills, force } = body;
        const activeProfile = profilesManager.getActiveProfile();
        
        const candidateSlug = (activeProfile.name || "candidate").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
        const cleanCompany = (company || "Company").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const cleanRole = (role || "DevOps").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        
        const cvPath = `cv/main_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;
        const coverPath = `cover_letters/cover_${candidateSlug}_${cleanCompany}_${cleanRole}.tex`;

        const cvFullPath = join(ROOT_DIR, cvPath);
        const coverFullPath = join(ROOT_DIR, coverPath);

        let cvContent = "";
        let coverContent = "";

        // Regenerate if force requested, file doesn't exist, or file is a legacy basic stub (< 100 lines)
        const isCvStale = !existsSync(cvFullPath) || force || (existsSync(cvFullPath) && readFileSync(cvFullPath, "utf-8").split("\n").length < 100);
        if (isCvStale) {
          cvContent = await aiService.generateTailoredCV(activeProfile, { company, role, location, keySkills });
          writeFileSync(cvFullPath, cvContent);
        } else {
          cvContent = readFileSync(cvFullPath, "utf-8");
        }

        const isCoverStale = !existsSync(coverFullPath) || force || (existsSync(coverFullPath) && readFileSync(coverFullPath, "utf-8").split("\n").length < 30);
        if (isCoverStale) {
          coverContent = await aiService.generateTailoredCoverLetter(activeProfile, { company, role, location, keySkills });
          writeFileSync(coverFullPath, coverContent);
        } else {
          coverContent = readFileSync(coverFullPath, "utf-8");
        }

        // Update Tracker
        updateTracker(company, role, "drafted", cvPath, coverPath, 94);
        profilesManager.updateActiveProfileTracker(jobId || `${cleanCompany}_${cleanRole}`, {
          status: "drafted",
          cvFile: cvPath,
          coverFile: coverPath,
          fitRating: "94"
        });

        // Update seen_jobs
        const seen = readSeenJobs();
        if (seen[jobId]) {
          seen[jobId].status = "drafted";
          seen[jobId].cv_file = cvPath;
          seen[jobId].cover_file = coverPath;
          saveSeenJobs(seen);
        }

        return new Response(JSON.stringify({
          success: true,
          cvPath,
          coverPath,
          cvContent,
          coverContent,
          candidate: activeProfile.name
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
        
        updateTracker(company, role, status, "", "", 94, jobUrl);

        const seen = readSeenJobs();
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

    // API: GET /api/document
    if (url.pathname === "/api/document" && req.method === "GET") {
      const docPath = url.searchParams.get("path");
      if (!docPath) return new Response(JSON.stringify({ error: "Missing path" }), { status: 400 });
      const fullPath = join(ROOT_DIR, docPath);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, "utf-8");
        return new Response(JSON.stringify({ content, path: docPath }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
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

    // API: POST /api/compile (Direct LaTeX to PDF Compiler Engine - Photomaker Integration)
    if (url.pathname === "/api/compile" && req.method === "POST") {
      try {
        const body = await req.json();
        const { latexCode, filename = "document.pdf" } = body;
        
        if (!latexCode || typeof latexCode !== "string") {
          return new Response(JSON.stringify({ error: "Missing latexCode" }), { status: 400 });
        }

        const fd = new FormData();
        fd.append("filecontents[]", latexCode);
        fd.append("filename[]", "document.tex");
        fd.append("engine", "pdflatex");
        fd.append("return", "pdf");

        const compileRes = await fetch("https://texlive.net/cgi-bin/latexcgi", {
          method: "POST",
          body: fd
        });

        const buf = await compileRes.arrayBuffer();
        const header = Buffer.from(buf.slice(0, 5)).toString();

        if (compileRes.ok && header === "%PDF-") {
          const uint8 = new Uint8Array(buf);
          
          // 1. Save directly to ~/Downloads/
          const downloadsDir = join(homedir(), "Downloads");
          const downloadFilePath = join(downloadsDir, filename);
          writeFileSync(downloadFilePath, uint8);

          // 2. Also save to workspace cv/ or cover_letters/
          const folder = filename.toLowerCase().includes("cover") ? "cover_letters" : "cv";
          const repoFilePath = join(ROOT_DIR, folder, filename);
          writeFileSync(repoFilePath, uint8);

          // 3. Open in macOS Preview immediately
          spawnSync("open", [downloadFilePath]);

          return new Response(JSON.stringify({
            success: true,
            filename,
            downloadPath: downloadFilePath,
            repoPath: repoFilePath,
            message: `PDF saved to ~/Downloads/${filename} and opened in Preview`
          }), {
            headers: { "Content-Type": "application/json" }
          });
        } else {
          const errMsg = Buffer.from(buf).toString();
          return new Response(JSON.stringify({ error: "LaTeX compilation error", details: errMsg }), {
            status: 422,
            headers: { "Content-Type": "application/json" }
          });
        }
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Serve Static UI Assets from app/public
    let filePath = join(ROOT_DIR, "app", "public", url.pathname === "/" ? "index.html" : url.pathname);
    if (existsSync(filePath)) {
      const ext = filePath.split(".").pop();
      const contentType = ext === "css" ? "text/css" : ext === "js" ? "application/javascript" : ext === "svg" ? "image/svg+xml" : "text/html";
      return new Response(readFileSync(filePath), {
        headers: { "Content-Type": contentType }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`\n========================================================`);
console.log(`🍎 AI Job Search Mac Desktop App is running live!`);
console.log(`🌐 Local URL: http://localhost:${PORT}`);
console.log(`========================================================\n`);

function updateTracker(company: string, role: string, status: string, cvFile = "", coverFile = "", fit = 94, sourceUrl = "") {
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
      if (cvFile) cols[10] = cvFile;
      if (coverFile) cols[11] = coverFile;
      if (sourceUrl && !cols[12]) cols[12] = sourceUrl;
      return cols.map(c => c.includes(",") ? `"${c}"` : c).join(",");
    }
    return line;
  });

  if (!found) {
    const row = [
      today,
      company.includes(",") ? `"${company}"` : company,
      "Technology & Cloud Engineering",
      role.includes(",") ? `"${role}"` : role,
      "Permanent / Hybrid",
      "portal",
      status,
      "",
      fit.toString(),
      `A-rated Sponsor verified. Curated via Mac Studio.`,
      cvFile,
      coverFile,
      sourceUrl ? (sourceUrl.includes(",") ? `"${sourceUrl}"` : sourceUrl) : "",
      ""
    ].join(",");
    newLines.push(row);
  }

  writeFileSync(TRACKER_FILE, newLines.filter(l => l.trim().length > 0).join("\n") + "\n");
}
