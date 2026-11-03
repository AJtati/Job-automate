/**
 * Shared Skill Taxonomy & Dynamic Classifier Engine
 *
 * Provides intelligent, multi-domain skill classification, unwrapping of corrupted
 * or concatenated multi-skill strings, ATS-compliant category segregation, and
 * local continuous learning.
 *
 * Supports ANY profession (QA Test Engineer, Software Engineer, Data Scientist/ML,
 * Cloud/DevOps/SRE, Dynamics 365, Cybersecurity, Healthcare/Nursing, Finance/Accounting,
 * Product Management, and custom enterprise domains).
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface ClassifiedSkill {
  category: string;
  formatted: string;
}

export interface DomainDefinition {
  name: string;
  aliases: string[];
  categories: Record<string, string>;
  skills: Record<string, string>;
}

export interface TaxonomyKnowledge {
  version: number;
  updatedAt: string;
  domains: Record<string, DomainDefinition>;
  learnedSkills: Record<string, { category: string; domain?: string }>;
  learnedAliases: Record<string, string>;
}

// Canonical category definitions for standard tech/DevOps roles (backward compatibility)
export const TECH_CATEGORY_LABELS: Record<string, string> = {
  cloud: "Cloud Platforms",
  containers: "Containers & GitOps",
  iac: "Infrastructure as Code",
  cicd: "CI/CD & Build Tools",
  monitoring: "Monitoring & SRE",
  observability: "Monitoring & Observability",
  security: "Security & Compliance",
  languages: "Languages & Frameworks",
  databases: "Databases & Storage",
  tools: "Tools & Automation",
};

const KNOWLEDGE_PATH = join(process.cwd(), "data", "taxonomy_knowledge.json");

/**
 * Local Taxonomy Knowledge Store
 * Persists learned skills, categories, and domain associations locally to disk.
 */
class TaxonomyStore {
  private knowledge: TaxonomyKnowledge;

  constructor() {
    this.knowledge = this.load();
  }

  private load(): TaxonomyKnowledge {
    if (existsSync(KNOWLEDGE_PATH)) {
      try {
        const raw = readFileSync(KNOWLEDGE_PATH, "utf-8");
        return JSON.parse(raw);
      } catch (err) {
        console.error("Failed to read taxonomy knowledge, using default:", err);
      }
    }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      domains: {},
      learnedSkills: {},
      learnedAliases: {}
    };
  }

  public save(): void {
    try {
      this.knowledge.updatedAt = new Date().toISOString();
      writeFileSync(KNOWLEDGE_PATH, JSON.stringify(this.knowledge, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save taxonomy knowledge:", err);
    }
  }

  public getDomain(name: string): DomainDefinition | undefined {
    return this.knowledge.domains[name];
  }

  public getAllDomains(): Record<string, DomainDefinition> {
    return this.knowledge.domains;
  }

  public getLearnedSkill(skillLower: string): { category: string; domain?: string } | undefined {
    return this.knowledge.learnedSkills[skillLower];
  }

  public recordLearnedSkill(skill: string, category: string, domain?: string): void {
    const lower = skill.trim().toLowerCase();
    if (!lower || !category) return;
    this.knowledge.learnedSkills[lower] = { category: category.trim(), domain };
    this.save();
  }

  public recordLearnedSkills(items: Array<{ skill: string; category: string; domain?: string }>): void {
    let changed = false;
    for (const item of items) {
      if (!item.skill || !item.category) continue;
      const lower = item.skill.trim().toLowerCase();
      this.knowledge.learnedSkills[lower] = { category: item.category.trim(), domain: item.domain };
      changed = true;
    }
    if (changed) this.save();
  }
}

export const taxonomyStore = new TaxonomyStore();

/**
 * Intelligently detects the candidate's professional domain from their headline,
 * resume summary/text, or existing skill keys.
 */
export function detectProfessionDomain(
  headline: string = "",
  text: string = "",
  skills?: Record<string, any>
): string {
  const combined = `${headline} ${text} ${Object.keys(skills || {}).join(" ")}`.toLowerCase();

  const domainRules: Array<[string, RegExp]> = [
    ["qa", /\b(?:qa|quality\s*assurance|tester|test\s*engineer|test\s*automation|sdet|automation\s*tester|software\s*tester|istqb|selenium|cypress|playwright|postman|jmeter|testrail|zephyr)\b/i],
    ["dynamics", /\b(?:dynamics|dynamics\s*365|d365|power\s*platform|dataverse|power\s*apps|power\s*automate|power\s*bi|power\s*pages|pac\s*cli|x\+\+|crm\s*developer|crm\s*consultant)\b/i],
    ["data_science", /\b(?:data\s*scientist|machine\s*learning|ml\s*engineer|ai\s*engineer|deep\s*learning|nlp|pandas|pytorch|tensorflow|scikit|computer\s*vision|big\s*data|data\s*engineer)\b/i],
    ["devops", /\b(?:devops|platform\s*engineer|sre|site\s*reliability|cloud\s*engineer|infrastructure\s*engineer|kubernetes|terraform|ansible|argocd|helm|ci\/cd)\b/i],
    ["cybersecurity", /\b(?:cybersecurity|information\s*security|infosec|soc\s*analyst|penetration\s*tester|appsec|grc|cissp|cism|siem|burp\s*suite)\b/i],
    ["healthcare", /\b(?:nurse|registered\s*nurse|doctor|physician|clinical|healthcare|icu\s*nurse|staff\s*nurse|patient\s*care|nmc|nhs|ehr|epic\s*ehr|cerner)\b/i],
    ["finance", /\b(?:accountant|financial\s*analyst|auditor|finance\s*manager|bookkeeper|cpa|acca|gaap|ifrs|sap\s*fico|taxation)\b/i],
    ["product", /\b(?:product\s*manager|project\s*manager|scrum\s*master|agile\s*coach|delivery\s*manager|product\s*owner)\b/i],
    ["software_engineering", /\b(?:software\s*engineer|software\s*developer|backend|frontend|fullstack|full-stack|full\s*stack|mobile\s*developer|ios\s*developer|android\s*developer|web\s*developer)\b/i]
  ];

  for (const [dom, reg] of domainRules) {
    if (reg.test(combined)) return dom;
  }

  // Check headline primarily
  const headLower = headline.toLowerCase();
  for (const [dom, reg] of domainRules) {
    if (reg.test(headLower)) return dom;
  }

  return "software_engineering"; // Default general tech
}

/**
 * Calculates total professional experience in years from work experience dates.
 */
export function calculateTotalYearsExperience(
  experiences: Array<{ startDate?: string; endDate?: string }>
): number {
  if (!experiences || !experiences.length) return 0;

  const currentYear = 2026;
  function parseYear(d?: string): number | null {
    if (!d) return null;
    if (/present|current|now/i.test(d)) return currentYear;
    const m = d.match(/\b(19\d{2}|20\d{2})\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  let minYear: number | null = null;
  let maxYear: number | null = null;

  for (const exp of experiences) {
    const s = parseYear(exp.startDate);
    const e = parseYear(exp.endDate);
    if (s !== null) {
      if (minYear === null || s < minYear) minYear = s;
    }
    if (e !== null) {
      if (maxYear === null || e > maxYear) maxYear = e;
    }
  }

  if (minYear !== null && maxYear !== null && maxYear >= minYear) {
    return Math.max(1, maxYear - minYear);
  }

  return Math.min(experiences.length * 2, 10);
}

/**
 * Standardizes technology naming & casing.
 */
export function formatTechnologyName(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  const exactMap: Record<string, string> = {
    "aws": "AWS",
    "gcp": "GCP",
    "azure": "Azure",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "aks": "Kubernetes (AKS)",
    "eks": "Kubernetes (EKS)",
    "gke": "Kubernetes (GKE)",
    "docker": "Docker",
    "helm": "Helm",
    "argocd": "ArgoCD",
    "argo cd": "ArgoCD",
    "argo rollouts": "Argo Rollouts",
    "istio": "ISTIO",
    "ecr": "ECR",
    "docker compose": "Docker Compose",
    "terraform": "Terraform",
    "terragrunt": "Terragrunt",
    "aws cdk": "AWS CDK",
    "cdk": "AWS CDK",
    "ansible": "Ansible",
    "ansible tower": "Ansible Tower",
    "cloudformation": "CloudFormation",
    "bicep": "Bicep",
    "pulumi": "Pulumi",
    "jenkins": "Jenkins",
    "github actions": "GitHub Actions",
    "gitlab ci": "GitLab CI",
    "gitlab": "GitLab",
    "azure devops": "Azure DevOps",
    "concourse ci": "Concourse CI",
    "gocd": "GoCD",
    "git": "Git",
    "vsts": "VSTS",
    "jfrog artifactory": "JFrog Artifactory",
    "artifactory": "JFrog Artifactory",
    "nexus": "Nexus",
    "sonatype": "Sonatype",
    "veracode": "Veracode",
    "sonarqube": "SonarQube",
    "aws waf": "AWS WAF",
    "cloudflare waf": "Cloudflare WAF",
    "external secrets operator": "External Secrets Operator",
    "prometheus": "Prometheus",
    "grafana": "Grafana",
    "alertmanager": "Alertmanager",
    "splunk": "Splunk",
    "zabbix": "Zabbix",
    "cloudwatch": "CloudWatch",
    "pagerduty": "PagerDuty (On-call)",
    "datadog": "Datadog",
    "opentelemetry": "OpenTelemetry",
    "python": "Python",
    "bash": "Bash/Shell",
    "bash/shell": "Bash/Shell",
    "shell": "Bash/Shell",
    "powershell": "PowerShell",
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "next.js": "Next.js",
    "nextjs": "Next.js",
    "react": "React",
    "sql": "SQL",
    "ffmpeg": "FFmpeg",
    "dynamics 365": "Dynamics 365",
    "d365": "Dynamics 365",
    "power platform": "Power Platform",
    "dataverse": "Dataverse",
    "power apps": "Power Apps",
    "power automate": "Power Automate",
    "power bi": "Power BI",
    "pac cli": "PAC CLI",
    "x++": "X++",
    "c#": "C#",
    ".net": ".NET",
    "dotnet": ".NET",
    "rest api": "REST APIs",
    "graphql": "GraphQL",
    // QA & Testing
    "selenium": "Selenium",
    "selenium webdriver": "Selenium WebDriver",
    "cypress": "Cypress",
    "playwright": "Playwright",
    "appium": "Appium",
    "cucumber": "Cucumber BDD",
    "postman": "Postman",
    "jmeter": "Apache JMeter",
    "soapui": "SoapUI",
    "k6": "k6",
    "testrail": "TestRail",
    "xray": "Xray",
    "zephyr": "Zephyr",
    "jira": "Jira",
    "browserstack": "BrowserStack",
    "saucelabs": "SauceLabs",
  };

  const lower = t.toLowerCase();
  if (exactMap[lower]) return exactMap[lower];

  if (/[A-Z]/.test(t) && !/^[A-Z\s]+$/.test(t)) {
    return t;
  }

  return t.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Classifies any technology skill into its canonical ATS category.
 * Integrates dynamically learned skills, candidate custom categories,
 * and profession domain context (QA, Software Engineering, DevOps, Dynamics, Healthcare, etc.).
 */
export function classifySkill(
  skill: string,
  domainContext: string = "devops",
  existingCustomCategories: string[] = []
): ClassifiedSkill {
  const formatted = formatTechnologyName(skill);
  const lower = formatted.toLowerCase();

  // 1. Check local learned skills store (AI-learned mappings)
  const learned = taxonomyStore.getLearnedSkill(lower);
  if (learned) {
    return { category: learned.category, formatted };
  }

  // 1.5 Check Domain Knowledge Base in taxonomyStore
  const domainDef = taxonomyStore.getDomain(domainContext);
  if (domainDef && domainDef.skills) {
    if (domainDef.skills[lower]) {
      return { category: domainDef.skills[lower], formatted };
    }
    const sortedEntries = Object.entries(domainDef.skills).sort((a, b) => b[0].length - a[0].length);
    for (const [sk, cat] of sortedEntries) {
      const skLower = sk.toLowerCase();
      if (lower === skLower) {
        return { category: cat, formatted };
      }
      if (skLower.length > 3 && lower.includes(skLower)) {
        return { category: cat, formatted };
      }
    }
  }

  // Explicit priority for compound tool+language specifications in DevOps/Tech
  if (domainContext === "devops" || !domainDef) {
    if (/\b(?:aws\s*cdk|cdk|terraform|terragrunt|ansible|cloudformation|bicep|pulumi)\b/i.test(lower)) {
      return { category: "iac", formatted };
    }
    if (/\b(?:kubernetes|k8s|docker|helm|argocd|istio)\b/i.test(lower)) {
      return { category: "containers", formatted };
    }
  }

  // 2. Check candidate-declared custom categories
  for (const customCat of existingCustomCategories) {
    const catLower = customCat.toLowerCase();
    if (catLower.includes("power platform") || catLower.includes("power apps")) {
      if (/\b(?:power\s*platform|power\s*apps|power\s*automate|power\s*bi|power\s*pages|dataverse|custom\s*tables|workflows|appsource)\b/i.test(lower)) {
        return { category: customCat, formatted };
      }
    } else if (catLower.includes("dynamics") || catLower.includes("crm")) {
      if (/\b(?:dynamics|d365|crm|sales|customer\s*service|field\s*service|x\+\+|al|business\s*central|f&o|dataverse|security\s*roles|data\s*modeling)\b/i.test(lower)) {
        return { category: customCat, formatted };
      }
    } else if (catLower.includes("alm") || catLower.includes("testing") || catLower.includes("qa")) {
      if (/\b(?:azure\s*devops|pac\s*cli|ci\/cd|pipeline|nunit|jasmine|tdd|rsat|selenium|cypress|playwright|jest|junit|testing|qa)\b/i.test(lower)) {
        return { category: customCat, formatted };
      }
    } else if (catLower.includes("development") || (catLower.includes("languages") && !TECH_CATEGORY_LABELS[catLower])) {
      if (
        /(?:^|\W)(?:c#|c\+\+|\.net|x\+\+)(?:$|\W)/i.test(lower) ||
        /\b(?:javascript|typescript|dotnet|\.net|python|x\+\+|powershell|sql|html|css|json|xml|rest|linq|fetchxml|liquid|scripts|plugins)\b/i.test(lower)
      ) {
        return { category: customCat, formatted };
      }
    } else if (catLower.includes("integration") || catLower.includes("azure services")) {
      if (/\b(?:logic\s*apps|service\s*bus|azure\s*functions|api\s*management|rest|soap|azure\s*ai|copilot|azure\s*cli|ai-enabled)\b/i.test(lower)) {
        return { category: customCat, formatted };
      }
    } else if (catLower.includes("documentation") || catLower.includes("methodolog")) {
      if (/\b(?:sdd|frd|fdd|uat|agile|scrum|sprint|stakeholder|jira|confluence)\b/i.test(lower)) {
        return { category: customCat, formatted };
      }
    }
  }

  // 3. Domain-specific classification: QA Engineer
  if (domainContext === "qa") {
    if (/\b(?:selenium|cypress|playwright|appium|cucumber|bdd|tdd|robot\s*framework|test\s*automation|webdriver)\b/i.test(lower)) {
      return { category: "automation", formatted };
    }
    if (/\b(?:postman|soapui|jmeter|k6|gatling|restassured|karate|charles|fiddler|api\s*testing|performance\s*testing|load\s*testing)\b/i.test(lower)) {
      return { category: "api_performance", formatted };
    }
    if (/\b(?:jira|xray|zephyr|testrail|bugzilla|qtest|test\s*plans?|defect|bug\s*tracking|test\s*management)\b/i.test(lower)) {
      return { category: "management", formatted };
    }
    if (/\b(?:manual|exploratory|regression|smoke|sanity|uat|functional|boundary\s*value|equivalence|e2e|system\s*integration)\b/i.test(lower)) {
      return { category: "manual", formatted };
    }
    if (/\b(?:browserstack|saucelabs|jenkins|github\s*actions|gitlab|docker|ci\/cd|pipeline)\b/i.test(lower)) {
      return { category: "devops_qa", formatted };
    }
    if (/(?:^|\W)(?:c#|c\+\+|\.net)(?:$|\W)/i.test(lower) || /\b(?:java|python|typescript|javascript|sql|bash)\b/i.test(lower)) {
      return { category: "languages", formatted };
    }
  }

  // 4. Domain-specific classification: Software Engineer
  if (domainContext === "software_engineering") {
    if (/(?:^|\W)(?:c#|c\+\+|\.net|c|rust|go|golang)(?:$|\W)/i.test(lower) || /\b(?:typescript|javascript|python|java|ruby|php|swift|kotlin|scala|elixir)\b/i.test(lower)) {
      return { category: "languages", formatted };
    }
    if (/\b(?:react|next\.?js|vue|angular|node\.?js|express|spring\s*boot|django|fastapi|flask|\.net\s*core|asp\.net|svelte)\b/i.test(lower)) {
      return { category: "frameworks", formatted };
    }
    if (/\b(?:postgresql|mysql|mongodb|redis|dynamodb|cassandra|elasticsearch|sql|sqlite|couchbase|mariadb|oracle)\b/i.test(lower)) {
      return { category: "databases", formatted };
    }
    if (/\b(?:microservices|rest\s*apis?|graphql|event-driven|kafka|rabbitmq|grpc|websockets|system\s*design|ddd)\b/i.test(lower)) {
      return { category: "architecture", formatted };
    }
    if (/\b(?:aws|azure|gcp|docker|kubernetes|terraform|serverless)\b/i.test(lower)) {
      return { category: "cloud_infra", formatted };
    }
  }

  // 5. Standard Cross-Domain & DevOps Technology Rules
  // Cloud Platforms & Service Packages
  if (
    /^(?:aws|amazon|azure|microsoft\s*azure|gcp|google\s*cloud|cloudflare|openstack)(?:\s*\(.*\))?$/i.test(lower) ||
    /^(?:ec2|s3|rds|vpc|lambda|route53|cloudfront|nlb|alb|iam|irsa|secrets\s*manager|ssm\s*parameter\s*store)$/i.test(lower)
  ) {
    return { category: "cloud", formatted };
  }

  // CI/CD & Build Tools
  if (
    /\b(?:azure\s*devops|jenkins|github\s*actions|gitlab|concourse|gocd|git|vsts|jfrog|artifactory|nexus|bitbucket|circleci|travis|teamcity|bamboo|octopus|codefresh|spinnaker|ci\/cd|build\s*tools?)\b/i.test(lower) &&
    !/\b(?:gitops|argocd|flux)\b/i.test(lower)
  ) {
    return { category: "cicd", formatted };
  }

  // Infrastructure as Code (IaC)
  if (
    /\b(?:terraform|terragrunt|cdk|aws\s*cdk|ansible|ansible\s*tower|awx|cloudformation|bicep|arm\s*templates?|pulumi|packer|puppet|chef|saltstack|crossplane|iac)\b/i.test(lower)
  ) {
    return { category: "iac", formatted };
  }

  // Containers & GitOps
  if (
    /\b(?:kubernetes|k8s|aks|eks|gke|docker|helm|argocd|argo\s*rollouts|argo\s*workflows|istio|linkerd|service\s*mesh|ecr|acr|gcr|harbor|docker\s*compose|containerd|podman|rancher|openshift|gitops|flux|fluxcd|container\s*security)\b/i.test(lower)
  ) {
    return { category: "containers", formatted };
  }

  // Monitoring, Observability & SRE
  if (
    /\b(?:prometheus|grafana|alertmanager|splunk|zabbix|cloudwatch|datadog|dynatrace|new\s*relic|appdynamics|pagerduty|opsgenie|victorops|elk|kibana|loki|opentelemetry|otel|jaeger|zipkin|thanos|cortex|mimir|nagios|sre|observability|monitoring)\b/i.test(lower)
  ) {
    return { category: "monitoring", formatted };
  }

  // Security & Compliance
  if (
    /\b(?:sonatype|veracode|sonarqube|sonarcloud|waf|aws\s*waf|cloudflare\s*waf|external\s*secrets|vault|hashicorp\s*vault|cyberark|trivy|snyk|grype|checkmarx|fortify|devsecops|opa|open\s*policy\s*agent|gatekeeper|kyverno|zero\s*trust|cis\s*benchmarks?|nist|iso\s*27001|soc\s*2|iam\/irsa|security)\b/i.test(lower)
  ) {
    return { category: "security", formatted };
  }

  // Languages & Frameworks
  if (
    /(?:^|\W)(?:c#|c\+\+|\.net)(?:$|\W)/i.test(lower) ||
    /\b(?:python|bash|shell|sh|zsh|powershell|typescript|javascript|node\.?js|nodejs|next\.?js|nextjs|react|vue|angular|golang|go|rust|c|dotnet|java|spring|spring\s*boot|ruby|php|sql|postgres|postgresql|mysql|sqlite|mongodb|redis|nosql|html|css|ffmpeg|django|flask|fastapi)\b/i.test(lower)
  ) {
    return { category: "languages", formatted };
  }

  // Fallback to Tools & Automation
  return { category: "tools", formatted };
}

/**
 * Detects if a skill string is an accidentally concatenated list of multiple technologies
 * across different categories (e.g. "AWS (EKS, CloudFront, Kubernetes, Docker, Helm, Terraform, Jenkins...)").
 * If detected, unwraps and extracts each distinct technology into its own array item.
 */
export function unwrapCompoundSkills(rawSkill: string): string[] {
  const trimmed = rawSkill.trim();
  if (!trimmed) return [];

  if (!trimmed.includes("(") && !trimmed.includes(",")) {
    return [formatTechnologyName(trimmed)];
  }

  const stripped = trimmed
    .replace(/^.*?\{:\s*/, "")
    .replace(/\}\s*$/, "")
    .trim();

  const parenMatch = stripped.match(/^([A-Za-z0-9\s/]+)\s*\(([\s\S]*)\)$/);
  if (parenMatch) {
    const prefix = parenMatch[1].trim();
    const inner = parenMatch[2].trim();

    const hasContainers = /\b(?:kubernetes|docker|helm|argocd|istio|ecr)\b/i.test(inner);
    const hasIac = /\b(?:terraform|ansible|cloudformation|cdk|bicep)\b/i.test(inner);
    const hasCicd = /\b(?:jenkins|github\s*actions|concourse|gocd|vsts|nexus|artifactory)\b/i.test(inner);
    const hasMonitoring = /\b(?:prometheus|grafana|splunk|alertmanager|zabbix)\b/i.test(inner);
    const hasSecurity = /\b(?:sonatype|veracode|sonarqube|waf|external\s*secrets)\b/i.test(inner);
    const hasLanguages = /\b(?:python|bash|typescript|node|sql|react)\b/i.test(inner);

    const crossCategoryCount = [hasContainers, hasIac, hasCicd, hasMonitoring, hasSecurity, hasLanguages].filter(Boolean).length;

    if (crossCategoryCount >= 2) {
      const items = inner.split(/,(?![^(]*\))/g).map(s => s.trim()).filter(Boolean);
      const results: string[] = [];

      if (/^(?:aws|amazon|azure|gcp)$/i.test(prefix)) {
        const cloudServices: string[] = [];
        for (const item of items) {
          const lowerItem = item.toLowerCase();
          const isNativeCloudService = /^(?:eks|ec2|vpc|rds|lambda|nlb|alb|nlb\/alb|cloudfront|s3|iam|irsa|iam\/irsa|route53|secrets\s*manager|ssm|parameter\s*store|sqs|sns|fargate|ecs|cloudwatch)$/i.test(lowerItem);
          if (isNativeCloudService) {
            cloudServices.push(item);
          } else {
            results.push(formatTechnologyName(item));
          }
        }
        if (cloudServices.length > 0) {
          results.unshift(`${prefix.toUpperCase()} (${cloudServices.join(", ")})`);
        } else {
          results.unshift(prefix.toUpperCase());
        }
        return results;
      }

      return items.map(formatTechnologyName);
    }
  }

  if (stripped.includes("(") && !stripped.includes(")") && stripped.length > 40) {
    const items = stripped.split(/[,()]/g).map(s => s.trim()).filter(Boolean);
    return items.map(formatTechnologyName);
  }

  return [formatTechnologyName(stripped)];
}

/**
 * Sanitizes and categorizes skills across any profession.
 * Unwraps concatenated strings and segregates skills into domain-appropriate ATS categories.
 */
export function sanitizeAndCategorizeSkills(
  skillsInput: Record<string, string[] | undefined> | string[] | any,
  domainContext: string = "devops"
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!skillsInput || typeof skillsInput !== "object") return result;

  const seenPerCategory: Record<string, Set<string>> = {};
  const ensureCategory = (cat: string) => {
    if (!result[cat]) {
      result[cat] = [];
      seenPerCategory[cat] = new Set();
    }
  };

  // If skillsInput is a flat array of strings
  if (Array.isArray(skillsInput)) {
    for (const item of skillsInput) {
      if (typeof item !== "string" || !item.trim()) continue;
      const unwrapped = unwrapCompoundSkills(item);
      for (const skill of unwrapped) {
        const { category, formatted } = classifySkill(skill, domainContext, []);
        ensureCategory(category);
        const lowerKey = formatted.toLowerCase();
        if (!seenPerCategory[category].has(lowerKey)) {
          seenPerCategory[category].add(lowerKey);
          result[category].push(formatted);
        }
      }
    }
  } else {
    // skillsInput is an object mapping categories to skill arrays
    const existingCategoryKeys = Object.keys(skillsInput).filter(
      k => Array.isArray(skillsInput[k]) && skillsInput[k]!.length > 0
    );

    for (const [cat, items] of Object.entries(skillsInput)) {
      if (!Array.isArray(items)) continue;
      const catLower = cat.toLowerCase();
      const isCustomDomainCategory = !TECH_CATEGORY_LABELS[catLower] && catLower !== "devops";

      for (const rawItem of items) {
        if (typeof rawItem !== "string" || !rawItem.trim()) continue;
        const unwrapped = unwrapCompoundSkills(rawItem);
        for (const skill of unwrapped) {
          if (isCustomDomainCategory) {
            ensureCategory(cat);
            const lowerKey = skill.toLowerCase();
            if (!seenPerCategory[cat].has(lowerKey)) {
              seenPerCategory[cat].add(lowerKey);
              result[cat].push(skill);
            }
          } else {
            const { category, formatted } = classifySkill(skill, domainContext, existingCategoryKeys);
            ensureCategory(category);
            const lowerKey = formatted.toLowerCase();
            if (!seenPerCategory[category].has(lowerKey)) {
              seenPerCategory[category].add(lowerKey);
              result[category].push(formatted);
            }
          }
        }
      }
    }
  }

  // Clean empty categories
  for (const [cat, arr] of Object.entries(result)) {
    if (!arr || arr.length === 0) {
      delete result[cat];
    }
  }

  return result;
}

/**
 * Aligns candidate skills for the target job posting across ANY domain.
 * Prioritizes targeted stacks and classifies employer gap keywords into their proper ATS categories.
 */
export function alignSkillsForJob(
  skills: Record<string, string[]>,
  jdText: string,
  gapKeywords: string[] = [],
  domainContext: string = "devops"
): {
  skills: Record<string, string[]>;
  addedSkills: string[];
  bridgedGaps: string[];
} {
  const result: Record<string, string[]> = JSON.parse(JSON.stringify(skills));
  const addedSkills: string[] = [];
  const bridgedGaps: string[] = [];

  const jdLower = (jdText || "").toLowerCase();
  const existingCategories = Object.keys(result);

  // 1. Tech & Cloud Alignment (for DevOps / Cloud profiles)
  const isAzure = /\b(?:azure|aks|azure\s*devops|arm|bicep|entra)\b/i.test(jdLower);
  const isAws = /\b(?:aws|eks|lambda|cloudformation|ecs|fargate)\b/i.test(jdLower);
  const isGcp = /\b(?:gcp|google\s*cloud|gke|cloud\s*run|bigquery)\b/i.test(jdLower);
  const isDevOpsProfile = Boolean(result.cloud || result.containers || result.iac || result.cicd);

  if (isDevOpsProfile) {
    if (isAzure) {
      if (!result.cloud) result.cloud = [];
      const cloudWithoutAzure = result.cloud.filter(c => !/\bazure\b/i.test(c));
      result.cloud = ["Azure", ...cloudWithoutAzure];

      if (!result.containers) result.containers = [];
      const contWithoutAks = result.containers.filter(c => !/\b(?:aks|kubernetes\s*\(aks\))\b/i.test(c));
      result.containers = ["Kubernetes (AKS)", ...contWithoutAks];

      if (!result.cicd) result.cicd = [];
      const cicdWithoutAdo = result.cicd.filter(c => !/\bazure\s*devops\b/i.test(c));
      result.cicd = ["Azure DevOps", ...cicdWithoutAdo];
    } else if (isAws) {
      if (!result.cloud) result.cloud = [];
      const cloudWithoutAws = result.cloud.filter(c => !/\baws\b/i.test(c));
      result.cloud = ["AWS", ...cloudWithoutAws];

      if (!result.containers) result.containers = [];
      const contWithoutEks = result.containers.filter(c => !/\b(?:eks|kubernetes\s*\(eks\))\b/i.test(c));
      result.containers = ["Kubernetes (EKS)", ...contWithoutEks];
    } else if (isGcp) {
      if (!result.cloud) result.cloud = [];
      const cloudWithoutGcp = result.cloud.filter(c => !/\bgcp\b/i.test(c));
      result.cloud = ["GCP", ...cloudWithoutGcp];

      if (!result.containers) result.containers = [];
      const contWithoutGke = result.containers.filter(c => !/\b(?:gke|kubernetes\s*\(gke\))\b/i.test(c));
      result.containers = ["Kubernetes (GKE)", ...contWithoutGke];
    }
  }

  // 2. Classify and distribute employer gap keywords into their proper categories
  const behavioralTerms = new Set([
    "communication", "collaboration", "leadership", "mentoring", "ownership",
    "problem solving", "teamwork", "adaptability", "flexibility", "stakeholder management"
  ]);

  for (const gap of gapKeywords) {
    const rawGap = (gap || "").trim();
    if (!rawGap || rawGap.length < 2) continue;
    const lowerGap = rawGap.toLowerCase();
    if (behavioralTerms.has(lowerGap)) continue;

    const { category, formatted } = classifySkill(rawGap, domainContext, existingCategories);
    const targetCat = category;

    if (!result[targetCat]) {
      result[targetCat] = [];
    }

    const allExisting = Object.values(result).flatMap(v => Array.isArray(v) ? v : []).map(x => String(x).toLowerCase());
    const formattedLower = formatted.toLowerCase();

    if (!allExisting.some(ex => ex === formattedLower || ex.includes(formattedLower) || formattedLower.includes(ex))) {
      result[targetCat] = [formatted, ...result[targetCat]];
      addedSkills.push(formatted);
      bridgedGaps.push(rawGap);

      // Teach the local taxonomy store
      taxonomyStore.recordLearnedSkill(formatted, targetCat, domainContext);
    }
  }

  return { skills: result, addedSkills, bridgedGaps };
}
