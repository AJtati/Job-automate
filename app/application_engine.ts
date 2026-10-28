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
  "Automated Testing": ["automated testing", "unit testing", "integration testing", "e2e testing", "qa automation"],
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
  Ownership: ["ownership", "autonomy", "self-directed"],
};

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
  const line = jd.split(/\r?\n/).find(item => includesAlias(item, [term])) || "";
  return /nice to have|preferred|desirable|bonus|advantage/i.test(line) ? "preferred" : "required";
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

export function analyzeApplication(profile: CandidateProfile, job: JobInput): ApplicationAnalysis {
  const jd = job.fullJd || "";
  const evidence = profileEvidence(profile);
  const combinedEvidence = evidence.join("\n");
  const candidateSkillsInJd = Object.values(profile.skills || {})
    .flat()
    .filter(Boolean)
    .filter(skill => typeof skill === "string" && skill.length > 2 && includesAlias(jd, [skill]));
  const requestedTechnical = unique([
    ...Object.entries(TECH_TERMS).filter(([, aliases]) => includesAlias(jd, aliases)).map(([term]) => term),
    ...candidateSkillsInJd,
    ...(job.keySkills || []),
  ]).filter(Boolean);
  const requestedBehavioral = Object.entries(BEHAVIOR_TERMS).filter(([, aliases]) => includesAlias(jd, aliases)).map(([term]) => term);

  const requirements: RequirementEvidence[] = requestedTechnical.map(term => {
    const aliases = TECH_TERMS[term] || [term];
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
    const found = evidenceFor(BEHAVIOR_TERMS[term], evidence);
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
  const technicalScore = techDenominator ? Math.round((techPoints / techDenominator) * 100) : 50;

  const jobTitle = titleTokens(job.role);
  const experienceTitles = (profile.experience || []).flatMap(item => titleTokens(item.role));
  const titleMatch = overlapScore(jobTitle, experienceTitles);
  const relevantBullets = evidence.filter(line => requestedTechnical.some(term => includesAlias(line, TECH_TERMS[term] || [term]))).length;
  const experienceScore = Math.min(100, Math.round(titleMatch * 0.55 + Math.min(100, relevantBullets * 12) * 0.45));

  const behaviorMatches = requestedBehavioral.filter(term => evidenceFor(BEHAVIOR_TERMS[term], evidence).length).length;
  const behavioralScore = requestedBehavioral.length ? Math.round((behaviorMatches / requestedBehavioral.length) * 100) : 65;
  const targetTokens = (profile.targetRoles || []).flatMap(titleTokens);
  const rawCareerScore = Math.max(overlapScore(jobTitle, targetTokens), overlapScore(jobTitle, titleTokens(profile.headline || "")));
  const domainCheck = checkDomainCompatibility(profile, job);
  const careerScore = domainCheck.compatible ? rawCareerScore : 0;

  let overallScore = Math.round(technicalScore * 0.30 + experienceScore * 0.25 + behavioralScore * 0.15 + careerScore * 0.30);
  if (!domainCheck.compatible) {
    overallScore = Math.min(22, Math.round(overallScore * 0.25));
  }
  const matchedKeywords = requirements.filter(item => item.status === "matched").map(item => item.requirement);
  const gapKeywords = requirements.filter(item => item.status !== "matched").map(item => item.requirement);

  return {
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
}

function bulletRelevance(bullet: string, analysis: ApplicationAnalysis): number {
  return analysis.requirements.reduce((score, item) => {
    const aliases = TECH_TERMS[item.requirement] || BEHAVIOR_TERMS[item.requirement] || [item.requirement];
    return score + (includesAlias(bullet, aliases) ? (item.importance === "required" ? 2 : 1) : 0);
  }, 0);
}

export function rankExperienceForJob(experience: WorkExperience[], analysis: ApplicationAnalysis): WorkExperience[] {
  return experience.map(item => ({
    ...item,
    bullets: [...(item.bullets || [])].sort((a, b) => bulletRelevance(b, analysis) - bulletRelevance(a, analysis)),
  }));
}

export function buildGroundedSummary(
  profile: CandidateProfile,
  job: JobInput,
  analysis: ApplicationAnalysis,
  targetLang: string = "en"
): string {
  const profileSummary = (profile.summary || "").trim();
  const summaryLang = profileSummary ? detectLanguageDeterministically(profileSummary) : "en";

  // If candidate's stored summary matches the target language, use it
  if (profileSummary.length >= 80 && summaryLang === targetLang) {
    return profileSummary;
  }

  const location = profile.location ? profile.location.split(",")[0].trim() : (targetLang === "de" ? "Deutschland" : "United Kingdom");
  const recent = profile.experience?.[0];
  const matchedTech = analysis.matchedKeywords.slice(0, 6);
  const headline = profile.headline || recent?.role || (targetLang === "de" ? "Software- und Cloud-Spezialist" : "Software Engineering Professional");

  if (targetLang === "de") {
    // Generate grounded German summary
    const roleText = (profile.headline || "").toLowerCase();
    if (/devops|platform|cloud|sre|infrastructure/.test(roleText)) {
      return `DevOps- und Cloud-Ingenieur mit fundierter Erfahrung in CI/CD-Pipelines, Infrastructure as Code und Containerisierung auf AWS und Azure. Sicherer Umgang mit Python, Linux-Systemen und Automatisierung. Zertifizierter Microsoft DevOps Engineer Expert mit Fokus auf stabile, reproduzierbare Infrastrukturen und cloud-native Architekturen.`;
    }
    if (/dynamics|power\s*platform|d365|crm/.test(roleText)) {
      return `Dynamics 365 und Power Platform Spezialist mit fundierter Praxiserfahrung in Geschäftsprozessautomatisierung, Datenmodellierung und Systemintegration. Versiert in Power Apps, Power Automate, Dataverse und cloudbasierten Enterprise-Lösungen.`;
    }
    if (/qa|test|quality|automation/.test(roleText)) {
      return `Test-Automation und QA-Spezialist mit fundierter Erfahrung in der Konzeption und Umsetzung automatisierter Test-Frameworks, Regressionstests und End-to-End-Qualitätssicherung innerhalb agiler CI/CD-Pipelines.`;
    }

    const sentences = [`${headline} mit Sitz in ${location}.`];
    if (recent?.company && recent?.role) sentences.push(`Zuletzt tätig als ${recent.role} bei ${recent.company}.`);
    else sentences.push(`Schwerpunkt auf der Entwicklung robuster technischer Lösungen, Systemintegrationen und Produktionsautomatisierung.`);
    if (matchedTech.length) sentences.push(`Relevante dokumentierte Qualifikationen: ${matchedTech.join(", ")}.`);
    return sentences.join(" ");
  }

  // Target: English
  if (summaryLang === "de" && profileSummary.length >= 80) {
    // English adaptation of German profile
    const roleText = (profile.headline || "").toLowerCase();
    if (/devops|platform|cloud|sre|infrastructure/.test(roleText)) {
      return `DevOps and Cloud Engineer experienced with CI/CD pipelines, Infrastructure as Code, and containerization across AWS and Azure. Proficient in Python, Bash, and Linux automation. Certified Microsoft DevOps Engineer Expert and Azure Developer with focus on resilient, reproducible infrastructure.`;
    }
    if (/dynamics|power\s*platform|d365|crm/.test(roleText)) {
      return `Dynamics 365 and Power Platform Specialist experienced in business process automation, data modeling, and enterprise integrations using Power Apps, Power Automate, Dataverse, and cloud architectures.`;
    }
    if (/qa|test|quality|automation/.test(roleText)) {
      return `QA Automation Engineer experienced in designing end-to-end testing frameworks, regression suites, and continuous testing within modern CI/CD pipelines.`;
    }
  }

  if (profileSummary.length >= 80) {
    return profileSummary;
  }

  const sentences = [`${headline} based in ${location}.`];
  if (recent?.company && recent?.role) sentences.push(`Most recent recorded role: ${recent.role} at ${recent.company}.`);
  else sentences.push(`Focuses on delivering technical solutions, system integrations, and production automation.`);
  const sourceBullets = (recent?.bullets || []).filter(Boolean).slice(0, 2);
  if (sourceBullets.length) sentences.push(`Selected evidence: ${sourceBullets.join(" ")}`);
  if (matchedTech.length) sentences.push(`Relevant documented skills: ${matchedTech.join(", ")}.`);
  return sentences.join(" ");
}
