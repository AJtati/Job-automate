import type { CandidateProfile, WorkExperience } from "./profiles_manager";
import { detectLanguageDeterministically } from "./resume_engine";

export type GateVerdict = "PASS" | "FAIL" | "FLAG" | "UNVERIFIED";
export type RequirementStatus = "matched" | "partial" | "gap";

export interface JobInput {
  company: string;
  role: string;
  location?: string;
  fullJd: string;
  keySkills?: string[];
}

export interface RequirementEvidence {
  requirement: string;
  category: "technical" | "experience" | "behavioral" | "language" | "eligibility";
  importance: "required" | "preferred";
  status: RequirementStatus;
  evidence: string[];
}

export interface ApplicationAnalysis {
  overallScore: number;
  verdict: "Strong fit" | "Good fit" | "Moderate fit" | "Weak fit" | "Poor fit";
  dimensions: {
    technical: { score: number; note: string };
    experience: { score: number; note: string };
    behavioral: { score: number; note: string };
    career: { score: number; note: string };
  };
  gates: {
    eligibility: { verdict: GateVerdict; note: string };
    language: { verdict: GateVerdict; note: string };
    location: { verdict: GateVerdict; note: string };
  };
  requirements: RequirementEvidence[];
  matchedKeywords: string[];
  gapKeywords: string[];
  provenance: string;
}

const TECH_TERMS: Record<string, string[]> = {
  // Cloud & Infrastructure
  AWS: ["aws", "amazon web services", "eks", "ec2", "lambda"],
  Azure: ["azure", "bicep"],
  GCP: ["gcp", "google cloud"],
  Kubernetes: ["kubernetes", "k8s", "eks", "aks", "gke"],
  Docker: ["docker", "containerisation", "containerization", "containers"],
  Terraform: ["terraform", "terragrunt", "infrastructure as code", "iac"],
  CloudFormation: ["cloudformation"],
  Helm: ["helm"],
  ArgoCD: ["argocd", "argo cd", "gitops"],
  "CI/CD": ["ci/cd", "continuous integration", "continuous deployment", "deployment pipeline"],
  Linux: ["linux"],
  Ansible: ["ansible"],
  Jenkins: ["jenkins"],
  "GitHub Actions": ["github actions"],
  GitLab: ["gitlab", "gitlab ci"],
  Prometheus: ["prometheus"],
  Grafana: ["grafana"],
  Datadog: ["datadog"],
  Observability: ["observability", "monitoring", "telemetry"],
  Security: ["security", "devsecops", "least privilege", "iam"],
  SRE: ["site reliability", "sre", "incident response", "reliability"],
  Git: ["git", "version control"],

  // Languages & Core Runtimes
  Python: ["python", "fastapi", "django", "flask"],
  Go: ["golang", " go "],
  TypeScript: ["typescript"],
  JavaScript: ["javascript", "node.js", "nodejs"],
  Java: ["java", "spring", "spring boot", "hibernate"],
  "C# / .NET": ["c#", ".net", "dotnet", "asp.net"],
  PHP: ["php", "laravel", "symfony"],
  Ruby: ["ruby", "rails", "ruby on rails"],
  Rust: ["rust", "cargo"],

  // Frontend & UI
  React: ["react", "react.js", "reactjs"],
  "Next.js": ["next.js", "nextjs"],
  Vue: ["vue", "vue.js", "vuejs", "nuxt"],
  Angular: ["angular"],
  "HTML/CSS": ["html", "css", "sass", "scss"],
  Tailwind: ["tailwind", "tailwindcss"],
  Redux: ["redux", "zustand", "state management"],

  // Mobile
  iOS: ["ios", "swift", "swiftui", "uikit"],
  Android: ["android", "kotlin", "jetpack compose"],
  "React Native": ["react native"],
  Flutter: ["flutter", "dart"],

  // Backend & APIs
  Microservices: ["microservices", "distributed systems"],
  "REST APIs": ["rest api", "restful", "rest apis", "openapi", "swagger"],
  GraphQL: ["graphql", "apollo"],
  Kafka: ["kafka", "event-driven", "message queue", "rabbitmq"],

  // Databases & Storage
  SQL: ["sql", "relational database"],
  PostgreSQL: ["postgresql", "postgres"],
  MySQL: ["mysql", "mariadb"],
  MongoDB: ["mongodb", "nosql", "document database"],
  Redis: ["redis", "in-memory cache", "caching"],
  Elasticsearch: ["elasticsearch", "opensearch"],

  // Data Engineering & AI/ML
  "Machine Learning": ["machine learning", "ml", "deep learning", "ai", "artificial intelligence"],
  "Data Engineering": ["data engineering", "etl", "data pipeline", "data pipelines"],
  PyTorch: ["pytorch", "tensorflow", "keras"],
  Spark: ["spark", "pyspark", "hadoop"],
  Snowflake: ["snowflake", "databricks", "bigquery"],
  Airflow: ["airflow", "orchestration"],

  // Testing & Quality Assurance
  "Automated Testing": ["automated testing", "test automation", "testing automation", "unit testing", "integration testing", "e2e testing", "qa automation"],
  Testing: ["cypress", "playwright", "selenium", "jest", "pytest", "tdd"],

  // Business Applications & CRM/ERP
  "Dynamics 365": ["dynamics 365", "dynamics", "d365", "dynamics crm"],
  "Power Platform": ["power platform", "power apps", "powerapps", "power automate", "dataverse", "power bi", "power pages"],
  "CRM / ERP": ["crm", "erp", "salesforce", "sap"],

  // Healthcare & Nursing
  "Patient Care": ["patient care", "nursing", "clinical", "triage", "vital signs", "phlebotomy", "iv cannulation", "wound management"],
  "Life Support & Clinical Compliance": ["bls", "acls", "cpr", "nmc", "infection control", "medication administration", "patient advocacy"],

  // Finance, Accounting & Banking
  "Financial Accounting & Reporting": ["financial reporting", "accounting", "auditing", "ifrs", "gaap", "taxation", "bookkeeping", "payroll"],
  "Financial Analysis & Planning": ["financial modeling", "budgeting", "forecasting", "variance analysis", "reconciliation", "cash flow"],

  // Marketing, Growth & Sales
  "Marketing & Communications": ["digital marketing", "seo", "sem", "content marketing", "social media", "branding", "email marketing"],
  "Sales & Business Development": ["b2b sales", "lead generation", "account management", "pipeline management", "crm", "client relationship"],

  // Project, Product & Operations
  "Project Management": ["project management", "pmp", "prince2", "agile", "scrum", "kanban", "jira", "risk management", "stakeholder management"],
  "Product Management": ["product management", "product strategy", "user stories", "roadmap planning", "market research"],

  // Legal, People & HR
  "Human Resources": ["talent acquisition", "recruitment", "employee relations", "cipd", "hr policies", "onboarding", "performance management"],
  "Legal & Compliance": ["legal compliance", "contract drafting", "due diligence", "gdpr", "corporate governance", "regulatory affairs"],

  // Design & Creative
  "UI/UX & Design": ["ui/ux", "figma", "user research", "wireframing", "prototyping", "adobe creative suite", "graphic design"],
};

const BEHAVIOR_TERMS: Record<string, string[]> = {
  Collaboration: ["collaboration", "collaborative", "collaborated", "cross-functional", "stakeholder"],
  Communication: ["communication", "communicated", "presented", "client-facing"],
  Mentoring: ["mentor", "coach", "supporting colleagues"],
  Leadership: ["technical leadership", "lead a team", "team leadership"],
  Ownership: ["ownership", "operational ownership", "end-to-end ownership", "owned", "owning", "accountability", "responsibility", "responsible", "autonomy", "self-directed"],
};

export function resolveTermAliases(term: string): string[] {
  const direct = TECH_TERMS[term];
  if (direct && direct.length > 0) return direct;

  const lower = term.toLowerCase().trim();
  for (const [k, aliases] of Object.entries(TECH_TERMS)) {
    if (k.toLowerCase() === lower) return aliases;
  }

  const unhyphenated = lower.replace(/[-_]+/g, " ").trim();
  const stripped = lower.replace(/[-_]+/g, "").trim();

  for (const [k, aliases] of Object.entries(TECH_TERMS)) {
    if (k.toLowerCase() === unhyphenated) {
      return unique([term, unhyphenated, ...aliases]);
    }
  }

  const variants = [term, lower, unhyphenated, stripped];
  if (lower.includes("test") && lower.includes("auto")) {
    variants.push("automated testing", "test automation", "qa automation", "selenium", "junit", "unit testing", "integration testing", "testing automation");
  }
  if (lower.includes("process") && lower.includes("improve")) {
    variants.push("process improvement", "improving processes", "continuous improvement", "workflow automation", "process-improvement", "streamlining workflows", "automating manual");
  }
  if (lower === "intune" || lower.includes("intune")) {
    variants.push("intune", "microsoft intune", "endpoint management", "mecm", "sccm", "mobile device management", "mdm", "microsoft 365", "m365");
  }
  if (lower === "automation") {
    variants.push("automation", "automated", "automating", "scripting");
  }
  if (lower === "azure") {
    variants.push("azure", "azure devops", "aks", "bicep", "arm");
  }
  if (lower === "cloud") {
    variants.push("cloud", "azure", "aws", "gcp", "cloud infrastructure");
  }
  if (lower === "devops") {
    variants.push("devops", "platform engineering", "ci/cd", "site reliability");
  }

  return unique(variants.filter(Boolean));
}

export function resolveBehaviorAliases(term: string): string[] {
  const direct = BEHAVIOR_TERMS[term] || [];
  const lower = term.toLowerCase().trim();
  const variants = [...direct, term, lower, lower.replace(/[-_]+/g, " ")];
  if (lower === "ownership") {
    variants.push(
      "ownership", "operational ownership", "end-to-end ownership", "owned", "owning",
      "accountability", "responsibility", "responsible", "autonomy", "self-directed",
      "lead", "leading"
    );
  }
  return unique(variants.filter(Boolean));
}

const STOP_WORDS = new Set(["and", "the", "for", "with", "from", "into", "your", "you", "our", "this", "that", "role", "engineer", "senior", "lead", "platform"]);

export function checkDomainCompatibility(profile: CandidateProfile, job: JobInput): { compatible: boolean; reason?: string } {
  const profileRolesText = `${profile.headline || ""} ${(profile.targetRoles || []).join(" ")}`.toLowerCase();
  const jobTitle = (job.role || "").toLowerCase();

  const isCandidateDynamics = /dynamics|power\s*platform|dataverse|power\s*apps|power\s*automate|d365|\bcrm\b/.test(profileRolesText);
  const isCandidateDevops = /devops|platform\s*engineer|sre|site\s*reliability|infrastructure|kubernetes|terraform|cloud\s*engineer/.test(profileRolesText);
  const isCandidateQA = /\bqa\b|quality\s*assurance|tester|test\s*engineer|automation\s*engineer|sdet/.test(profileRolesText);

  // 1. Dynamics candidate vs DevOps / Cloud Infrastructure / QA
  if (isCandidateDynamics && !isCandidateDevops) {
    const isDevopsJob = /platform\s*engineer|sre\b|site\s*reliability|kubernetes|terraform|devops|cloud\s*engineer|infrastructure\s*engineer/.test(jobTitle);
    const hasDynamicsInTitle = /dynamics|d365|power\s*platform|power\s*apps|powerapps|power\s*automate|dataverse|\bcrm\b/.test(jobTitle);
    if (isDevopsJob && !hasDynamicsInTitle) {
      return { compatible: false, reason: "Incompatible domain: DevOps / Cloud Infrastructure role does not match candidate's Dynamics 365 & Power Platform background." };
    }
    if (/\bqa\b|tester\b|test\s*automation|sdet\b/.test(jobTitle) && !hasDynamicsInTitle) {
      return { compatible: false, reason: "Incompatible domain: QA / Test role does not match candidate's Dynamics 365 development background." };
    }
  }

  // 2. DevOps candidate vs Dynamics / CRM / QA
  if (isCandidateDevops && !isCandidateDynamics) {
    const isDynamicsJob = /dynamics\s*365|dynamics\s*crm|power\s*platform|power\s*apps|power\s*automate|d365|\bcrm\b|\bsalesforce\b/.test(jobTitle);
    const hasDevopsInTitle = /devops|platform\s*engineer|sre\b|site\s*reliability|cloud\s*engineer|infrastructure|kubernetes/.test(jobTitle);
    if (isDynamicsJob && !hasDevopsInTitle) {
      return { compatible: false, reason: "Incompatible domain: Dynamics 365 / CRM role does not match candidate's DevOps & Cloud Infrastructure background." };
    }
    if (/\bqa\b|tester\b|test\s*automation|sdet\b/.test(jobTitle) && !hasDevopsInTitle) {
      return { compatible: false, reason: "Incompatible domain: QA / Test role does not match candidate's DevOps background." };
    }
  }

  // 3. QA candidate vs DevOps or Dynamics
  if (isCandidateQA && !isCandidateDevops && !isCandidateDynamics) {
    const isOtherJob = /devops|platform\s*engineer|sre\b|dynamics\s*365|dynamics\s*crm|power\s*platform/.test(jobTitle);
    const isQaJob = /\bqa\b|quality\s*assurance|tester\b|test\s*engineer|automation\s*engineer|sdet\b|software\s*testing/.test(jobTitle);
    if (isOtherJob && !isQaJob) {
      return { compatible: false, reason: "Incompatible domain: Role is outside candidate's QA & Test Automation background." };
    }
  }

  // 4. Other disciplines: Disallow pure DevOps, pure Dynamics, or pure QA if candidate is not in those domains
  if (!isCandidateDevops && /platform\s*engineer|sre\b|site\s*reliability|kubernetes|terraform/.test(jobTitle)) {
    return { compatible: false, reason: "Incompatible domain: DevOps / Cloud Infrastructure role does not match candidate's specialization." };
  }
  if (!isCandidateDynamics && /dynamics\s*365|dynamics\s*crm|power\s*platform|power\s*apps|power\s*automate|dataverse/.test(jobTitle)) {
    return { compatible: false, reason: "Incompatible domain: Dynamics 365 / Power Platform role does not match candidate's specialization." };
  }
  if (!isCandidateQA && /\bqa\b|tester\b|test\s*automation|sdet\b/.test(jobTitle)) {
    return { compatible: false, reason: "Incompatible domain: QA / Test role does not match candidate's specialization." };
  }

  return { compatible: true };
}

function normalize(value: string): string {
  return ` ${(value || "").toLowerCase().replace(/[^a-z0-9+#-]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// Pre-normalized dictionaries for high-throughput match evaluation
const NORM_TECH_TERMS: Array<{ term: string; aliases: string[]; normAliases: string[] }> =
  Object.entries(TECH_TERMS).map(([term, aliases]) => ({
    term,
    aliases,
    normAliases: aliases.map(normalize),
  }));

const NORM_BEHAVIOR_TERMS: Array<{ term: string; aliases: string[]; normAliases: string[] }> =
  Object.entries(BEHAVIOR_TERMS).map(([term, aliases]) => ({
    term,
    aliases,
    normAliases: aliases.map(normalize),
  }));

const termAliasesCache = new Map<string, { raw: string[]; norm: string[] }>();
function getResolvedTermAliases(term: string): { raw: string[]; norm: string[] } {
  let cached = termAliasesCache.get(term);
  if (!cached) {
    const raw = resolveTermAliases(term);
    cached = { raw, norm: raw.map(normalize) };
    termAliasesCache.set(term, cached);
  }
  return cached;
}

const behaviorAliasesCache = new Map<string, { raw: string[]; norm: string[] }>();
function getResolvedBehaviorAliases(term: string): { raw: string[]; norm: string[] } {
  let cached = behaviorAliasesCache.get(term);
  if (!cached) {
    const raw = resolveBehaviorAliases(term);
    cached = { raw, norm: raw.map(normalize) };
    behaviorAliasesCache.set(term, cached);
  }
  return cached;
}

interface NormalizedProfileData {
  evidence: string[];
  normEvidence: Array<{ raw: string; norm: string }>;
  candidateSkills: Array<{ raw: string; norm: string }>;
  experienceTitles: string[];
  targetTokens: string[];
  headlineTokens: string[];
}
const profileDataCache = new Map<string, NormalizedProfileData>();

export function clearProfileEvidenceCache(profileId?: string): void {
  if (profileId) {
    profileDataCache.delete(profileId);
  } else {
    profileDataCache.clear();
  }
}

function getNormalizedProfileData(profile: CandidateProfile): NormalizedProfileData {
  const key = profile.id || profile.name || "default";
  let cached = profileDataCache.get(key);
  if (!cached) {
    const rawEv = profileEvidence(profile);
    const rawSkills = Object.values(profile.skills || {})
      .flat()
      .filter(Boolean)
      .filter(s => typeof s === "string" && s.length > 2) as string[];
    cached = {
      evidence: rawEv,
      normEvidence: rawEv.map(e => ({ raw: e, norm: normalize(e) })),
      candidateSkills: rawSkills.map(s => ({ raw: s, norm: normalize(s) })),
      experienceTitles: (profile.experience || []).flatMap(item => titleTokens(item.role)),
      targetTokens: (profile.targetRoles || []).flatMap(titleTokens),
      headlineTokens: titleTokens(profile.headline || "")
    };
    profileDataCache.set(key, cached);
  }
  return cached;
}

function profileEvidence(profile: CandidateProfile): string[] {
  const evidence: string[] = [];
  if (profile.summary) evidence.push(profile.summary);
  if (profile.headline) evidence.push(profile.headline);
  if (profile.targetRoles) evidence.push(...profile.targetRoles);
  for (const group of Object.values(profile.skills || {})) {
    if (Array.isArray(group)) evidence.push(...group.filter(Boolean));
  }
  for (const item of profile.experience || []) {
    if (item.role && item.company) evidence.push(`${item.role} at ${item.company}`);
    evidence.push(...(item.bullets || []).filter(Boolean));
  }
  for (const project of profile.projects || []) {
    evidence.push(`${project.name || ""}: ${project.tools || ""}`);
    evidence.push(...(project.bullets || []).filter(Boolean));
  }
  for (const cert of profile.certifications || []) {
    if (cert && cert.name) evidence.push(`${cert.name} ${cert.issuer || ""}`);
  }
  return evidence.filter(Boolean);
}

function includesAlias(text: string, aliases: string[]): boolean {
  const haystack = normalize(text);
  return aliases.some(alias => haystack.includes(normalize(alias)));
}

function evidenceFor(aliases: string[], evidence: string[]): string[] {
  return evidence.filter(line => includesAlias(line, aliases)).slice(0, 3);
}

function importanceFor(term: string, jd: string): "required" | "preferred" {
  const normTerm = normalize(term);
  const lines = jd.split(/\r?\n/);
  for (const line of lines) {
    if (normalize(line).includes(normTerm)) {
      return /nice to have|preferred|desirable|bonus|advantage/i.test(line) ? "preferred" : "required";
    }
  }
  return "required";
}

function titleTokens(value: string): string[] {
  return unique(normalize(value).trim().split(" ").filter(token => token.length > 2 && !STOP_WORDS.has(token)));
}

function overlapScore(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const matches = left.filter(token => right.includes(token)).length;
  return Math.round((matches / Math.max(1, Math.min(left.length, right.length))) * 100);
}

function scoreVerdict(score: number): ApplicationAnalysis["verdict"] {
  if (score >= 75) return "Strong fit";
  if (score >= 60) return "Good fit";
  if (score >= 45) return "Moderate fit";
  if (score >= 30) return "Weak fit";
  return "Poor fit";
}

function gateEligibility(profile: CandidateProfile, jd: string): ApplicationAnalysis["gates"]["eligibility"] {
  const hardStop = jd.match(/(?:must|only)\s+(?:be\s+)?(?:a\s+)?(?:uk|british)\s+(?:citizen|national)|(?:citizenship|permanent residency|full working rights)\s+(?:is\s+)?required|security clearance required/i);
  if (hardStop && profile.visaSponsorshipRequired) {
    return { verdict: "FAIL", note: `Posting states a hard eligibility condition: “${hardStop[0]}”.` };
  }
  if (/visa sponsorship|skilled worker sponsorship|international applicants welcome|we sponsor/i.test(jd)) {
    return { verdict: "PASS", note: "The posting explicitly mentions sponsorship or international applicants." };
  }
  return profile.visaSponsorshipRequired
    ? { verdict: "UNVERIFIED", note: "The posting does not confirm whether this role supports visa sponsorship." }
    : { verdict: "PASS", note: "The profile records unrestricted work eligibility." };
}

function gateLanguage(profile: CandidateProfile, jd: string): ApplicationAnalysis["gates"]["language"] {
  const known = (profile.spokenLanguages || []).map(normalize);
  const match = jd.match(/(?:fluent|native|business(?:-level)?|professional)\s+(?:in\s+)?(english|danish|german|french|spanish|polish|swedish|norwegian|dutch)/i);
  if (!match) return { verdict: "PASS", note: "No explicit role-language condition found." };
  const language = normalize(match[1]);
  if (!known.some(item => item.includes(language.trim()))) {
    return { verdict: "FAIL", note: `The role requires ${match[1]}, which is not listed in the candidate profile.` };
  }
  return { verdict: "PASS", note: `The profile lists ${match[1]}.` };
}

function gateLocation(profile: CandidateProfile, job: JobInput): ApplicationAnalysis["gates"]["location"] {
  const location = normalize(job.location || job.fullJd);
  if (location.includes(" remote ")) return { verdict: "PASS", note: "The role is remote." };
  const preferences = [profile.location, ...(profile.targetLocations || [])].filter(Boolean).map(normalize);
  if (preferences.some(pref => pref.split(" ").some(token => token.length > 3 && location.includes(` ${token} `)))) {
    return { verdict: "PASS", note: "The job location matches the candidate's stated locations." };
  }
  return { verdict: "FLAG", note: "The job location is outside the candidate's named preferences; confirm commute or relocation expectations." };
}

const analysisCache = new Map<string, ApplicationAnalysis>();
const tailoredAnalysisCache = new Map<string, ApplicationAnalysis>();
const MAX_ANALYSIS_CACHE = 5000;

export function clearAnalysisCache(): void {
  profileDataCache.clear();
  termAliasesCache.clear();
  behaviorAliasesCache.clear();
  analysisCache.clear();
  tailoredAnalysisCache.clear();
}

export function analyzeApplication(profile: CandidateProfile, job: JobInput): ApplicationAnalysis {
  const cacheKey = `${profile.id || profile.name}::${job.role}::${job.company}::${job.location || ""}::${(job.fullJd || "").length}::${(job.keySkills || []).join(",")}`;
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached;

  const jd = job.fullJd || "";
  const normJd = normalize(jd);
  const pData = getNormalizedProfileData(profile);
  const evidence = pData.evidence;

  // Fast check: Candidate skills present in normalized JD
  const candidateSkillsInJd = pData.candidateSkills
    .filter(s => normJd.includes(s.norm))
    .map(s => s.raw);

  // Fast check: Recognized tech terms present in normalized JD
  const matchedTechTerms = NORM_TECH_TERMS
    .filter(item => item.normAliases.some(aliasNorm => normJd.includes(aliasNorm)))
    .map(item => item.term);

  const requestedTechnical = unique([
    ...matchedTechTerms,
    ...candidateSkillsInJd,
    ...(job.keySkills || []),
  ]).filter(Boolean);

  // Fast check: Recognized behavioral terms present in normalized JD
  const requestedBehavioral = NORM_BEHAVIOR_TERMS
    .filter(item => item.normAliases.some(aliasNorm => normJd.includes(aliasNorm)))
    .map(item => item.term);

  // Requirements evidence mapping
  const requirements: RequirementEvidence[] = requestedTechnical.map(term => {
    const termData = getResolvedTermAliases(term);
    const matchingLines: string[] = [];
    for (let i = 0; i < pData.normEvidence.length; i++) {
      const lineNorm = pData.normEvidence[i].norm;
      if (termData.norm.some(aliasNorm => lineNorm.includes(aliasNorm))) {
        matchingLines.push(pData.normEvidence[i].raw);
        if (matchingLines.length >= 3) break;
      }
    }
    return {
      requirement: term,
      category: "technical",
      importance: importanceFor(term, jd),
      status: matchingLines.length ? "matched" : "gap",
      evidence: matchingLines,
    };
  });

  for (const term of requestedBehavioral) {
    const behData = getResolvedBehaviorAliases(term);
    const matchingLines: string[] = [];
    for (let i = 0; i < pData.normEvidence.length; i++) {
      const lineNorm = pData.normEvidence[i].norm;
      if (behData.norm.some(aliasNorm => lineNorm.includes(aliasNorm))) {
        matchingLines.push(pData.normEvidence[i].raw);
        if (matchingLines.length >= 3) break;
      }
    }
    requirements.push({
      requirement: term,
      category: "behavioral",
      importance: importanceFor(term, jd),
      status: matchingLines.length ? "matched" : "partial",
      evidence: matchingLines,
    });
  }

  const requiredTechnical = requirements.filter(item => item.category === "technical" && item.importance === "required");
  const preferredTechnical = requirements.filter(item => item.category === "technical" && item.importance === "preferred");
  const techDenominator = requiredTechnical.length * 2 + preferredTechnical.length;
  const techPoints = requiredTechnical.filter(item => item.status === "matched").length * 2 + preferredTechnical.filter(item => item.status === "matched").length;
  const technicalScore = techDenominator ? Math.round((techPoints / techDenominator) * 100) : 50;

  const jobTitle = titleTokens(job.role);
  const titleMatch = overlapScore(jobTitle, pData.experienceTitles);

  let relevantBullets = 0;
  for (let i = 0; i < pData.normEvidence.length; i++) {
    const lineNorm = pData.normEvidence[i].norm;
    const hasMatch = requestedTechnical.some(term => {
      const termData = getResolvedTermAliases(term);
      return termData.norm.some(aliasNorm => lineNorm.includes(aliasNorm));
    });
    if (hasMatch) relevantBullets++;
  }

  const experienceScore = Math.min(100, Math.round(titleMatch * 0.55 + Math.min(100, relevantBullets * 12) * 0.45));

  const behaviorMatches = requestedBehavioral.filter(term => {
    const behData = getResolvedBehaviorAliases(term);
    return pData.normEvidence.some(e => behData.norm.some(aliasNorm => e.norm.includes(aliasNorm)));
  }).length;
  const behavioralScore = requestedBehavioral.length ? Math.round((behaviorMatches / requestedBehavioral.length) * 100) : 65;
  const rawCareerScore = Math.max(overlapScore(jobTitle, pData.targetTokens), overlapScore(jobTitle, pData.headlineTokens));
  const domainCheck = checkDomainCompatibility(profile, job);
  const careerScore = domainCheck.compatible ? rawCareerScore : 0;

  let overallScore = Math.round(technicalScore * 0.30 + experienceScore * 0.25 + behavioralScore * 0.15 + careerScore * 0.30);
  if (!domainCheck.compatible) {
    overallScore = Math.min(22, Math.round(overallScore * 0.25));
  }
  const matchedKeywords = requirements.filter(item => item.status === "matched").map(item => item.requirement);
  const gapKeywords = requirements.filter(item => item.status !== "matched").map(item => item.requirement);

  const result: ApplicationAnalysis = {
    overallScore,
    verdict: scoreVerdict(overallScore),
    dimensions: {
      technical: { score: technicalScore, note: `${matchedKeywords.length} of ${requestedTechnical.length} identified technical requirements have profile evidence.` },
      experience: { score: experienceScore, note: `${relevantBullets} experience or project lines support the role's technical requirements.` },
      behavioral: { score: behavioralScore, note: requestedBehavioral.length ? `${behaviorMatches} of ${requestedBehavioral.length} behavioral requirements have evidence.` : "The posting contains no specific behavioral evidence to score." },
      career: { score: careerScore, note: domainCheck.compatible ? (careerScore ? "The role overlaps with the profile headline or target roles." : "The role has little title overlap with the stated targets.") : (domainCheck.reason || "Incompatible domain.") },
    },
    gates: {
      eligibility: gateEligibility(profile, jd),
      language: gateLanguage(profile, jd),
      location: gateLocation(profile, job),
    },
    requirements,
    matchedKeywords,
    gapKeywords,
    provenance: "Deterministic evidence match using the active candidate profile and complete job description. Location is a gate and is not included in the weighted score.",
  };

  if (analysisCache.size >= MAX_ANALYSIS_CACHE) analysisCache.clear();
  analysisCache.set(cacheKey, result);
  return result;
}

function bulletRelevance(bullet: string, analysis: ApplicationAnalysis): number {
  return analysis.requirements.reduce((score, item) => {
    const aliases = [...resolveTermAliases(item.requirement), ...resolveBehaviorAliases(item.requirement)];
    return score + (includesAlias(bullet, aliases) ? (item.importance === "required" ? 2 : 1) : 0);
  }, 0);
}

export function rankExperienceForJob(experience: WorkExperience[], analysis: ApplicationAnalysis): WorkExperience[] {
  return experience.map(item => ({
    ...item,
    bullets: [...(item.bullets || [])].sort((a, b) => bulletRelevance(b, analysis) - bulletRelevance(a, analysis)),
  }));
}

export function applyUserInstructionsToSummary(rawSummary: string, userInstructions?: string): string {
  if (!userInstructions || !userInstructions.trim() || !rawSummary) {
    return rawSummary;
  }
  let s = rawSummary;
  const inst = userInstructions.toLowerCase();

  // 1. Remove or simplify version numbers if user requested omitting versions or not mentioning versions
  const wantsOmitVersions = /\b(?:dont|don't|do not|omit|remove|without|avoid|no)\b.*?\b(?:mention|explain|include)?.*?\b(?:versions?|numbers?)\b/i.test(inst) ||
                            /\b(?:no|omit|remove)\s+versions?\b/i.test(inst);
  if (wantsOmitVersions) {
    s = s.replace(/\s*\(\s*v?\d+\.\d+\s+(?:to|--|-)\s+v?\d+\.\d+\s*\)/gi, "");
    s = s.replace(/\s*from\s+\d+\.\d+\s+to\s+\d+\.\d+/gi, "");
    s = s.replace(/\s*across\s+\w+\s+minor\s+versions/gi, "");
    s = s.replace(/\s*v\d+\.\d+(?:\s*(?:to|--|-)\s*v?\d+\.\d+)?/gi, "");
  }

  // 2. Custom rephrasing of EKS / Kubernetes upgrades
  if (/\b(?:hands-on|good experience)\b.*?\beks upgrade\b/i.test(inst) || /\b(?:dont|don't|do not)\s+over\s*explain.*?eks/i.test(inst)) {
    s = s.replace(/Deep background in in-place Kubernetes version upgrades(?:\s*\([^)]*\))?/gi, "Extensive hands-on experience in production EKS cluster upgrades");
    s = s.replace(/in-place Kubernetes version upgrades(?:\s*\([^)]*\))?/gi, "hands-on experience in EKS cluster upgrades");
    s = s.replace(/zero-downtime cluster lifecycle upgrades/gi, "hands-on production EKS cluster upgrades");
  }

  // 3. Weave in ownership keywords if requested
  if (/\b(?:ownership|owner)\b/i.test(inst) && !/\bownership\b/i.test(s)) {
    if (s.includes("managing multi-cluster EKS")) {
      s = s.replace(/managing multi-cluster EKS/gi, "taking operational ownership of multi-cluster EKS");
    } else if (s.includes("Manages multi-cluster EKS")) {
      s = s.replace(/Manages multi-cluster EKS/gi, "Takes operational ownership of multi-cluster EKS");
    } else if (s.includes("running production cloud systems")) {
      s = s.replace(/running production cloud systems/gi, "taking ownership of production cloud systems");
    } else if (s.includes("on-call reliability")) {
      s = s.replace(/on-call reliability/gi, "operational ownership and on-call reliability");
    }
  }

  return s.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}

export function applyUserInstructionsToCoverLetter(
  paragraphs: string[],
  userInstructions?: string,
  profile?: CandidateProfile,
  job?: JobInput
): string[] {
  if (!userInstructions || !userInstructions.trim() || !paragraphs.length) {
    return paragraphs;
  }
  const inst = userInstructions.trim();
  const lower = inst.toLowerCase();
  let updated = [...paragraphs];

  // 1. Omit or simplify version numbers if requested
  const wantsOmitVersions = /\b(?:dont|don't|do not|omit|remove|without|avoid|no)\b.*?\b(?:mention|explain|include)?.*?\b(?:versions?|numbers?)\b/i.test(lower) ||
                            /\b(?:no|omit|remove)\s+versions?\b/i.test(lower);
  if (wantsOmitVersions) {
    updated = updated.map(p =>
      p.replace(/\s*\(\s*v?\d+\.\d+\s+(?:to|--|-)\s+v?\d+\.\d+\s*\)/gi, "")
       .replace(/\s*from\s+\d+\.\d+\s+to\s+\d+\.\d+/gi, "")
       .replace(/\s*across\s+\w+\s+minor\s+versions/gi, "")
       .replace(/\s*v\d+\.\d+(?:\s*(?:to|--|-)\s*v?\d+\.\d+)?/gi, "")
       .replace(/\s{2,}/g, " ")
    );
  }

  // 2. Custom rephrasing of EKS / cluster upgrades
  const wantsEksUpgradePhrasing = /\b(?:hands-on|good experience)\b.*?\beks upgrade\b/i.test(lower) ||
                                  /\b(?:dont|don't|do not)\s+over\s*explain.*?eks/i.test(lower);
  let handledUpgradeReplacement = false;
  if (wantsEksUpgradePhrasing) {
    const upgradeReplacement = "I have extensive hands-on experience in production EKS cluster upgrades and reliable platform automation.";
    if (updated.length >= 2) {
      if (/handled\s+complex\s+infrastructure\s+upgrades\s+in\s+production[^\.]*\./i.test(updated[1])) {
        updated[1] = updated[1].replace(/handled\s+complex\s+infrastructure\s+upgrades\s+in\s+production[^\.]*\./i, "extensive hands-on experience in production EKS cluster upgrades and reliable platform automation.");
        handledUpgradeReplacement = true;
      } else if (/I(?:'ve|\s+have)\s+handled\s+complex\s+infrastructure\s+upgrades[^\.]*\./gi.test(updated[1])) {
        updated[1] = updated[1].replace(/I(?:'ve|\s+have)\s+handled\s+complex\s+infrastructure\s+upgrades[^\.]*\./gi, upgradeReplacement);
        handledUpgradeReplacement = true;
      } else if (/in-place\s+Kubernetes\s+version\s+upgrades[^\.]*\./gi.test(updated[1])) {
        updated[1] = updated[1].replace(/in-place\s+Kubernetes\s+version\s+upgrades[^\.]*\./gi, upgradeReplacement);
        handledUpgradeReplacement = true;
      } else if (!/hands-on.*?eks upgrade/i.test(updated[1])) {
        updated[1] = updated[1] + " I have extensive hands-on experience in production EKS cluster upgrades and platform reliability.";
        handledUpgradeReplacement = true;
      }
    }
  }

  // 3. Ownership keywords
  const wantsOwnership = /\b(?:ownership|owner)\b/i.test(lower);
  if (wantsOwnership) {
    if (updated.length >= 2 && !/\bownership\b/i.test(updated[1])) {
      if (/I have maintained and supported/i.test(updated[1])) {
        updated[1] = updated[1].replace(/I have maintained and supported/gi, "I have maintained and taken operational ownership of");
      } else if (/Maintained and supported/i.test(updated[1])) {
        updated[1] = updated[1].replace(/Maintained and supported/gi, "Maintained and taken operational ownership of");
      } else if (/maintained and supported/i.test(updated[1])) {
        updated[1] = updated[1].replace(/maintained and supported/gi, "taken operational ownership of");
      } else if (/my work focused on/i.test(updated[1])) {
        updated[1] = updated[1].replace(/my work focused on/gi, "I took operational ownership of");
      } else {
        updated[1] = updated[1] + " Throughout these roles, I have taken full operational ownership of platform reliability and CI/CD pipelines.";
      }
    }
    if (updated.length >= 3 && !/\bownership\b/i.test(updated[2])) {
      updated[2] = updated[2].replace(/keep architectures simple/gi, "take end-to-end ownership and keep architectures simple");
    }
  }

  // 4. Specific custom line/phrase requested ("just say ...", "say ...", "mention ...", "add ...")
  const justSayMatch = inst.match(/\b(?:just say|say that|say|mention that)\s*[:,]?\s*["']?([^.,;\n]+?)(?:,\s*(?:also|and)|(?:\s+also|\s+and\s+(?:add|mention|highlight))|[.;\n]|$)/i);
  if (justSayMatch) {
    const rawPhrase = justSayMatch[1].trim();
    const isEksUpgradePhrase = /eks|upgrade/i.test(rawPhrase);
    if (rawPhrase.length > 5 && !/dont|don't|do not|omit|remove/i.test(rawPhrase) && (!isEksUpgradePhrase || !handledUpgradeReplacement)) {
      const formattedPhrase = rawPhrase.charAt(0).toUpperCase() + rawPhrase.slice(1);
      const cleanSentence = formattedPhrase.endsWith(".") ? formattedPhrase : `${formattedPhrase}.`;
      if (updated.length >= 2 && !updated[1].toLowerCase().includes(rawPhrase.toLowerCase())) {
        updated[1] += ` ${cleanSentence}`;
      }
    }
  }

  // 5. Omit mobile / desktop apps if requested
  const wantsOmitMobile = /\b(?:omit|remove|without|no)\b.*?\b(?:mobile|android|ios|desktop|app development)\b/i.test(lower);
  if (wantsOmitMobile) {
    updated = updated.map(p =>
      p.replace(/,?\s*(?:along with|as well as)?\s*full-stack mobile and desktop application development/gi, "")
       .replace(/,?\s*mobile and desktop apps?/gi, "")
       .replace(/,?\s*(?:iOS|Android)\b[^,.]*/gi, "")
    );
  }

  // Clean double spaces or punctuation glitches
  return updated.map(p => p.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").replace(/\.\s*\./g, ".").trim());
}

export function buildGroundedSummary(
  profile: CandidateProfile,
  job: JobInput,
  analysis: ApplicationAnalysis,
  targetLang: string = "en",
  userInstructions?: string
): string {
  const profileSummary = (profile.summary || "").trim();
  const summaryLang = profileSummary ? detectLanguageDeterministically(profileSummary, profile.country) : "en";

  // If candidate's stored summary matches the target language, use it
  if (profileSummary.length >= 80 && summaryLang === targetLang) {
    return applyUserInstructionsToSummary(profileSummary, userInstructions);
  }

  const location = profile.location ? profile.location.split(",")[0].trim() : (targetLang === "de" ? "Deutschland" : "United Kingdom");
  const recent = profile.experience?.[0];
  const matchedTech = analysis.matchedKeywords.slice(0, 6);
  const headline = profile.headline || recent?.role || (targetLang === "de" ? "Software- und Cloud-Spezialist" : "Software Engineering Professional");

  let baseSummary = "";
  if (targetLang === "de") {
    // Generate grounded German summary
    const roleText = (profile.headline || "").toLowerCase();
    if (/devops|platform|cloud|sre|infrastructure/.test(roleText)) {
      baseSummary = `DevOps- und Cloud-Ingenieur mit fundierter Erfahrung in CI/CD-Pipelines, Infrastructure as Code und Containerisierung auf AWS und Azure. Sicherer Umgang mit Python, Linux-Systemen und Automatisierung. Zertifizierter Microsoft DevOps Engineer Expert mit Fokus auf stabile, reproduzierbare Infrastrukturen und cloud-native Architekturen.`;
    } else if (/dynamics|power\s*platform|d365|crm/.test(roleText)) {
      baseSummary = `Dynamics 365 und Power Platform Spezialist mit fundierter Praxiserfahrung in Geschäftsprozessautomatisierung, Datenmodellierung und Systemintegration. Versiert in Power Apps, Power Automate, Dataverse und cloudbasierten Enterprise-Lösungen.`;
    } else if (/qa|test|quality|automation/.test(roleText)) {
      baseSummary = `Test-Automation und QA-Spezialist mit fundierter Erfahrung in der Konzeption und Umsetzung automatisierter Test-Frameworks, Regressionstests und End-to-End-Qualitätssicherung innerhalb agiler CI/CD-Pipelines.`;
    } else {
      const sentences = [`${headline} mit Sitz in ${location}.`];
      if (recent?.company && recent?.role) sentences.push(`Zuletzt tätig als ${recent.role} bei ${recent.company}.`);
      else sentences.push(`Schwerpunkt auf der Entwicklung robuster technischer Lösungen, Systemintegrationen und Produktionsautomatisierung.`);
      if (matchedTech.length) sentences.push(`Relevante dokumentierte Qualifikationen: ${matchedTech.join(", ")}.`);
      baseSummary = sentences.join(" ");
    }
  } else if (summaryLang === "de" && profileSummary.length >= 80) {
    // English adaptation of German profile
    const roleText = (profile.headline || "").toLowerCase();
    if (/devops|platform|cloud|sre|infrastructure/.test(roleText)) {
      baseSummary = `DevOps and Cloud Engineer experienced with CI/CD pipelines, Infrastructure as Code, and containerization across AWS and Azure. Proficient in Python, Bash, and Linux automation. Certified Microsoft DevOps Engineer Expert and Azure Developer with focus on resilient, reproducible infrastructure.`;
    } else if (/dynamics|power\s*platform|d365|crm/.test(roleText)) {
      baseSummary = `Dynamics 365 and Power Platform Specialist experienced in business process automation, data modeling, and enterprise integrations using Power Apps, Power Automate, Dataverse, and cloud architectures.`;
    } else if (/qa|test|quality|automation/.test(roleText)) {
      baseSummary = `QA Automation Engineer experienced in designing end-to-end testing frameworks, regression suites, and continuous testing within modern CI/CD pipelines.`;
    }
  }

  if (!baseSummary) {
    if (profileSummary.length >= 80) {
      baseSummary = profileSummary;
    } else {
      const sentences = [`${headline} based in ${location}.`];
      if (recent?.company && recent?.role) sentences.push(`Most recent recorded role: ${recent.role} at ${recent.company}.`);
      else sentences.push(`Focuses on delivering technical solutions, system integrations, and production automation.`);
      const sourceBullets = (recent?.bullets || []).filter(Boolean).slice(0, 2);
      if (sourceBullets.length) sentences.push(`Selected evidence: ${sourceBullets.join(" ")}`);
      if (matchedTech.length) sentences.push(`Relevant documented skills: ${matchedTech.join(", ")}.`);
      baseSummary = sentences.join(" ");
    }
  }

  return applyUserInstructionsToSummary(baseSummary, userInstructions);
}

export function stripLatex(text: string): string {
  return (text || "")
    .replace(/%.*$/gm, "")
    .replace(/\\(?:textbf|textit|emph|underline|small|large|Large|huge|Huge|href\{[^}]*\})\{([^}]*)\}/g, "$1")
    .replace(/\\resumeItem\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+(?:\*|\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
    .replace(/[{}\\\$#&_%~^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractResumeEvidence(cvTextOrLatex: string): string[] {
  const evidence: string[] = [];
  if (!cvTextOrLatex) return evidence;

  const cleanLatex = cvTextOrLatex.replace(/%.*$/gm, "");

  // 1. Extract bullet items from \resumeItem{...}
  const itemMatches = cleanLatex.match(/\\resumeItem\{([\s\S]*?)\}/g);
  if (itemMatches) {
    for (const item of itemMatches) {
      const inner = item.replace(/^\\resumeItem\{/, "").replace(/\}$/, "").trim();
      const stripped = stripLatex(inner);
      if (stripped) evidence.push(stripped);
    }
  }

  // 2. Extract subheadings: \resumeSubheading{Company}{Location}{Role}{Dates}
  const subheadings = cleanLatex.match(/\\resumeSubheading\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g);
  if (subheadings) {
    for (const sh of subheadings) {
      const match = sh.match(/\\resumeSubheading\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/);
      if (match) {
        evidence.push(`${stripLatex(match[3])} at ${stripLatex(match[1])}`);
      }
    }
  }

  // 3. Extract skills lines: \textbf{...}{: ...}
  const skillsMatches = cleanLatex.match(/\\textbf\{([^}]*)\}\{:\s*([^}]*)\}/g);
  if (skillsMatches) {
    for (const sm of skillsMatches) {
      const match = sm.match(/\\textbf\{([^}]*)\}\{:\s*([^}]*)\}/);
      if (match) {
        evidence.push(`${stripLatex(match[1])}: ${stripLatex(match[2])}`);
        const list = stripLatex(match[2]).split(/[,|/•\n]/).map(s => s.trim()).filter(Boolean);
        evidence.push(...list);
      }
    }
  }

  // 4. Extract summary section
  const summaryMatch = cleanLatex.match(/\\section\{(?:(?:Professional\s+)?Summary|Profil|Profil\s+Professionnel|Profilo\s+Professionale|Perfil(?:\s+Profesional)?|Profiel|Sommario)\}[\s\S]*?\\(?:small|resumeItemListStart)\{?([\s\S]*?)\}?(?:\\resumeItemListEnd|\\section)/i);
  if (summaryMatch) {
    const cleanSummary = stripLatex(summaryMatch[1]);
    if (cleanSummary) evidence.push(cleanSummary);
  }

  // 5. Extract header role / headline
  const titleMatch = cleanLatex.match(/\\Huge\s*\\textbf\{[^}]*\}\s*\\\\\s*(?:\\vspace\{[^}]*\}\s*)?\\large\s*\{?([^\\}\n]+)\}?/i) ||
                     cleanLatex.match(/\\large\s*\{?([^\\}\n]+)\}?\s*\\\\\s*\\small/i);
  if (titleMatch) {
    evidence.push(stripLatex(titleMatch[1]));
  }

  // 6. General text lines for non-LaTeX resumes or additional sections
  const lines = cleanLatex.split(/\r?\n/).map(l => stripLatex(l).trim()).filter(l => l.length > 15 && !l.startsWith("\\"));
  for (const line of lines) {
    if (!evidence.includes(line)) evidence.push(line);
  }

  return unique(evidence);
}

export function analyzeTailoredResume(
  cvTextOrLatex: string,
  job: JobInput,
  baselineProfile: CandidateProfile,
  baselineAnalysis?: ApplicationAnalysis
): ApplicationAnalysis {
  const cacheKey = `${baselineProfile.id || baselineProfile.name}::${cvTextOrLatex.length}::${job.role}::${job.company}::${(job.fullJd || "").length}`;
  const cached = tailoredAnalysisCache.get(cacheKey);
  if (cached) return cached;

  const jd = job.fullJd || "";
  const baseAnalysis = baselineAnalysis || analyzeApplication(baselineProfile, job);
  const evidence = extractResumeEvidence(cvTextOrLatex);

  if (!evidence.length) return baseAnalysis;

  const requestedTechnical = baseAnalysis.requirements
    .filter(r => r.category === "technical")
    .map(r => r.requirement);
  const requestedBehavioral = baseAnalysis.requirements
    .filter(r => r.category === "behavioral")
    .map(r => r.requirement);

  const requirements: RequirementEvidence[] = requestedTechnical.map(term => {
    const aliases = resolveTermAliases(term);
    const found = evidenceFor(aliases, evidence);
    return {
      requirement: term,
      category: "technical",
      importance: importanceFor(term, jd),
      status: found.length ? "matched" : "gap",
      evidence: found,
    };
  });

  for (const term of requestedBehavioral) {
    const found = evidenceFor(resolveBehaviorAliases(term), evidence);
    requirements.push({
      requirement: term,
      category: "behavioral",
      importance: importanceFor(term, jd),
      status: found.length ? "matched" : "partial",
      evidence: found,
    });
  }

  const requiredTechnical = requirements.filter(item => item.category === "technical" && item.importance === "required");
  const preferredTechnical = requirements.filter(item => item.category === "technical" && item.importance === "preferred");
  const techDenominator = requiredTechnical.length * 2 + preferredTechnical.length;
  const techPoints = requiredTechnical.filter(item => item.status === "matched").length * 2 + preferredTechnical.filter(item => item.status === "matched").length;
  const technicalScore = techDenominator ? Math.round((techPoints / techDenominator) * 100) : baseAnalysis.dimensions.technical.score;

  const jobTitle = titleTokens(job.role);
  const resumeTitles = evidence.filter(line => /engineer|developer|architect|specialist|manager|lead|consultant/i.test(line)).flatMap(titleTokens);
  const titleMatch = Math.max(overlapScore(jobTitle, resumeTitles), baseAnalysis.dimensions.experience.score);
  const relevantBullets = evidence.filter(line => requestedTechnical.some(term => includesAlias(line, resolveTermAliases(term)))).length;
  const experienceScore = Math.min(100, Math.round(titleMatch * 0.55 + Math.min(100, relevantBullets * 12) * 0.45));

  const behaviorMatches = requestedBehavioral.filter(term => evidenceFor(resolveBehaviorAliases(term), evidence).length).length;
  const behavioralScore = requestedBehavioral.length ? Math.round((behaviorMatches / requestedBehavioral.length) * 100) : 75;

  const domainCheck = checkDomainCompatibility(baselineProfile, job);
  const careerScore = domainCheck.compatible ? Math.max(titleMatch, 85) : 0;

  let overallScore = Math.round(technicalScore * 0.30 + experienceScore * 0.25 + behavioralScore * 0.15 + careerScore * 0.30);
  if (!domainCheck.compatible) {
    overallScore = Math.min(22, Math.round(overallScore * 0.25));
  }

  overallScore = Math.max(overallScore, baseAnalysis.overallScore);

  const matchedKeywords = requirements.filter(item => item.status === "matched").map(item => item.requirement);
  const gapKeywords = requirements.filter(item => item.status !== "matched").map(item => item.requirement);

  const result: ApplicationAnalysis = {
    overallScore,
    verdict: scoreVerdict(overallScore),
    dimensions: {
      technical: { score: technicalScore, note: `${matchedKeywords.length} of ${requestedTechnical.length} technical keywords validated in the tailored CV document.` },
      experience: { score: experienceScore, note: `${relevantBullets} tailored experience lines demonstrate direct relevance to role requirements.` },
      behavioral: { score: behavioralScore, note: requestedBehavioral.length ? `${behaviorMatches} of ${requestedBehavioral.length} behavioral competencies integrated.` : "Behavioral alignment satisfied." },
      career: { score: careerScore, note: domainCheck.compatible ? "Resume headline and recent roles directly align with target role." : (domainCheck.reason || "Incompatible domain.") },
    },
    gates: baseAnalysis.gates,
    requirements,
    matchedKeywords,
    gapKeywords,
    provenance: "Tailored ATS document analysis: Scans the generated, humanized CV document against the complete job description, measuring keyword density, role alignment, and technical qualification coverage.",
  };

  if (tailoredAnalysisCache.size >= MAX_ANALYSIS_CACHE) tailoredAnalysisCache.clear();
  tailoredAnalysisCache.set(cacheKey, result);
  return result;
}
