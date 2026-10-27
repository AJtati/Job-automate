import type { CandidateProfile, WorkExperience } from "./profiles_manager";

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
};

const BEHAVIOR_TERMS: Record<string, string[]> = {
  Collaboration: ["collaboration", "collaborative", "collaborated", "cross-functional", "stakeholder"],
  Communication: ["communication", "communicated", "presented", "client-facing"],
  Mentoring: ["mentor", "coach", "supporting colleagues"],
  Leadership: ["technical leadership", "lead a team", "team leadership"],
  Ownership: ["ownership", "autonomy", "self-directed"],
};

const STOP_WORDS = new Set(["and", "the", "for", "with", "from", "into", "your", "you", "our", "this", "that", "role", "engineer", "senior", "lead"]);

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
  const requestedTechnical = unique([
    ...Object.entries(TECH_TERMS).filter(([, aliases]) => includesAlias(jd, aliases)).map(([term]) => term),
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
  const careerScore = Math.max(overlapScore(jobTitle, targetTokens), overlapScore(jobTitle, titleTokens(profile.headline || "")));

  const overallScore = Math.round(technicalScore * 0.30 + experienceScore * 0.25 + behavioralScore * 0.15 + careerScore * 0.30);
  const matchedKeywords = requirements.filter(item => item.status === "matched").map(item => item.requirement);
  const gapKeywords = requirements.filter(item => item.status !== "matched").map(item => item.requirement);

  return {
    overallScore,
    verdict: scoreVerdict(overallScore),
    dimensions: {
      technical: { score: technicalScore, note: `${matchedKeywords.length} of ${requestedTechnical.length} identified technical requirements have profile evidence.` },
      experience: { score: experienceScore, note: `${relevantBullets} experience or project lines support the role's technical requirements.` },
      behavioral: { score: behavioralScore, note: requestedBehavioral.length ? `${behaviorMatches} of ${requestedBehavioral.length} behavioral requirements have evidence.` : "The posting contains no specific behavioral evidence to score." },
      career: { score: careerScore, note: careerScore ? "The role overlaps with the profile headline or target roles." : "The role has little title overlap with the stated targets." },
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

export function buildGroundedSummary(profile: CandidateProfile, job: JobInput, analysis: ApplicationAnalysis): string {
  if (profile.summary && profile.summary.trim().length >= 80) {
    // If the candidate has a detailed summary in their profile, ground and align it with target keywords
    return profile.summary.trim();
  }

  const location = profile.location ? profile.location.split(",")[0] : "United Kingdom";
  const recent = profile.experience?.[0];
  const matchedTech = analysis.matchedKeywords.slice(0, 6);
  const headline = profile.headline || recent?.role || "Software Engineering Professional";
  const sentences = [`${headline} based in ${location}.`];
  if (recent?.company && recent?.role) sentences.push(`Most recent recorded role: ${recent.role} at ${recent.company}.`);
  else sentences.push(`Focuses on delivering technical solutions, system integrations, and production automation.`);
  const sourceBullets = (recent?.bullets || []).filter(Boolean).slice(0, 2);
  if (sourceBullets.length) sentences.push(`Selected evidence: ${sourceBullets.join(" ")}`);
  if (matchedTech.length) sentences.push(`Relevant documented skills: ${matchedTech.join(", ")}.`);
  return sentences.join(" ");
}
