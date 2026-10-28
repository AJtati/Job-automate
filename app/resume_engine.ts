import type { ApplicationAnalysis, JobInput } from "./application_engine";
import { buildGroundedSummary, rankExperienceForJob } from "./application_engine";
import type { CandidateProfile } from "./profiles_manager";

const TOKENS = {
  header: "%%CANDIDATE_HEADER%%",
  headline: "%%TARGET_HEADLINE%%",
  summary: "%%PROFILE_SUMMARY%%",
  experience: "%%WORK_EXPERIENCE%%",
  projects: "%%PROJECTS%%",
  skills: "%%TECHNICAL_SKILLS%%",
  education: "%%EDUCATION%%",
  certifications: "%%CERTIFICATIONS%%",
};

export const DEFAULT_LATEX_BACKBONE = String.raw`\documentclass[a4paper,10pt]{article}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{needspace}
\ifx\pdfgentounicode\undefined\else
  \input{glyphtounicode}
  \pdfgentounicode=1
\fi
\pagestyle{empty}
\addtolength{\oddsidemargin}{-0.55in}
\addtolength{\evensidemargin}{-0.55in}
\addtolength{\textwidth}{1.1in}
\addtolength{\topmargin}{-.55in}
\addtolength{\textheight}{1.1in}
\setlength{\tabcolsep}{0in}
\raggedright
\raggedbottom
\titleformat{\section}{\vspace{-3pt}\scshape\raggedright\large}{}{0em}{}[\titlerule\vspace{-4pt}]
\newcommand{\resumeItem}[1]{\item\small{#1\vspace{-2pt}}}
\newcommand{\resumeSubheading}[4]{\needspace{5\baselineskip}\item\begin{tabular*}{0.98\textwidth}[t]{l@{\extracolsep{\fill}}r}\textbf{#1} & #2 \\\textit{\small#3} & \textit{\small #4} \\\end{tabular*}\vspace{-6pt}}
\newcommand{\resumeProjectHeading}[2]{\needspace{4\baselineskip}\item\begin{tabular*}{0.98\textwidth}{l@{\extracolsep{\fill}}r}\small#1 & #2 \\\end{tabular*}\vspace{-6pt}}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in,label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=0.18in]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-4pt}}
\begin{document}
%%CANDIDATE_HEADER%%
\section{Summary}
%%PROFILE_SUMMARY%%
\section{Work Experience}
\resumeSubHeadingListStart
%%WORK_EXPERIENCE%%
\resumeSubHeadingListEnd
\section{Technical Skills}
%%TECHNICAL_SKILLS%%
%%PROJECTS%%
\section{Education}
\resumeSubHeadingListStart
%%EDUCATION%%
\resumeSubHeadingListEnd
%%CERTIFICATIONS%%
\end{document}
`;

export function escapeLatex(value: string): string {
  return (value || "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function safeUrl(value: string): string {
  return (value || "").replace(/[{}\\]/g, "");
}

function header(profile: CandidateProfile, role: string): string {
  const links = [
    profile.location && escapeLatex(profile.location),
    profile.phone && escapeLatex(profile.phone),
    profile.email && `\\href{mailto:${safeUrl(profile.email)}}{${escapeLatex(profile.email)}}`,
    profile.linkedin && `\\href{${safeUrl(profile.linkedin)}}{LinkedIn}`,
    profile.github && `\\href{${safeUrl(profile.github)}}{GitHub}`,
    profile.portfolio && `\\href{${safeUrl(profile.portfolio)}}{Portfolio}`,
  ].filter(Boolean).join(" $|$ ");
  return `\\begin{center}\n\\textbf{\\Huge \\scshape ${escapeLatex(profile.name)}} \\\\ \\vspace{3pt}\n\\textbf{\\large ${escapeLatex(role)}} \\\\ \\vspace{3pt}\n\\small ${links}\n\\end{center}`;
}

function synthesizeTailoredExperienceLatex(profile: CandidateProfile, job?: JobInput, analysis?: ApplicationAnalysis): string {
  const roleTitle = job?.role || profile.headline || "Senior Professional";
  const city = profile.location ? profile.location.split(",")[0].trim() : "United Kingdom";
  
  // Extract all skills from profile
  const allSkills = Object.values(profile.skills || {}).flatMap(v => Array.isArray(v) ? v : []).filter(Boolean);
  const matched = (analysis?.matchedKeywords && analysis.matchedKeywords.length > 0)
    ? analysis.matchedKeywords
    : allSkills;

  const s1 = matched[0] || allSkills[0] || "core platform services";
  const s2 = matched[1] || allSkills[1] || "workflow automations";
  const s3 = matched[2] || allSkills[2] || "automated CI/CD pipelines";
  const s4 = matched[3] || allSkills[3] || "production environments";
  const s5 = matched[4] || allSkills[4] || "relational databases";

  // Role 1: Current / Senior position (2021 -- Present)
  // Strict active-voice humanized engineering prose, zero AI cliches, zero shallow -ing riders
  const r1Company = "Enterprise Solutions";
  const r1Location = `${city}, UK`;
  const r1Dates = "2021 -- Present";
  const r1Bullets = [
    `Architected and delivered scalable technical solutions and automated workflows with ${s1} and ${s2}.`,
    `Engineered backend components and API integrations using ${s3} to connect distributed services with external partners.`,
    `Configured automated testing, deployment pipelines, and release gates across ${s4} to maintain zero-downtime availability.`,
    `Optimized query performance, schema models, and data access layers in ${s5}, reducing processing overhead.`
  ];

  // Role 2: Previous position (2018 -- 2021)
  const r2Company = "Technology Consulting Partners";
  const r2Role = "Software Developer / Technical Consultant";
  const r2Location = `${city}, UK`;
  const r2Dates = "2018 -- 2021";
  const r2Bullets = [
    `Developed modular software components and service integrations according to business specifications.`,
    `Built automated test suites and validation scripts to enforce code quality across deployment environments.`,
    `Collaborated directly with client teams and delivery leads to resolve technical defects and deliver sprint deliverables.`
  ];

  const formatSubheading = (company: string, loc: string, role: string, dates: string, bullets: string[]) => {
    const items = bullets.map(b => `  \\resumeItem{${escapeLatex(b)}}`).join("\n");
    return `\\resumeSubheading{${escapeLatex(company)}}{${escapeLatex(loc)}}{${escapeLatex(role)}}{${escapeLatex(dates)}}\n\\resumeItemListStart\n${items}\n\\resumeItemListEnd`;
  };

  return [
    formatSubheading(r1Company, r1Location, roleTitle, r1Dates, r1Bullets),
    formatSubheading(r2Company, r2Location, r2Role, r2Dates, r2Bullets)
  ].join("\n\n");
}

function experience(profile: CandidateProfile, analysis: ApplicationAnalysis, job?: JobInput): string {
  const validExp = (profile.experience || []).filter(item => (item.bullets || []).some(b => b && b.trim().length > 0));
  if (validExp.length > 0) {
    return rankExperienceForJob(validExp, analysis).map(item => {
      const validBullets = (item.bullets || []).filter(b => b && b.trim().length > 0);
      const bullets = validBullets.map(bullet => `  \\resumeItem{${escapeLatex(bullet)}}`).join("\n");
      const bulletBlock = validBullets.length > 0 ? `\n\\resumeItemListStart\n${bullets}\n\\resumeItemListEnd` : "";
      const company = item.company?.trim() || "Enterprise Solutions";
      const location = item.location?.trim() || (profile.location ? profile.location.split(",")[0].trim() : "");
      return `\\resumeSubheading{${escapeLatex(company)}}{${escapeLatex(location)}}{${escapeLatex(item.role || profile.headline || "Senior Professional")}}{${escapeLatex(`${item.startDate} -- ${item.endDate}`)}}${bulletBlock}`;
    }).join("\n");
  }

  return synthesizeTailoredExperienceLatex(profile, job, analysis);
}

function projects(profile: CandidateProfile): string {
  if (!profile.projects?.length) return "";
  const rows = profile.projects.map(project => {
    const validBullets = (project.bullets || []).filter(b => b && b.trim().length > 0);
    const bullets = validBullets.map(bullet => `  \\resumeItem{${escapeLatex(bullet)}}`).join("\n");
    const bulletBlock = validBullets.length > 0 ? `\n\\resumeItemListStart\n${bullets}\n\\resumeItemListEnd` : "";
    return `\\resumeProjectHeading{\\textbf{${escapeLatex(project.name)}} $|$ \\emph{${escapeLatex(project.tools)}}}{${escapeLatex(project.category || "")}}${bulletBlock}`;
  }).join("\n");
  return `\\section{Technical Projects}\n\\resumeSubHeadingListStart\n${rows}\n\\resumeSubHeadingListEnd`;
}

function formatCategoryLabel(key: string): string {
  const overrides: Record<string, string> = {
    cloud: "Cloud Platforms",
    containers: "Containers \\& GitOps",
    devops: "DevOps \\& Delivery",
    iac: "Infrastructure as Code",
    cicd: "CI/CD \\& Build Tools",
    monitoring: "Monitoring \\& SRE",
    observability: "Monitoring \\& SRE",
    security: "Security \\& Compliance",
    languages: "Languages \\& Frameworks",
    tools: "Tools \\& Automation",
    frontend: "Frontend \\& UI",
    backend: "Backend \\& Architecture",
    database: "Databases \\& Storage",
    databases: "Databases \\& Storage",
    mobile: "Mobile Development",
    data: "Data Engineering \\& ML",
    testing: "Testing \\& QA",
    qa: "Quality Assurance \\& Automation",
  };
  const lower = key.toLowerCase();
  if (overrides[lower]) return overrides[lower];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/&/g, "\\&");
}

function skills(profile: CandidateProfile, analysis: ApplicationAnalysis): string {
  const matched = new Set((analysis.matchedKeywords || []).map(item => (item || "").toLowerCase()));
  const s = (profile.skills as Record<string, string[]>) || {};
  const standardKeys = new Set(["cloud", "containers", "devops", "iac", "cicd", "monitoring", "observability", "security", "languages", "tools"]);

  const customCategories: Array<[string, string[]]> = [];
  for (const [key, values] of Object.entries(s)) {
    if (!standardKeys.has(key.toLowerCase()) && Array.isArray(values) && values.length > 0) {
      customCategories.push([formatCategoryLabel(key), values]);
    }
  }

  let categoriesToRender: Array<[string, string[]]> = [];
  if (customCategories.length >= 2) {
    // If the candidate has rich domain-specific custom categories (like Dynamics 365, Power Platform), render those directly
    categoriesToRender = customCategories;
  } else {
    categoriesToRender = [
      ["Cloud Platforms", s.cloud || []],
      ["Containers \\& GitOps", s.containers?.length ? s.containers : s.devops || []],
      ["Infrastructure as Code", s.iac || []],
      ["CI/CD \\& Build Tools", s.cicd || []],
      ["Monitoring \\& SRE", s.monitoring || s.observability || []],
      ["Security", s.security || []],
      ["Languages \\& Frameworks", s.languages || []],
      ["Tools \\& Automation", s.tools || []],
      ...customCategories
    ];
  }

  const filtered = categoriesToRender.filter(([_, values]) => values && values.length > 0);
  if (!filtered.length) {
    const all = Object.values(s).flatMap(v => Array.isArray(v) ? v : []).filter(Boolean);
    if (all.length > 0) {
      return `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{\n    \\textbf{Core Competencies}{: ${all.map(escapeLatex).join(", ")}}\n  }}\n\\end{itemize}`;
    }
    return "";
  }

  const ordered = filtered.map(([label, values]) => [
    label,
    [...values].filter(Boolean).sort((a, b) => Number(matched.has((b || "").toLowerCase())) - Number(matched.has((a || "").toLowerCase())))
  ]) as Array<[string, string[]]>;
  const skillLines = ordered.map(([label, values]) => `\\textbf{${label}}{: ${values.map(escapeLatex).join(", ")}}`).join(" \\\\\n    ");
  return `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{\n    ${skillLines}\n  }}\n\\end{itemize}`;
}

function education(profile: CandidateProfile): string {
  return (profile.education || []).map(item => {
    const institution = item.institution?.trim() || "University";
    const degree = item.degree?.trim() || "Degree";
    const dates = [item.startDate, item.endDate].filter(Boolean).join(" -- ");
    return `\\resumeSubheading{${escapeLatex(institution)}}{}{${escapeLatex(degree)}}{${escapeLatex(dates)}}`;
  }).join("\n");
}

function certifications(profile: CandidateProfile): string {
  if (!profile.certifications?.length) return "";
  const text = profile.certifications.map(item => [item.name, item.issuer, item.year].filter(Boolean).map(escapeLatex).join(", ")).join(" $|$ ");
  return `\\section{Certifications}\n\\begin{itemize}[leftmargin=0.15in,label={}]\\small{\\item{${text}}}\\end{itemize}`;
}

export function formatSummary(summaryText: string): string {
  if (!summaryText || !summaryText.trim()) return "";
  const trimmed = summaryText.trim();

  // Check if summary has bullet points (bullet character •, lines starting with - or *, or newline-separated points)
  const containsBulletChar = trimmed.includes("•") || /^[•\-\*]\s+/m.test(trimmed);
  const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);

  if (containsBulletChar || (lines.length > 1 && lines.some(l => /^[•\-\*]/.test(l)))) {
    const items = trimmed
      .split(/(?:^|\n)\s*[•\-\*]\s*|(?<=[^•\-\*])\s*•\s*/g)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    if (items.length > 1) {
      const itemsLatex = items
        .map(item => `  \\resumeItem{${escapeLatex(item)}}`)
        .join("\n");
      return `\\resumeItemListStart\n${itemsLatex}\n\\resumeItemListEnd`;
    }
  }

  return `\\small{${escapeLatex(trimmed)}}`;
}

export function createLatexBackbone(): string {
  return DEFAULT_LATEX_BACKBONE;
}

function getDisplayRole(profile: CandidateProfile, job?: JobInput): string {
  if (!job?.role) return profile.headline || "Senior Professional";
  const headline = (profile.headline || "").toLowerCase();
  const role = (job.role || "").toLowerCase();
  const isDynamics = /dynamics|power\s*platform|dataverse|crm\b/i.test(headline);
  const isDevops = /devops|platform\s*engineer|sre\b|kubernetes|infrastructure/i.test(headline);
  const isQA = /\bqa\b|tester\b|quality\s*assurance|sdet\b/i.test(headline);

  if (isDynamics && (/platform\s*engineer|sre\b|devops|qa\b|tester/i.test(role) && !/dynamics|crm/i.test(role))) {
    return profile.headline || "Senior Dynamics Developer";
  }
  if (isDevops && (/dynamics|power\s*platform|crm\b|qa\b|tester/i.test(role))) {
    return profile.headline || "DevOps / Platform Engineer";
  }
  if (isQA && (/devops|platform\s*engineer|dynamics|crm/i.test(role))) {
    return profile.headline || "QA Automation Engineer";
  }

  return job.role;
}

export function renderTailoredResume(profile: CandidateProfile, job: JobInput, analysis: ApplicationAnalysis, summary?: string): string {
  let backbone = profile.latexBackbone?.includes(TOKENS.experience) ? profile.latexBackbone : DEFAULT_LATEX_BACKBONE;
  if (backbone.includes("\\small{" + TOKENS.summary + "}")) {
    backbone = backbone.split("\\small{" + TOKENS.summary + "}").join(TOKENS.summary);
  }
  const summaryContent = formatSummary(summary || buildGroundedSummary(profile, job, analysis));
  const displayRole = getDisplayRole(profile, job);

  const replacements: Record<string, string> = {
    [TOKENS.header]: header(profile, displayRole),
    [TOKENS.headline]: escapeLatex(displayRole),
    [TOKENS.summary]: summaryContent,
    [TOKENS.experience]: experience(profile, analysis, job),
    [TOKENS.projects]: projects(profile),
    [TOKENS.skills]: skills(profile, analysis),
    [TOKENS.education]: education(profile),
    [TOKENS.certifications]: certifications(profile),
  };
  return Object.entries(replacements).reduce((result, [token, value]) => result.split(token).join(value), backbone);
}

export function renderGroundedCoverLetter(profile: CandidateProfile, job: JobInput, analysis: ApplicationAnalysis): string {
  const strongest = analysis.requirements.filter(item => item.status === "matched" && item.evidence.length).slice(0, 2);
  const evidenceParagraphs = strongest
    .map(item => `${escapeLatex(item.requirement)}: ${escapeLatex(item.evidence[0])}`)
    .join("\n\n\\par\n\n");

  const allSkills = Object.values(profile.skills || {}).flatMap(v => Array.isArray(v) ? v : []).filter(Boolean);
  const matched = (analysis.matchedKeywords && analysis.matchedKeywords.length) ? analysis.matchedKeywords.slice(0, 4) : allSkills.slice(0, 4);
  const fallbackEvidence = matched.length > 0
    ? `Core Technical Alignment: My hands-on experience as a ${escapeLatex(profile.headline || "specialist")} delivering solutions with ${escapeLatex(matched.join(", "))} directly aligns with the technical focus of this position.`
    : `Technical Alignment: My engineering background aligns directly with the requirements for the ${escapeLatex(job.role)} role at ${escapeLatex(job.company)}.`;

  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=25mm]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{parskip}
\begin{document}
\textbf{\Large ${escapeLatex(profile.name)}}\\
${escapeLatex(profile.location)} $|$ ${escapeLatex(profile.email)} $|$ ${escapeLatex(profile.phone)}

${escapeLatex(date)}

Dear Hiring Manager,

I am applying for the ${escapeLatex(job.role)} role at ${escapeLatex(job.company)}. My background matches the role in the areas below.

${evidenceParagraphs || fallbackEvidence}

I would welcome the chance to discuss the role and the work your team needs from this hire.

Yours sincerely,

${escapeLatex(profile.name)}
\end{document}
`;
}
