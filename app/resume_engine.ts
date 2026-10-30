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

export type SupportedLanguage = "en" | "de" | "es" | "fr" | "it" | "nl";

export interface LanguagePack {
  code: SupportedLanguage;
  name: string;
  babel: string;
  summaryTitle: string;
  experienceTitle: string;
  skillsTitle: string;
  projectsTitle: string;
  educationTitle: string;
  certificationsTitle: string;
  presentLabel: string;
  coreCompetenciesLabel: string;
  dearHiringManager: string;
  applyingSentence: (role: string, company: string) => string;
  matchingSentence: string;
  closingSentence: string;
  yoursSincerely: string;
  // Extended Heart, Curiosity & Fit Narrative Generators
  curiosityHook?: (role: string, company: string, domainOrHeadline?: string) => string;
  evidenceNarrative?: (role: string, company: string, recentTitle: string, recentCompany: string, skills: string[], achievement?: string) => string;
  philosophyFit?: (role: string, company: string, headline?: string) => string;
  forwardClosing?: (role: string, company: string) => string;
}

export const LANGUAGE_PACKS: Record<SupportedLanguage, LanguagePack> = {
  en: {
    code: "en",
    name: "English",
    babel: "english",
    summaryTitle: "Summary",
    experienceTitle: "Work Experience",
    skillsTitle: "Technical Skills",
    projectsTitle: "Projects",
    educationTitle: "Education",
    certificationsTitle: "Certifications",
    presentLabel: "Present",
    coreCompetenciesLabel: "Core Competencies",
    dearHiringManager: "Dear Hiring Team,",
    applyingSentence: (role, company) => `I am writing to apply for the ${role} position at ${company}.`,
    matchingSentence: "My engineering background aligns directly with what you are looking for.",
    closingSentence: "I would welcome the opportunity to discuss how my background fits your team.",
    yoursSincerely: "Sincerely,",
    curiosityHook: (role, company, domainOrHeadline) =>
      `I am writing to apply for the ${role} position at ${company}. My background as a ${domainOrHeadline || "software engineer"} centers on building reliable infrastructure and supporting development teams, and your focus on stable, scalable systems matches what I do day-to-day. I know ${company}'s work and would welcome the chance to contribute to your engineering goals.`,
    evidenceNarrative: (role, company, recentTitle, recentCompany, skills, achievement) => {
      const skillsPhrase = skills.length ? `working extensively with ${skills.join(", ")}` : "managing cloud infrastructure and deployment pipelines";
      const winPhrase = achievement ? `For example, ${achievement.replace(/\.$/, "")}.` : "I focused on keeping systems stable, reducing operational toil, and ensuring deployments ran smoothly.";
      return `Most recently as ${recentTitle} at ${recentCompany}, my work focused on ${skillsPhrase}. ${winPhrase} I care about solid automation, clear observability, and making sure engineers can deploy software without friction.`;
    },
    philosophyFit: (role, company, headline) =>
      `My approach to engineering is straightforward: understand the operational reality before adding new tools, keep architectures simple to run, and document decisions so the team can maintain them easily. I enjoy collaborating directly with developers, identifying where workflows slow down, and fixing those bottlenecks at the source.`,
    forwardClosing: (role, company) =>
      `I would welcome the opportunity to discuss your current infrastructure roadmap and where you need the most support. Thank you for your time and consideration.`
  },
  de: {
    code: "de",
    name: "German",
    babel: "ngerman",
    summaryTitle: "Profil",
    experienceTitle: "Berufserfahrung",
    skillsTitle: "Kenntnisse und Fähigkeiten",
    projectsTitle: "Projekte",
    educationTitle: "Ausbildung",
    certificationsTitle: "Zertifizierungen",
    presentLabel: "Heute",
    coreCompetenciesLabel: "Kernkompetenzen",
    dearHiringManager: "Sehr geehrte Damen und Herren,",
    applyingSentence: (role, company) => `hiermit bewerbe ich mich um die Position als ${role} bei ${company}.`,
    matchingSentence: "Mein technischer Hintergrund und meine praktische Erfahrung entsprechen den Anforderungen dieser Position.",
    closingSentence: "Ich freue mich auf die Gelegenheit, mich in einem persönlichen Gespräch vorzustellen.",
    yoursSincerely: "Mit freundlichen Grüßen,",
    curiosityHook: (role, company, domainOrHeadline) =>
      `ich bewerbe mich um die Stelle als ${role} bei ${company}. Als ${domainOrHeadline || "Software- und Plattform-Ingenieur"} liegt mein Schwerpunkt auf verlässlichen Cloud-Infrastrukturen und automatisierter Bereitstellung. Die Anforderungen Ihres Teams passen genau zu den Aufgaben, die ich im Arbeitsalltag gerne löse.`,
    evidenceNarrative: (role, company, recentTitle, recentCompany, skills, achievement) => {
      const skillsPhrase = skills.length ? `Lösungen mit ${skills.join(", ")} umzusetzen` : "stabile Cloud-Systeme und automatisierte Pipelines zu betreiben";
      const winPhrase = achievement ? `Zum Beispiel: ${achievement.replace(/\.$/, "")}.` : "Mein Schwerpunkt lag darauf, Systeme zuverlässig zu halten und operative Hürden für das Team abzubauen.";
      return `Zuletzt war ich als ${recentTitle} bei ${recentCompany} tätig, wo ich mich vor allem darauf konzentriert habe, ${skillsPhrase}. ${winPhrase} Mir ist wichtig, Infrastruktur einfach und transparent zu halten, damit Entwickler zügig und sicher arbeiten können.`;
    },
    philosophyFit: (role, company, headline) =>
      `Gute Ingenieurarbeit bedeutet für mich klare Kommunikation, saubere Dokumentation und pragmatische Entscheidungen ohne unnötige Komplexität. Ich arbeite gerne direkt mit den Entwicklern zusammen, um Reibungspunkte in den Abläufen an der Wurzel zu beheben.`,
    forwardClosing: (role, company) =>
      `Ich freue mich über die Gelegenheit, mich persönlich mit Ihnen über Ihre aktuellen technischen Vorhaben auszutauschen. Vielen Dank für Ihre Zeit und die Prüfung meiner Unterlagen.`
  },
  es: {
    code: "es",
    name: "Spanish",
    babel: "spanish",
    summaryTitle: "Perfil Profesional",
    experienceTitle: "Experiencia Laboral",
    skillsTitle: "Habilidades Técnicas",
    projectsTitle: "Proyectos",
    educationTitle: "Educación",
    certificationsTitle: "Certificaciones",
    presentLabel: "Presente",
    coreCompetenciesLabel: "Competencias Principales",
    dearHiringManager: "Estimado equipo de selección,",
    applyingSentence: (role, company) => `Les escribo para presentar mi candidatura al puesto de ${role} en ${company}.`,
    matchingSentence: "Mi formación técnica y experiencia práctica responden directamente a los requisitos de esta posición.",
    closingSentence: "Quedo a su disposición para mantener una entrevista y ampliar cualquier detalle sobre mi perfil.",
    yoursSincerely: "Atentamente,",
    curiosityHook: (role, company, domainOrHeadline) =>
      `Les escribo para presentar mi candidatura al puesto de ${role} en ${company}. Como ${domainOrHeadline || "ingeniero de software y plataformas"}, mi trabajo se centra en construir infraestructuras cloud fiables y apoyar a los equipos de desarrollo. Los retos técnicos descritos en su oferta coinciden con lo que hago a diario.`,
    evidenceNarrative: (role, company, recentTitle, recentCompany, skills, achievement) => {
      const skillsPhrase = skills.length ? `trabajar ampliamente con ${skills.join(", ")}` : "administrar infraestructuras cloud y pipelines de despliegue";
      const winPhrase = achievement ? `Por ejemplo: ${achievement.replace(/\.$/, "")}.` : "Me enfoqué en mantener la estabilidad de los sistemas y eliminar fricciones operativas.";
      return `En mi puesto más reciente como ${recentTitle} en ${recentCompany}, mi trabajo se centró en ${skillsPhrase}. ${winPhrase} Priorizo la automatización sólida y una observabilidad clara para que los equipos puedan desplegar con confianza.`;
    },
    philosophyFit: (role, company, headline) =>
      `Mi enfoque de trabajo es directo: entender el problema operativo antes de añadir nuevas herramientas, mantener los sistemas sencillos de operar y documentar las decisiones para que el equipo pueda mantenerlos fácilmente. Me gusta trabajar codo con codo con los desarrolladores para resolver cuellos de botella en el flujo de trabajo.`,
    forwardClosing: (role, company) =>
      `Estaré encantado de conversar con su equipo sobre su hoja de ruta técnica y los puntos en los que necesitan mayor apoyo. Agradezco sinceramente su tiempo y valoración.`
  },
  fr: {
    code: "fr",
    name: "French",
    babel: "french",
    summaryTitle: "Profil Professionnel",
    experienceTitle: "Expérience Professionnelle",
    skillsTitle: "Compétences Techniques",
    projectsTitle: "Projets",
    educationTitle: "Formation",
    certificationsTitle: "Certifications",
    presentLabel: "Présent",
    coreCompetenciesLabel: "Compétences Clés",
    dearHiringManager: "Madame, Monsieur,",
    applyingSentence: (role, company) => `Je vous adresse ma candidature pour le poste de ${role} au sein de ${company}.`,
    matchingSentence: "Mon expertise technique et pratique répond directement aux exigences du poste.",
    closingSentence: "Je reste à votre disposition pour un entretien afin d'échanger sur cette opportunité.",
    yoursSincerely: "Bien cordialement,",
    curiosityHook: (role, company, domainOrHeadline) =>
      `Je vous adresse ma candidature pour le poste de ${role} au sein de ${company}. En tant que ${domainOrHeadline || "ingénieur logiciel et plateforme"}, mon activité quotidienne consiste à concevoir des infrastructures fiables et à soutenir les équipes de développement. Les priorités techniques présentées dans votre offre correspondent à mon cœur de métier.`,
    evidenceNarrative: (role, company, recentTitle, recentCompany, skills, achievement) => {
      const skillsPhrase = skills.length ? `travailler activement avec ${skills.join(", ")}` : "administrer des infrastructures cloud et des pipelines d'intégration continue";
      const winPhrase = achievement ? `Par exemple : ${achievement.replace(/\.$/, "")}.` : "Mon action a consisté à garantir la stabilité des services et à simplifier le quotidien des équipes opérationnelles.";
      return `Récemment, en tant que ${recentTitle} chez ${recentCompany}, j'ai principalement axé mon travail sur ${skillsPhrase}. ${winPhrase} J'accorde une importance essentielle à l'automatisation rigoureuse pour permettre des déploiements fluides et prévisibles.`;
    },
    philosophyFit: (role, company, headline) =>
      `J'aborde l'ingénierie avec une démarche pragmatique : bien comprendre les besoins avant d'ajouter de nouveaux outils, garder les architectures simples à exploiter et documenter les choix pour faciliter le travail d'équipe. J'apprécie collaborer directement avec les développeurs pour lever les blocages à la source.`,
    forwardClosing: (role, company) =>
      `Je serais ravi d'échanger avec votre équipe sur vos chantiers techniques actuels et sur la façon dont je peux vous accompagner. Je vous remercie pour l'attention portée à ma candidature.`
  },
  it: {
    code: "it",
    name: "Italian",
    babel: "italian",
    summaryTitle: "Profilo Professionale",
    experienceTitle: "Esperienza Lavorativa",
    skillsTitle: "Competenze Tecniche",
    projectsTitle: "Progetti",
    educationTitle: "Istruzione e Formazione",
    certificationsTitle: "Certificazioni",
    presentLabel: "Presente",
    coreCompetenciesLabel: "Competenze Principali",
    dearHiringManager: "Gentile team di selezione,",
    applyingSentence: (role, company) => `Desidero sottoporre la mia candidatura per la posizione di ${role} presso ${company}.`,
    matchingSentence: "La mia esperienza tecnica e professionale risponde direttamente ai requisiti richiesti.",
    closingSentence: "Resto a disposizione per un colloquio conoscitivo per approfondire la mia candidatura.",
    yoursSincerely: "Cordiali saluti,",
    curiosityHook: (role, company, domainOrHeadline) =>
      `Desidero sottoporre la mia candidatura per la posizione di ${role} presso ${company}. Come ${domainOrHeadline || "ingegnere di piattaforme"}, il mio lavoro quotidiano consiste nel mantenere infrastrutture cloud stabili e nell'aiutare i team di sviluppo a lavorare con efficienza. Gli obiettivi tecnici descritti nella vostra posizione riflettono fedelmente le sfide che affronto regolarmente.`,
    evidenceNarrative: (role, company, recentTitle, recentCompany, skills, achievement) => {
      const skillsPhrase = skills.length ? `lavorare assiduamente con ${skills.join(", ")}` : "gestire infrastrutture cloud e pipeline CI/CD";
      const winPhrase = achievement ? `Ad esempio: ${achievement.replace(/\.$/, "")}.` : "Il mio focus è sempre stato ridurre le frizioni operative e garantire rilasci affidabili.";
      return `Nel mio ruolo più recente come ${recentTitle} presso ${recentCompany}, mi sono dedicato principalmente a ${skillsPhrase}. ${winPhrase} Ritengo fondamentale costruire automazioni chiare e monitoraggi solidi per consentire agli ingegneri di rilasciare in sicurezza.`;
    },
    philosophyFit: (role, company, headline) =>
      `Il mio approccio all'ingegneria è concreto: comprendere a fondo le problematiche operative prima di introdurre nuovi strumenti, mantenere i sistemi facili da gestire e documentare le scelte architetturali. Mi piace lavorare a stretto contatto con gli sviluppatori per eliminare i colli di bottiglia nei flussi di lavoro.`,
    forwardClosing: (role, company) =>
      `Sarei lieto di approfondire le vostre priorità tecniche attuali e capire dove posso offrire il supporto più utile. Vi ringrazio per il tempo dedicato alla valutazione del mio profilo.`
  },
  nl: {
    code: "nl",
    name: "Dutch",
    babel: "dutch",
    summaryTitle: "Profiel",
    experienceTitle: "Werkervaring",
    skillsTitle: "Technische Vaardigheden",
    projectsTitle: "Projecten",
    educationTitle: "Opleiding",
    certificationsTitle: "Certificeringen",
    presentLabel: "Heden",
    coreCompetenciesLabel: "Kerncompetenties",
    dearHiringManager: "Beste selectiecommissie,",
    applyingSentence: (role, company) => `Hierbij solliciteer ik naar de functie van ${role} bij ${company}.`,
    matchingSentence: "Mijn technische vaardigheden en praktijkervaring sluiten nauw aan bij het profiel.",
    closingSentence: "Graag licht ik mijn motivatie en ervaring toe in een persoonlijk gesprek.",
    yoursSincerely: "Met vriendelijke groet,",
    curiosityHook: (role, company, domainOrHeadline) =>
      `Hierbij solliciteer ik naar de functie van ${role} bij ${company}. Als ${domainOrHeadline || "platform engineer"} richt mijn dagelijkse werk zich op het bouwen van betrouwbare cloud-infrastructuur en het ondersteunen van developmentteams. De technische uitdagingen in uw vacature sluiten direct aan bij wat ik graag doe.`,
    evidenceNarrative: (role, company, recentTitle, recentCompany, skills, achievement) => {
      const skillsPhrase = skills.length ? `intensief werken met ${skills.join(", ")}` : "het beheren van cloud-infrastructuur en deployment pipelines";
      const winPhrase = achievement ? `Bijvoorbeeld: ${achievement.replace(/\.$/, "")}.` : "Mijn aandacht ging uit naar een stabiele werking en het verminderen van handmatig beheer.";
      return `In mijn recente functie als ${recentTitle} bij ${recentCompany} lag mijn focus op ${skillsPhrase}. ${winPhrase} Ik hecht veel waarde aan duidelijke automatisering en goede monitoring, zodat teams zonder belemmeringen kunnen releasen.`;
    },
    philosophyFit: (role, company, headline) =>
      `Mijn benadering van engineering is nuchter: eerst het operationele probleem begrijpen voordat er nieuwe tools worden gekozen, systemen beheersbaar houden en beslissingen helder vastleggen voor het team. Ik werk graag samen met developers om bottlenecks in hun workflow direct op te lossen.`,
    forwardClosing: (role, company) =>
      `Ik ga graag met uw team in gesprek over uw huidige plannen voor de infrastructuur en waar u de meeste ondersteuning nodig heeft. Hartelijk dank voor uw tijd en aandacht.`
  }
};

export function detectLanguageDeterministically(text?: string): SupportedLanguage {
  if (!text) return "en";
  const t = text.toLowerCase();

  // German detection: check section headers OR common German action verbs / connectors / umlauts
  const deHeaderMatch = /\b(berufserfahrung|ausbildung|kenntnisse|lebenslauf|weiterbildung|zertifikate|f[äa]higkeiten|deutschland|abschluss)\b/i.test(t);
  const deWords = (t.match(/\b(und|der|die|das|den|dem|des|ein|eine|einer|einem|einen|eines|für|mit|von|im|in|auf|aus|durch|nach|zur|zum|unter|über|bei|sowie|wodurch|wurde|wurden|wird|werden|nicht|als|auch|sich|sind|ist|war|waren|oder|entwicklung|optimierung|unterstützung|erstellung|umsetzung|durchführung|automatisierung|konzeption|anwendung|sicherstellung|erfahrung)\b/g) || []).length;
  const deUmlauts = (t.match(/[äöüß]/g) || []).length;
  if (deHeaderMatch || deWords >= 2 || (deWords >= 1 && deUmlauts >= 1)) {
    return "de";
  }

  // Spanish detection
  const esHeaderMatch = /\b(experiencia\s+laboral|educaci[oó]n|habilidades\s+t[eé]cnicas|curr[ií]culum|formaci[oó]n\s+acad[eé]mica)\b/i.test(t);
  const esWords = (t.match(/\b(y|el|la|los|las|un|una|en|de|del|por|para|con|como|su|sus|que|desarrollo|experiencia|educación|gestión|diseño|implementación|creación|optimización)\b/g) || []).length;
  if (esHeaderMatch || esWords >= 3) {
    return "es";
  }

  // French detection
  const frHeaderMatch = /\b(exp[eé]rience\s+professionnelle|comp[eé]tences\s+techniques|dipl[oô]me|formation\s+acad[eé]mique)\b/i.test(t);
  const frWords = (t.match(/\b(et|le|la|les|un|une|dans|en|pour|avec|par|sur|du|des|est|sont|expérience|développement|gestion|conception|mise|optimisation)\b/g) || []).length;
  if (frHeaderMatch || frWords >= 3) {
    return "fr";
  }

  // Italian detection
  const itHeaderMatch = /\b(esperienza\s+lavorativa|competenze\s+tecniche|istruzione|certificazioni)\b/i.test(t);
  const itWords = (t.match(/\b(e|il|lo|la|i|gli|le|un|uno|una|in|con|per|su|da|del|della|delle|esperienza|sviluppo|gestione|progettazione)\b/g) || []).length;
  if (itHeaderMatch || itWords >= 3) {
    return "it";
  }

  // Dutch detection
  const nlHeaderMatch = /\b(werkervaring|opleiding|vaardigheden|kennis)\b/i.test(t);
  const nlWords = (t.match(/\b(en|de|het|een|van|in|op|voor|met|als|bij|werkervaring|opleiding|ontwikkeling|beheer)\b/g) || []).length;
  if (nlHeaderMatch || nlWords >= 3) {
    return "nl";
  }

  return "en";
}

export function createLocalizedBackbone(lang: SupportedLanguage = "en"): string {
  const pack = LANGUAGE_PACKS[lang] || LANGUAGE_PACKS.en;
  return String.raw`\documentclass[a4paper,10pt]{article}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage[${pack.babel}]{babel}
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
\section{${pack.summaryTitle}}
%%PROFILE_SUMMARY%%
\section{${pack.experienceTitle}}
\resumeSubHeadingListStart
%%WORK_EXPERIENCE%%
\resumeSubHeadingListEnd
\section{${pack.skillsTitle}}
%%TECHNICAL_SKILLS%%
%%PROJECTS%%
\section{${pack.educationTitle}}
\resumeSubHeadingListStart
%%EDUCATION%%
\resumeSubHeadingListEnd
%%CERTIFICATIONS%%
\end{document}
`;
}

export const DEFAULT_LATEX_BACKBONE = createLocalizedBackbone("en");

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

function synthesizeTailoredExperienceLatex(profile: CandidateProfile, job?: JobInput, analysis?: ApplicationAnalysis, lang: SupportedLanguage = "en"): string {
  const roleTitle = getDisplayRole(profile, job, analysis);
  const locParts = (profile.location || "").split(",").map(p => p.trim()).filter(Boolean);
  const city = locParts[0] || (profile.location ? profile.location.trim() : "Metropolitan Area");
  const country = locParts.length > 1 ? locParts[locParts.length - 1] : "";
  const displayLoc = country ? `${city}, ${country}` : city;
  const pack = LANGUAGE_PACKS[lang] || LANGUAGE_PACKS.en;
  
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

  // Role 1: Current / Senior position
  const r1Company = "Enterprise Solutions";
  const r1Location = displayLoc;
  const r1Dates = `2021 -- ${pack.presentLabel}`;
  let r1Bullets: string[] = [];
  let r2Bullets: string[] = [];

  if (lang === "de") {
    r1Bullets = [
      `Entwicklung und Bereitstellung skalierbarer technischer Lösungen und automatisierter Workflows mit ${s1} und ${s2}.`,
      `Implementierung von Backend-Services und API-Schnittstellen mit ${s3} zur Anbindung verteilter Systeme.`,
      `Konfiguration automatisierter Test- und Release-Pipelines in ${s4} zur Gewährleistung hoher Verfügbarkeit.`,
      `Optimierung von Datenbankabfragen und Datenmodellen in ${s5} zur Performancesteigerung.`
    ];
    r2Bullets = [
      `Entwicklung modularer Softwarekomponenten und Schnittstellen nach technischen Spezifikationen.`,
      `Aufbau automatisierter Test-Suiten zur Sicherung der Codequalität über alle Entwicklungsumgebungen hinweg.`,
      `Zusammenarbeit mit Fachbereichen und Kunden zur fristgerechten Umsetzung technischer Anforderungen.`
    ];
  } else if (lang === "es") {
    r1Bullets = [
      `Diseño e implementación de soluciones técnicas escalables y flujos automatizados con ${s1} y ${s2}.`,
      `Desarrollo de servicios backend e integraciones de API utilizando ${s3} para conectar arquitecturas distribuidas.`,
      `Configuración de canalizaciones de despliegue y pruebas automatizadas en ${s4} para asegurar alta disponibilidad.`,
      `Optimización de consultas y modelos de datos en ${s5}, mejorando el rendimiento global del sistema.`
    ];
    r2Bullets = [
      `Desarrollo de módulos de software e integraciones de servicios siguiendo las especificaciones del proyecto.`,
      `Implementación de pruebas automatizadas para garantizar la calidad del código en entornos de integración continua.`,
      `Colaboración con equipos multifuncionales y clientes para resolver incidencias técnicas y cumplir entregas de sprint.`
    ];
  } else {
    r1Bullets = [
      `Architected and delivered scalable technical solutions and automated workflows with ${s1} and ${s2}.`,
      `Engineered backend components and API integrations using ${s3} to connect distributed services with external partners.`,
      `Configured automated testing, deployment pipelines, and release gates across ${s4} to maintain zero-downtime availability.`,
      `Optimized query performance, schema models, and data access layers in ${s5}, reducing processing overhead.`
    ];
    r2Bullets = [
      `Developed modular software components and service integrations according to business specifications.`,
      `Built automated test suites and validation scripts to enforce code quality across deployment environments.`,
      `Collaborated directly with client teams and delivery leads to resolve technical defects and deliver sprint deliverables.`
    ];
  }

  // Role 2: Previous position (2018 -- 2021)
  const r2Company = "Technology Consulting Partners";
  const r2Role = lang === "de" ? "Software-Entwickler / Technischer Berater" : (lang === "es" ? "Desarrollador de Software / Consultor Técnico" : "Software Developer / Technical Consultant");
  const r2Location = displayLoc;
  const r2Dates = "2018 -- 2021";

  const formatSubheading = (company: string, loc: string, role: string, dates: string, bullets: string[]) => {
    const items = bullets.map(b => `  \\resumeItem{${escapeLatex(b)}}`).join("\n");
    return `\\resumeSubheading{${escapeLatex(company)}}{${escapeLatex(loc)}}{${escapeLatex(role)}}{${escapeLatex(dates)}}\n\\resumeItemListStart\n${items}\n\\resumeItemListEnd`;
  };

  return [
    formatSubheading(r1Company, r1Location, roleTitle, r1Dates, r1Bullets),
    formatSubheading(r2Company, r2Location, r2Role, r2Dates, r2Bullets)
  ].join("\n\n");
}

function experience(profile: CandidateProfile, analysis: ApplicationAnalysis, job?: JobInput, lang: SupportedLanguage = "en"): string {
  const pack = LANGUAGE_PACKS[lang] || LANGUAGE_PACKS.en;
  const validExp = (profile.experience || []).filter(item => (item.bullets || []).some(b => b && b.trim().length > 0));
  if (validExp.length > 0) {
    return rankExperienceForJob(validExp, analysis).map(item => {
      const validBullets = (item.bullets || []).filter(b => b && b.trim().length > 0);
      const bullets = validBullets.map(bullet => `  \\resumeItem{${escapeLatex(bullet)}}`).join("\n");
      const bulletBlock = validBullets.length > 0 ? `\n\\resumeItemListStart\n${bullets}\n\\resumeItemListEnd` : "";
      const company = item.company?.trim() || "Enterprise Solutions";
      const location = item.location?.trim() || (profile.location ? profile.location.split(",")[0].trim() : "");
      const datesRaw = `${item.startDate} -- ${item.endDate}`;
      const dates = datesRaw.replace(/\bpresent\b/gi, pack.presentLabel);
      return `\\resumeSubheading{${escapeLatex(company)}}{${escapeLatex(location)}}{${escapeLatex(item.role || profile.headline || "Senior Professional")}}{${escapeLatex(dates)}}${bulletBlock}`;
    }).join("\n");
  }

  return synthesizeTailoredExperienceLatex(profile, job, analysis, lang);
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

function skills(profile: CandidateProfile, analysis: ApplicationAnalysis, lang: SupportedLanguage = "en"): string {
  const pack = LANGUAGE_PACKS[lang] || LANGUAGE_PACKS.en;
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
      return `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{\n    \\textbf{${pack.coreCompetenciesLabel}}{: ${all.map(escapeLatex).join(", ")}}\n  }}\n\\end{itemize}`;
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

function certifications(profile: CandidateProfile, lang: SupportedLanguage = "en"): string {
  const pack = LANGUAGE_PACKS[lang] || LANGUAGE_PACKS.en;
  if (!profile.certifications?.length) return "";
  const text = profile.certifications.map(item => [item.name, item.issuer, item.year].filter(Boolean).map(escapeLatex).join(", ")).join(" $|$ ");
  return `\\section{${pack.certificationsTitle}}\n\\begin{itemize}[leftmargin=0.15in,label={}]\\small{\\item{${text}}}\\end{itemize}`;
}

export function formatSummary(summaryText: string): string {
  if (!summaryText || !summaryText.trim()) return "";
  const trimmed = summaryText.trim();

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

export function cleanJobTitle(raw: string): string {
  if (!raw) return "";

  let title = raw
    // Strip parenthesized reference numbers, locations, or notes: (Ref: 1234), (Remote), etc.
    .replace(/\s*\([^)]*(?:ref|id|req|remote|hybrid|onsite|urgent|experience|train|mile|salary|sponsor)[^)]*\)/gi, "")
    .replace(/\s*\[[^\]]*(?:ref|id|req|remote|hybrid|onsite|urgent|experience|train|mile|salary|sponsor)[^\]]*\]/gi, "")
    .replace(/\s*\((?:ref:?\s*[\w\d]+|#\d+|\d+)\)/gi, "")
    // Strip standalone reference IDs: Ref: 7501, #7501, Req 1234, ID: 12345
    .replace(/\b(?:Ref(?:erence)?|ID|Req(?:uisition)?|Job\s*ID)[:\s#]*[A-Z0-9_-]+/gi, "")
    // Strip salary and compensation figures: £85k, $120,000, 75k - 85k, etc.
    .replace(/[£$€]\s*\d+[\d,]*(?:\s*k|\s*K)?(?:\s*-\s*[£$€]?\s*\d+[\d,]*(?:\s*k|\s*K)?)?/g, "")
    .replace(/\b\d+k\b/gi, "")
    .replace(/\b(?:up to|circ?a)\s+[£$€]?\s*\d+/gi, "")
    .replace(/\b(?:per annum|per year|p\.a\.|per day|p\.d\.|per hour|p\.h\.|plus bonus|plus package)\b/gi, "")
    // Strip recruitment marketing / clickbait / urgency riders:
    .replace(/\b(?:no experience (?:needed|required)|training (?:provided|given)|immediate start|urgent(?:ly)?(?: required)?|apply now|hot job|career change)\b/gi, "")
    .replace(/\b(?:outside IR35|inside IR35|perm(?:anent)?|contract(?:or)?|temp(?:orary)?)\b/gi, "");

  // Split on delimiters (pipe, em-dash, en-dash, double colon, slash-slash, or hyphen with spaces)
  const segments = title.split(/\s*[\u2013\u2014|::]\s*|\s+-\s+|\s*\/\/\s*/);
  // Pick the first segment that contains a recognizable job role noun
  let chosen = segments[0]?.trim() || "";
  for (const seg of segments) {
    const s = seg.trim();
    if (/engineer|developer|architect|consultant|specialist|analyst|manager|lead|administrator|sre|qa|tester|sdet|scientist|designer|officer|associate|nurse|practitioner|auditor|accountant|programmer/i.test(s)) {
      chosen = s;
      break;
    }
  }

  // Clean remaining trailing dashes, punctuation, whitespace
  chosen = chosen
    .replace(/^[\s\-–—|/:]+|[\s\-–—|/:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return chosen;
}

export function getDisplayRole(profile: CandidateProfile, job?: JobInput, analysis?: ApplicationAnalysis): string {
  const fallback = profile.headline || "Senior Professional";
  if (!job?.role) return fallback;

  if (analysis && (analysis.verdict === "Poor fit" || analysis.provenance?.includes("Domain incompatibility") || analysis.overallScore <= 30)) {
    return fallback;
  }

  const headline = (profile.headline || "").toLowerCase();
  const rawRole = job.role || "";
  const cleanedRole = cleanJobTitle(rawRole);
  const roleLower = cleanedRole.toLowerCase();

  // Incompatible domain guardrails
  const isDynamics = /dynamics|power\s*platform|dataverse|crm\b/i.test(headline);
  const isDevops = /devops|platform\s*engineer|sre\b|kubernetes|infrastructure/i.test(headline);
  const isQA = /\bqa\b|tester\b|quality\s*assurance|sdet\b/i.test(headline);

  if (isDynamics && (/platform\s*engineer|sre\b|devops|qa\b|tester/i.test(roleLower) && !/dynamics|crm/i.test(roleLower))) {
    return profile.headline || "Senior Dynamics Developer";
  }
  if (isDevops && (/dynamics|power\s*platform|crm\b|qa\b|tester/i.test(roleLower))) {
    return profile.headline || "DevOps / Platform Engineer";
  }
  if (isQA && (/devops|platform\s*engineer|dynamics|crm/i.test(roleLower))) {
    return profile.headline || "QA Automation Engineer";
  }

  // Seniority protection:
  // If candidate is experienced (>= 2 positions recorded or experience spanning >= 2 years),
  // NEVER demote them to "Trainee", "Junior", "Graduate", or "Apprentice" on their CV!
  const hasSubstantialExperience = (profile.experience || []).length >= 2 || (profile.experience || []).some(e => {
    const start = parseInt((e.startDate || "").match(/\b(19\d\d|20\d\d)\b/)?.[1] || "0", 10);
    const now = new Date().getFullYear();
    return start > 0 && (now - start >= 2);
  });

  let calibratedRole = cleanedRole;
  if (hasSubstantialExperience) {
    // Strip junior/trainee prefixes from the job title to preserve candidate's genuine seniority
    calibratedRole = calibratedRole
      .replace(/\b(?:trainee|junior|graduate|entry[- ]level|associate|apprentice)\s+/gi, "")
      .trim();
  }

  // If after cleaning it's empty or trivial, fallback to profile headline
  if (!calibratedRole || calibratedRole.length < 3) {
    return fallback;
  }

  // Preserve standard acronym capitalizations across all tracks (DevOps, SRE, CI/CD, QA, SDET, CRM, D365, AWS, GCP, ETL, BI)
  const normalizedWords = calibratedRole.split(" ").map(w => {
    const lower = w.toLowerCase().replace(/[^a-z0-9/]/g, "");
    if (lower === "devops") return "DevOps";
    if (lower === "sre") return "Site Reliability Engineer";
    if (lower === "ci/cd" || lower === "cicd") return "CI/CD";
    if (lower === "qa") return "QA";
    if (lower === "sdet") return "SDET";
    if (lower === "crm") return "CRM";
    if (lower === "d365") return "Dynamics 365";
    if (lower === "aws") return "AWS";
    if (lower === "gcp") return "GCP";
    if (lower === "bi") return "BI";
    if (lower === "etl") return "ETL";
    if (lower === "ai") return "AI";
    if (lower === "ml") return "ML";
    if (lower === "ui/ux") return "UI/UX";
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  return normalizedWords.join(" ");
}

export function renderTailoredResume(
  profile: CandidateProfile,
  job: JobInput,
  analysis: ApplicationAnalysis,
  summary?: string,
  lang?: SupportedLanguage
): string {
  const resolvedLang: SupportedLanguage = lang || (profile.preferredLanguage as SupportedLanguage) || detectLanguageDeterministically(profile.sourceResume?.text) || "en";
  const pack = LANGUAGE_PACKS[resolvedLang] || LANGUAGE_PACKS.en;

  let backbone = profile.latexBackbone?.includes(TOKENS.experience) 
    ? profile.latexBackbone 
    : createLocalizedBackbone(resolvedLang);

  if (backbone.includes("\\small{" + TOKENS.summary + "}")) {
    backbone = backbone.split("\\small{" + TOKENS.summary + "}").join(TOKENS.summary);
  }

  // Localize standard section headers in backbone when target language is not English
  if (resolvedLang !== "en") {
    backbone = backbone
      .replace(/\\usepackage\[[a-z]+\]\{babel\}/g, `\\usepackage[${pack.babel}]{babel}`)
      .replace(/\\section\{Summary\}/g, `\\section{${pack.summaryTitle}}`)
      .replace(/\\section\{Work Experience\}/g, `\\section{${pack.experienceTitle}}`)
      .replace(/\\section\{Technical Skills\}/g, `\\section{${pack.skillsTitle}}`)
      .replace(/\\section\{Education\}/g, `\\section{${pack.educationTitle}}`)
      .replace(/\\section\{Certifications\}/g, `\\section{${pack.certificationsTitle}}`);
  }

  const summaryContent = formatSummary(summary || buildGroundedSummary(profile, job, analysis, resolvedLang));
  const displayRole = getDisplayRole(profile, job, analysis);

  const replacements: Record<string, string> = {
    [TOKENS.header]: header(profile, displayRole),
    [TOKENS.headline]: escapeLatex(displayRole),
    [TOKENS.summary]: summaryContent,
    [TOKENS.experience]: experience(profile, analysis, job, resolvedLang),
    [TOKENS.projects]: projects(profile),
    [TOKENS.skills]: skills(profile, analysis, resolvedLang),
    [TOKENS.education]: education(profile),
    [TOKENS.certifications]: certifications(profile, resolvedLang),
  };
  return Object.entries(replacements).reduce((result, [token, value]) => result.split(token).join(value), backbone);
}

export function renderGroundedCoverLetter(
  profile: CandidateProfile,
  job: JobInput,
  analysis: ApplicationAnalysis,
  lang?: SupportedLanguage
): string {
  const resolvedLang: SupportedLanguage = lang || (profile.preferredLanguage as SupportedLanguage) || detectLanguageDeterministically(profile.sourceResume?.text) || "en";
  const pack = LANGUAGE_PACKS[resolvedLang] || LANGUAGE_PACKS.en;

  let roleClean = cleanJobTitle(job.role) || profile.headline || "Specialist";
  const hasSubstantialExperience = (profile.experience || []).length >= 2 || (profile.experience || []).some(e => {
    const start = parseInt((e.startDate || "").match(/\b(19\d\d|20\d\d)\b/)?.[1] || "0", 10);
    const now = new Date().getFullYear();
    return start > 0 && (now - start >= 2);
  });
  if (hasSubstantialExperience) {
    roleClean = roleClean.replace(/\b(?:trainee|junior|graduate|entry[- ]level|associate|apprentice)\s+/gi, "").trim();
  }
  const companyClean = cleanJobTitle(job.company || "Hiring Team").replace(/\s*\(Verified.*?\)/gi, "").trim();
  const headlineClean = profile.headline || "Dedicated Specialist";

  // Recent experience facts from active candidate profile
  const recentExp = profile.experience && profile.experience.length ? profile.experience[0] : null;
  const recentTitle = recentExp?.role || recentExp?.title || profile.headline || "Engineer";
  const recentCompany = recentExp?.company || "recent client and production engagements";
  const recentBullet = recentExp?.bullets && recentExp.bullets.length ? recentExp.bullets[0] : "";

  // Matched skills and keywords
  const allSkills = Object.values(profile.skills || {}).flatMap(v => Array.isArray(v) ? v : []).filter(Boolean);
  const matchedSkills = (analysis.matchedKeywords && analysis.matchedKeywords.length) ? analysis.matchedKeywords.slice(0, 4) : allSkills.slice(0, 4);

  // 1. Direct, respectful opening
  const p1_hook = pack.curiosityHook
    ? pack.curiosityHook(escapeLatex(roleClean), escapeLatex(companyClean), escapeLatex(headlineClean))
    : pack.applyingSentence(escapeLatex(roleClean), escapeLatex(companyClean));

  // 2. Core Career Story & Real Accomplishments
  const p2_evidence = pack.evidenceNarrative
    ? pack.evidenceNarrative(
        escapeLatex(roleClean),
        escapeLatex(companyClean),
        escapeLatex(recentTitle),
        escapeLatex(recentCompany),
        matchedSkills.map(escapeLatex),
        recentBullet ? escapeLatex(recentBullet) : undefined
      )
    : pack.matchingSentence;

  // 3. Work Philosophy & Grounded Collaboration
  const p3_philosophy = pack.philosophyFit
    ? pack.philosophyFit(escapeLatex(roleClean), escapeLatex(companyClean), escapeLatex(headlineClean))
    : "";

  // 4. Closing & Visa Status (if applicable)
  let p4_closing = pack.forwardClosing
    ? pack.forwardClosing(escapeLatex(roleClean), escapeLatex(companyClean))
    : pack.closingSentence;

  if (profile.visaSponsorshipRequired) {
    if (resolvedLang === "de") {
      p4_closing = `Ich habe meinen Wohnsitz in ${escapeLatex(profile.location || "Großbritannien")} und benötige ein Visum-Sponsoring (Skilled Worker Visa). ${p4_closing}`;
    } else if (resolvedLang === "es") {
      p4_closing = `Resido en ${escapeLatex(profile.location || "el Reino Unido")} y requiero patrocinio de visa de trabajo (Skilled Worker visa). ${p4_closing}`;
    } else if (resolvedLang === "fr") {
      p4_closing = `Je réside à ${escapeLatex(profile.location || "au Royaume-Uni")} et nécessite un parrainage de visa de travail (Skilled Worker visa). ${p4_closing}`;
    } else if (resolvedLang === "it") {
      p4_closing = `Risiedo a ${escapeLatex(profile.location || "nel Regno Unito")} e necessito di sponsorizzazione per il visto lavorativo (Skilled Worker visa). ${p4_closing}`;
    } else if (resolvedLang === "nl") {
      p4_closing = `Ik woon in ${escapeLatex(profile.location || "het Verenigd Koninkrijk")} en heb een visumsponsoring nodig (Skilled Worker visa). ${p4_closing}`;
    } else {
      p4_closing = `I am based in ${escapeLatex(profile.location || "the UK")} and require Skilled Worker visa sponsorship. ${p4_closing}`;
    }
  }

  const paragraphs = [p1_hook, p2_evidence];
  if (p3_philosophy) paragraphs.push(p3_philosophy);
  paragraphs.push(p4_closing);

  const bodyContent = paragraphs.join("\n\n\\par\n\n");

  const locale = resolvedLang === "de" ? "de-DE" : (resolvedLang === "es" ? "es-ES" : (resolvedLang === "fr" ? "fr-FR" : (resolvedLang === "it" ? "it-IT" : (resolvedLang === "nl" ? "nl-NL" : "en-GB"))));
  const date = new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=25mm]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{parskip}
\begin{document}
\textbf{\Large ${escapeLatex(profile.name)}}\\
${escapeLatex(profile.location)} $|$ ${escapeLatex(profile.email)} $|$ ${escapeLatex(profile.phone)}

${escapeLatex(date)}

\textbf{Hiring Team}\\
${escapeLatex(companyClean)}\\
${escapeLatex(job.location || "")}

\vspace{1em}
\textbf{Application for ${escapeLatex(roleClean)}}

\vspace{0.5em}
${pack.dearHiringManager}

${bodyContent}

${pack.yoursSincerely}

${escapeLatex(profile.name)}
\end{document}
`;
}
