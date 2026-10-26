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
\small{%%PROFILE_SUMMARY%%}
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

function experience(profile: CandidateProfile, analysis: ApplicationAnalysis): string {
  return rankExperienceForJob(profile.experience || [], analysis).map(item => {
    const validBullets = (item.bullets || []).filter(b => b && b.trim().length > 0);
    const bullets = validBullets.map(bullet => `  \\resumeItem{${escapeLatex(bullet)}}`).join("\n");
    const bulletBlock = validBullets.length > 0 ? `\n\\resumeItemListStart\n${bullets}\n\\resumeItemListEnd` : "";
    return `\\resumeSubheading{${escapeLatex(item.company)}}{${escapeLatex(item.location)}}{${escapeLatex(item.role)}}{${escapeLatex(`${item.startDate} -- ${item.endDate}`)}}${bulletBlock}`;
  }).join("\n");
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

  const rawCategories: Array<[string, string[]]> = [
    ["Cloud Platforms", s.cloud || []],
    ["Containers \\& GitOps", s.containers || s.devops || []],
    ["Infrastructure as Code", s.iac || []],
    ["CI/CD \\& Build Tools", s.cicd || []],
    ["Monitoring \\& SRE", s.monitoring || s.observability || []],
    ["Security", s.security || []],
    ["Languages \\& Frameworks", s.languages || []],
    ["Tools \\& Automation", s.tools || []],
  ];

  for (const [key, values] of Object.entries(s)) {
    if (!standardKeys.has(key.toLowerCase()) && Array.isArray(values) && values.length > 0) {
      rawCategories.push([formatCategoryLabel(key), values]);
    }
  }

  const filtered = rawCategories.filter(([_, values]) => values && values.length > 0);
  if (!filtered.length) return "";
  const ordered = filtered.map(([label, values]) => [
    label,
    [...values].filter(Boolean).sort((a, b) => Number(matched.has((b || "").toLowerCase())) - Number(matched.has((a || "").toLowerCase())))
  ]) as Array<[string, string[]]>;
  const skillLines = ordered.map(([label, values]) => `\\textbf{${label}}{: ${values.map(escapeLatex).join(", ")}}`).join(" \\\\\n    ");
  return `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{\n    ${skillLines}\n  }}\n\\end{itemize}`;
}

function education(profile: CandidateProfile): string {
  return (profile.education || []).map(item => `\\resumeSubheading{${escapeLatex(item.institution)}}{}{${escapeLatex(item.degree)}}{${escapeLatex(`${item.startDate} -- ${item.endDate}`)}}`).join("\n");
}

function certifications(profile: CandidateProfile): string {
  if (!profile.certifications?.length) return "";
  const text = profile.certifications.map(item => [item.name, item.issuer, item.year].filter(Boolean).map(escapeLatex).join(", ")).join(" $|$ ");
  return `\\section{Certifications}\n\\begin{itemize}[leftmargin=0.15in,label={}]\\small{\\item{${text}}}\\end{itemize}`;
}

export function createLatexBackbone(): string {
  return DEFAULT_LATEX_BACKBONE;
}

export function renderTailoredResume(profile: CandidateProfile, job: JobInput, analysis: ApplicationAnalysis, summary?: string): string {
  const backbone = profile.latexBackbone?.includes(TOKENS.experience) ? profile.latexBackbone : DEFAULT_LATEX_BACKBONE;
  const replacements: Record<string, string> = {
    [TOKENS.header]: header(profile, job.role || profile.headline),
    [TOKENS.headline]: escapeLatex(job.role || profile.headline),
    [TOKENS.summary]: escapeLatex(summary || buildGroundedSummary(profile, job, analysis)),
    [TOKENS.experience]: experience(profile, analysis),
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

${evidenceParagraphs || "The uploaded resume does not yet contain direct evidence for the role's named requirements."}

I would welcome the chance to discuss the role and the work your team needs from this hire.

Yours sincerely,

${escapeLatex(profile.name)}
\end{document}
`;
}
