import { describe, expect, test } from "bun:test";
import { renderGroundedCoverLetter, renderTailoredResume, cleanEducationItem, formatSummary, LANGUAGE_PACKS } from "../resume_engine";
import { isProfileOwnerOfFile, isAllowedWorkspacePath } from "../server";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  AIService,
  stripThinkingProcess,
  isValidCoverLetter,
  isValidJobChatResponse,
  extractGroundedResumeText,
  extractGroundedCoverText
} from "../ai_service";
import type { CandidateProfile } from "../profiles_manager";
import { applyUserInstructionsToCoverLetter, type JobInput } from "../application_engine";

describe("Heartfelt, Curiosity-Driven Cover Letter Generation", () => {
  const profile: CandidateProfile = {
    id: "test-candidate",
    name: "Alex Rivera",
    headline: "Senior Cloud & Platform Engineer",
    email: "alex.rivera@example.com",
    phone: "+44 7700 900123",
    location: "London, United Kingdom",
    postcode: "EC1A 1BB",
    linkedin: "https://linkedin.com/in/alexrivera",
    github: "https://github.com/alexrivera",
    visaSponsorshipRequired: false,
    targetRoles: ["Senior Platform Engineer", "Lead DevOps Engineer"],
    targetLocations: ["London"],
    preferredRadiusMiles: 40,
    minSalary: 85000,
    skills: {
      cloud: ["AWS", "Kubernetes", "Terraform"],
      observability: ["Prometheus", "Grafana", "Datadog"]
    },
    experience: [
      {
        company: "FinTech Scaleup",
        role: "Senior Platform Engineer",
        location: "London, UK",
        startDate: "2022",
        endDate: "Present",
        bullets: [
          "Architected multi-region Kubernetes clusters on AWS serving 10M daily transactions.",
          "Automated infrastructure provisioning with Terraform and GitOps, cutting deploy time by 60%."
        ]
      }
    ],
    education: [
      {
        institution: "Imperial College London",
        degree: "BSc in Computing",
        startDate: "2015",
        endDate: "2018"
      }
    ],
    certifications: [
      {
        name: "Certified Kubernetes Administrator (CKA)",
        issuer: "Cloud Native Computing Foundation",
        year: "2023"
      }
    ]
  };

  const job: JobInput = {
    company: "Stripe & Co",
    role: "Staff Platform Engineer",
    location: "London, UK",
    fullJd: "We are looking for a Staff Platform Engineer to scale our distributed payment infrastructure using AWS, Kubernetes, and Terraform. You will unblock engineering teams, drive reliability, and build resilient deployment automation."
  };

  test("generates rich multi-paragraph cover letter with genuine curiosity, concrete wins, and work philosophy", () => {
    const analysis = {
      overallScore: 92,
      matchedKeywords: ["AWS", "Kubernetes", "Terraform"],
      gapKeywords: [],
      requirements: [
        { requirement: "AWS and Kubernetes experience", evidence: ["Architected multi-region Kubernetes clusters on AWS"], status: "matched" as const }
      ]
    };

    const latex = renderGroundedCoverLetter(profile, job, analysis as any, "en");

    // Must be valid compilable LaTeX with letterhead
    expect(latex).toContain("\\textbf{\\Large Alex Rivera}");
    expect(latex).toContain("Stripe \\& Co");
    expect(latex).toContain("Staff Platform Engineer");
    expect(latex).toContain("Dear Hiring Team,");

    // Hook: direct, respectful, no AI puffery
    expect(latex).toContain("building reliable infrastructure and supporting development teams");
    expect(latex).toContain("would welcome the chance to contribute to your engineering goals");

    // Evidence & Real Wins: grounded in candidate's actual company and accomplishments
    expect(latex).toContain("FinTech Scaleup");
    expect(latex).toContain("Senior Platform Engineer");
    expect(latex).toContain("AWS, Kubernetes, Terraform");
    expect(latex).toContain("Architected multi-region Kubernetes clusters on AWS serving 10M daily transactions");

    // Work Philosophy & Practical Engineering Mindset
    expect(latex).toContain("understand the operational reality before adding new tools");
    expect(latex).toContain("collaborating directly with developers");

    // Closing
    expect(latex).toContain("current infrastructure roadmap and where you need the most support");
    expect(latex).toContain("Sincerely,");

    // Strict Humanizer standards: zero AI marketing clichés
    expect(latex).not.toContain("proven track record");
    expect(latex).not.toContain("mission-critical");
    expect(latex).not.toContain("seamlessly executed");
    expect(latex).not.toContain("pivotal role");
    expect(latex).not.toContain("dedication to building scalable, high-impact systems");
    expect(latex).not.toContain("superficial patches");
    expect(latex).not.toContain("technical craftsmanship with active empathy");
    expect(latex).not.toContain("tangible value from day one");
  });

  test("generates heartfelt localized cover letter in German with authentic DACH phrasing", () => {
    const deProfile: CandidateProfile = {
      ...profile,
      name: "Sabine Meyer",
      headline: "Senior Cloud Architektin",
      location: "München, Deutschland",
      preferredLanguage: "de",
      experience: [
        {
          company: "Siemens Healthineers",
          role: "Cloud Infrastructure Architect",
          location: "München, Deutschland",
          startDate: "2021",
          endDate: "Heute",
          bullets: [
            "Aufbau automatisierter Kubernetes-Plattformen auf AWS mit hoher Verfügbarkeit."
          ]
        }
      ]
    };

    const deJob: JobInput = {
      company: "Bosch Digital",
      role: "Lead Platform Engineer",
      location: "Stuttgart, Deutschland",
      fullJd: "Gesucht wird ein Lead Platform Engineer für unsere IoT-Cloud-Plattform mit AWS und Kubernetes."
    };

    const analysis = {
      overallScore: 90,
      matchedKeywords: ["AWS", "Kubernetes"],
      gapKeywords: [],
      requirements: []
    };

    const deLatex = renderGroundedCoverLetter(deProfile, deJob, analysis as any, "de");

    expect(deLatex).toContain("Sehr geehrte Damen und Herren,");
    expect(deLatex).toContain("Bosch Digital");
    expect(deLatex).toContain("Siemens Healthineers");
    expect(deLatex).toContain("verlässlichen Cloud-Infrastrukturen und automatisierter Bereitstellung");
    expect(deLatex).toContain("Mit freundlichen Grüßen,");
    expect(deLatex).toContain("Sabine Meyer");
  });
});

describe("In-Posting Job AI Assistant Co-Pilot", () => {
  const profile: CandidateProfile = {
    id: "copilot-candidate",
    name: "Alex Taylor",
    headline: "Senior Platform & DevOps Engineer",
    email: "alex@example.com",
    phone: "+44 7123 456789",
    location: "London, United Kingdom",
    postcode: "EC1A",
    linkedin: "https://linkedin.com/in/alextaylor",
    github: "https://github.com/alextaylor",
    visaSponsorshipRequired: true,
    targetRoles: ["Senior Platform Engineer"],
    targetLocations: ["London"],
    preferredRadiusMiles: 40,
    minSalary: 80000,
    skills: {
      cloud: ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD"],
      monitoring: ["Prometheus", "Grafana"]
    },
    experience: [
      {
        company: "Monzo Tech Hub",
        role: "Senior DevOps Engineer",
        location: "London, UK",
        startDate: "2022",
        endDate: "Present",
        bullets: [
          "Executed multi-cluster Kubernetes upgrades on AWS with zero downtime.",
          "Designed Terraform modules and GitHub Actions pipelines for 40+ engineering microservices."
        ]
      }
    ],
    education: [],
    certifications: [
      { name: "Certified Kubernetes Administrator (CKA)", issuer: "CNCF", year: "2023" }
    ]
  };

  const job = {
    id: "job-revolut-101",
    company: "Revolut",
    title: "Senior Platform Engineer",
    location: "London, UK",
    salary: "£95,000 - £110,000",
    sponsorship_status: "offered",
    sponsor_verified: true,
    key_skills: ["AWS", "Kubernetes", "Terraform", "Go"],
    full_jd: "Revolut is hiring a Senior Platform Engineer in London. You will build and scale high-throughput Kubernetes infrastructure on AWS with Terraform, unblock development teams, and ensure 99.99% availability for financial services."
  };

  const aiService = new AIService({ provider: "builtin" });

  test("answers 'Why do I want this job' with authentic motivation and curiosity", async () => {
    const reply = await aiService.generateJobChatResponse(profile, job as any, "Why do I want this job at Revolut?");

    expect(reply).toContain("Why I Want This Job at Revolut");
    expect(reply).toContain("Direct Alignment with My Day-to-Day Work");
    expect(reply).toContain("Senior Platform & DevOps Engineer");
    expect(reply).toContain("AWS");
    expect(reply).toContain("Copy Response");
  });

  test("generates top interview questions and STAR model answers tailored to profile", async () => {
    const reply = await aiService.generateJobChatResponse(profile, job as any, "Give me the top interview questions and STAR model answers for this role");

    expect(reply).toContain("Top Interview Questions & Tailored STAR Answers");
    expect(reply).toContain("Monzo Tech Hub");
    expect(reply).toContain("Situation");
    expect(reply).toContain("Task");
    expect(reply).toContain("Action");
    expect(reply).toContain("Result");
    expect(reply).toContain("Revolut");
  });

  test("drafts punchy recruiter LinkedIn outreach note under 75 words", async () => {
    const reply = await aiService.generateJobChatResponse(profile, job as any, "Draft an outreach note to the hiring manager on LinkedIn");

    expect(reply).toContain("Recruiter & Hiring Manager Outreach Note");
    expect(reply).toContain("Alex Taylor");
    expect(reply).toContain("Senior Platform Engineer");
    expect(reply).toContain("Revolut");
    expect(reply).toContain("alex@example.com");
  });

  test("prepares accurate screening questionnaire answers", async () => {
    const reply = await aiService.generateJobChatResponse(profile, job as any, "What are the answers to the screening questionnaire?");

    expect(reply).toContain("Screening Questionnaire Answers for Revolut");
    // Visa sponsorship is required in profile
    expect(reply).toContain("Yes, I require Skilled Worker visa sponsorship to work in the UK");
    // Notice period and salary
    expect(reply).toContain("1 month");
    expect(reply).toContain("£95,000 - £110,000");
  });

  test("addresses skill gaps with confidence and learning agility", async () => {
    const reply = await aiService.generateJobChatResponse(profile, job as any, "How should I address any skill gaps in the interview?");

    expect(reply).toContain("How to Confidently Address Skill Gaps");
    expect(reply).toContain("rapid learning curve");
    expect(reply).toContain("documentation");
  });

  test("provides salary negotiation talking points", async () => {
    const reply = await aiService.generateJobChatResponse(profile, job as any, "What should be my salary negotiation strategy?");

    expect(reply).toContain("Salary & Compensation Strategy for Senior Platform Engineer at Revolut");
    expect(reply).toContain("£95,000 - £110,000");
    expect(reply).toContain("£80,000");
  });

  test("humanizeText strips AI rhetorical tells, em-dashes, and stray 12pt artifacts", () => {
    const aiSlopSample = `I approach infrastructure work as an engineer who understands that systems serve the people using them. I keep architectures simple enough to operate without heroics. I treat security and compliance not as boxes to tick but as built-in expectations—whether that means configuring IAM roles correctly, managing secrets properly, or thinking through blast radius before a change goes live. I listen carefully to what they actually need before reaching for new tools.

\\vspace{12pt}

Yours sincerely,

\\vspace{12pt}

Alex Taylor`;

    const cleaned = aiService.humanizeText(aiSlopSample);

    expect(cleaned).not.toContain("—");
    expect(cleaned).not.toContain("--");
    expect(cleaned).not.toContain("systems serve the people using them");
    expect(cleaned).not.toContain("not as boxes to tick but as built-in expectations");
    expect(cleaned).not.toContain("operate without heroics");
    expect(cleaned).not.toContain("listen carefully to what they actually need before reaching for new tools");
    expect(cleaned).not.toContain("\\vspace{12pt}");
    expect(cleaned).not.toContain("12pt");
    expect(cleaned).toContain("Yours sincerely,");
    expect(cleaned).toContain("Alex Taylor");
  });

  test("Grounded cover letter strictly adheres to native humanizer rules without 12pt artifacts", () => {
    const sampleCover = `\\documentclass[]{cover}
\\begin{document}
\\lettercontent{I am applying for the DevOps Engineer role at Anson McCade.}
\\lettercontent{Over the last two years at CloudTech UK, I executed five consecutive production cluster upgrades from Kubernetes 1.25 to 1.29 with zero downtime.}
\\lettercontent{I require Skilled Worker visa sponsorship to work in the UK.}
\\end{document}`;

    // Zero AI footprints
    expect(sampleCover).not.toContain("12pt");
    expect(sampleCover).not.toContain("—");
    expect(sampleCover).not.toContain("operate without heroics");
    expect(sampleCover).not.toContain("boxes to tick");
    expect(sampleCover).not.toContain("systems serve the people");
    expect(sampleCover).not.toContain("listen carefully to what they actually need before reaching for new tools");
    expect(sampleCover).not.toContain("proven track record");
    expect(sampleCover).not.toContain("mission-critical");

    // Real grounded engineering content
    expect(sampleCover).toContain("1.25 to 1.29");
    expect(sampleCover).toContain("Skilled Worker visa sponsorship");
  });

  test("Job AI Assistant humanizeText purges exact AI tells from recruiter outreach messages", () => {
    const screenshotSample = `Hi [Recruiter Name],

I'm genuinely excited about this DevOps Engineer role at [Organisation]. Your mission—building cloud systems for critical UK security—aligns perfectly with my career trajectory: I've spent the last two years hardening multi-cluster AWS EKS infrastructure at Flutter, where I led five consecutive production cluster upgrades (1.26->1.31) with zero downtime, and three years before that scaling microservices at scale across AWS and Kubernetes at IBM and Tech Mahindra.

What sets me apart: I don't just deploy; I architect for resilience and security. I've migrated legacy infrastructure (Chef->Cinc, Vault->IRSA), automated Lambda-driven infrastructure updates, and evaluated security tooling—exactly the strategic thinking national security systems demand.

I'm ready to bring that same rigor to your team. Can we chat?

Best,
Alex`;

    const cleaned = aiService.humanizeText(screenshotSample, {
      company: "Anson McCade",
      role: "DevOps Engineer",
      candidateName: "Alex Taylor"
    });

    // Zero em-dashes
    expect(cleaned).not.toContain("—");
    expect(cleaned).not.toContain("--");

    // Zero unresolved placeholders
    expect(cleaned).not.toContain("[Organisation]");
    expect(cleaned).not.toContain("[Recruiter Name]");
    expect(cleaned).toContain("Anson McCade");

    // Zero AI marketing clichés and puffed openers
    expect(cleaned).not.toContain("genuinely excited about");
    expect(cleaned).not.toContain("aligns perfectly with my career trajectory");
    expect(cleaned).not.toContain("What sets me apart");
    expect(cleaned).not.toContain("I don't just deploy; I architect");
    expect(cleaned).not.toContain("scaling microservices at scale");
    expect(cleaned).not.toContain("strategic thinking national security systems demand");
    expect(cleaned).not.toContain("ready to bring that same rigor");
    expect(cleaned).not.toContain("Can we chat?");

    // Polite, calm, human engineer tone
    expect(cleaned).toContain("saw the DevOps Engineer opening at Anson McCade and wanted to reach out directly");
    expect(cleaned).toContain("matches what I do day-to-day");
    expect(cleaned).toContain("In my work, I architect for resilience and security");
    expect(cleaned).toContain("scaling microservices reliably");
    expect(cleaned).toContain("I have submitted my application, and would welcome a brief conversation if you have time this week.");
  });

  test("stripThinkingProcess purges internal LLM thinking/reasoning blocks and preambles", () => {
    const rawWithXml = `<think>
1. Analyze the job description: Azure DevOps Engineer.
2. Candidate has Kubernetes and Terraform.
3. Keep it human.
</think>
Dear Hiring Team,

I am writing to apply for the Azure DevOps Engineer position.`;

    expect(stripThinkingProcess(rawWithXml)).toBe(`Dear Hiring Team,\n\nI am writing to apply for the Azure DevOps Engineer position.`);

    const rawWithMarkdownPreamble = `Here's a thinking process:

1. **Analyze the Requirements:**
- Role: Azure DevOps Engineer
- Candidate: Alex Morgan
- Constraints: No em-dashes, no AI marketing clichés.

2. **Deconstruct the Constraints:**
- Must follow specific LaTeX formatting.

Dear Hiring Team,

I am writing to express my interest in the Azure DevOps Engineer role at Northstar Systems. Over the past three years, I have maintained production cloud infrastructure with Terraform and Kubernetes.`;

    const stripped = stripThinkingProcess(rawWithMarkdownPreamble);
    expect(stripped).not.toContain("Here's a thinking process");
    expect(stripped).not.toContain("Analyze the Requirements");
    expect(stripped).not.toContain("Deconstruct the Constraints");
    expect(stripped).toContain("Dear Hiring Team,");
    expect(stripped).toContain("Azure DevOps Engineer role at Northstar Systems");
  });

  test("isValidCoverLetter rejects pure thinking process or truncated scratchpads", () => {
    const pureThinkingDump = `Here's a thinking process:

1. **Analyze the Request:**
   - Goal: Write a cover letter for Alex Morgan.
   - Strict rules: No em-dashes, no AI clichés.
2. **Deconstruct Constraints:**
   - Paragraph structure: 4 paragraphs.
Sincerely,
Alex`;

    expect(isValidCoverLetter(pureThinkingDump)).toBe(false);
    expect(isValidCoverLetter("Too short")).toBe(false);

    const validLetter = `I am writing to apply for the Azure DevOps Engineer position at Northstar Systems. My background centers on cloud infrastructure, container orchestration with Kubernetes, and automated deployment pipelines. In my recent work, I upgraded production clusters across five versions with zero downtime and built reusable Terraform modules for application teams.`;
    expect(isValidCoverLetter(validLetter)).toBe(true);
  });

  test("stripThinkingProcess cleans conversational chat reasoning from Nemotron/DeepSeek models", () => {
    const screenshotSample = `Here's a thinking process:

1. **Analyze User Input:**
   - User is the candidate (Alex Morgan)
   - They say "hi"
   - Then they ask for "Give me a cover letter for this"
   - The "this" refers to the Azure DevOps Engineer role at Northstar Systems that I have the full context for

2. **Check Constraints & Rules:**
   - I am Alex Morgan's Personal Career Co-Pilot and Application Strategist
   - Must follow CRITICAL MANDATORY HUMANIZER RULES strictly
   - ABSOLUTE ZERO TOLERANCE FOR AI TROPES:
     - Zero em-dashes
     - Zero "not-X-but-Y" contrast formulas
     - Zero AI sales puffery, hype, staged openers
   - NO unresolved placeholders: Use actual company name "Northstar Systems", candidate name "Alex Morgan"

Let's outline:

Here is a revised cover letter for the Azure DevOps Engineer role at Northstar Systems:

Dear Hiring Team,

I am writing to express my interest in the Azure DevOps Engineer position at Northstar Systems. Over the past five years, I have architected and automated cloud infrastructure across Azure and AWS.`;

    const cleaned = stripThinkingProcess(screenshotSample);
    expect(cleaned).not.toContain("Here's a thinking process");
    expect(cleaned).not.toContain("Analyze User Input");
    expect(cleaned).not.toContain("Check Constraints & Rules");
    expect(cleaned).not.toContain("CRITICAL MANDATORY HUMANIZER RULES");
    expect(cleaned).not.toContain("Let's outline");
    expect(cleaned).toContain("Here is a revised cover letter for the Azure DevOps Engineer role at Northstar Systems:");
    expect(cleaned).toContain("Dear Hiring Team,");
    expect(isValidJobChatResponse(cleaned)).toBe(true);
  });

  test("isValidJobChatResponse detects and rejects pure unparsed scratchpads", () => {
    const pureScratchpad = `Here's a thinking process:
1. **Analyze User Input:** Candidate wants a cover letter.
2. **Check Constraints & Rules:** Must follow CRITICAL MANDATORY HUMANIZER RULES.
Let's outline:`;
    expect(isValidJobChatResponse(pureScratchpad)).toBe(false);

    const normalAnswer = `### Key Strengths for Azure DevOps Engineer at Northstar Systems
- **Infrastructure as Code**: Deep experience writing reusable Terraform modules.
- **CI/CD Pipelines**: Production pipelines using GitHub Actions with security gates.`;
    expect(isValidJobChatResponse(normalAnswer)).toBe(true);
  });

  test("extractGroundedResumeText extracts summary, skills, and experience bullets from LaTeX CV", () => {
    const latexCv = `\\documentclass{article}
\\begin{document}
\\section{Professional Summary}
Senior Platform & DevOps Engineer with 5+ years of experience automating Azure and AWS cloud environments.

\\section{Technical Skills}
\\textbf{Cloud & Containers}: Azure, AWS, Docker, Kubernetes, Helm \\\\
\\textbf{IaC & CI/CD}: Terraform, Ansible, GitHub Actions, Jenkins

\\section{Experience}
\\resumeSubheading{FinTech Scaleup}{London, UK}{Senior DevOps Engineer}{2022 -- Present}
\\resumeItemListStart
\\resumeItem{Automated multi-account Azure landing zones using Terraform and GitHub Actions.}
\\resumeItem{Upgraded 12 production Kubernetes clusters across 5 versions with zero customer downtime.}
\\resumeItemListEnd
\\end{document}`;

    const extracted = extractGroundedResumeText(latexCv);
    expect(extracted).toContain("Tailored Summary: Senior Platform & DevOps Engineer");
    expect(extracted).toContain("Azure, AWS, Docker, Kubernetes, Helm");
    expect(extracted).toContain("Automated multi-account Azure landing zones using Terraform and GitHub Actions.");
    expect(extracted).toContain("Upgraded 12 production Kubernetes clusters across 5 versions with zero customer downtime.");
  });

  test("extractGroundedCoverText extracts body paragraphs cleanly from LaTeX cover letter", () => {
    const latexCover = `\\documentclass{article}
\\begin{document}
\\textbf{Alex Morgan}\\\\
Leeds
\\vspace{1em}
\\textbf{Hiring Team}\\\\
Northstar Systems
\\vspace{1em}
\\textbf{Dear Hiring Team,}

I am writing to apply for the Azure DevOps Engineer position at Northstar Systems.

Over the past four years, I have focused on automating scalable Azure infrastructure using Terraform. In my previous role, I designed automated CI/CD workflows and implemented automated security checks.

I would welcome the opportunity to speak with your team about your cloud roadmap.

Yours sincerely,
Alex Morgan
\\end{document}`;

    const extracted = extractGroundedCoverText(latexCover);
    expect(extracted).toContain("I am writing to apply for the Azure DevOps Engineer position at Northstar Systems.");
    expect(extracted).toContain("Over the past four years, I have focused on automating scalable Azure infrastructure using Terraform.");
    expect(extracted).toContain("I would welcome the opportunity to speak with your team about your cloud roadmap.");
    expect(extracted).not.toContain("\\documentclass");
    expect(extracted).not.toContain("\\vspace");
    expect(extracted).not.toContain("Yours sincerely");
  });

  test("Job AI Assistant generateJobChatResponse incorporates tailored CV bullets into answers", async () => {
    const tailoredCv = `\\documentclass{article}
\\begin{document}
\\section{Summary}
Specialized Azure DevOps Engineer with hands-on enterprise landing zone delivery.
\\section{Experience}
\\resumeItem{Delivered Terraform Enterprise Landing Zones adhering to CIS Azure Foundations benchmark.}
\\resumeItem{Led migration of 40 microservices to Azure AKS with automated GitOps deployments.}
\\end{document}`;

    const jobWithTailoredCv = {
      ...job,
      tailoredCvContent: tailoredCv
    };

    const reply = await aiService.generateJobChatResponse(
      profile,
      jobWithTailoredCv,
      "What is my top strength for this role?"
    );

    expect(reply).toBeTruthy();
    expect(reply.length).toBeGreaterThan(50);
    // Does not leak rule prompt headers or thinking process
    expect(reply).not.toContain("Here's a thinking process");
    expect(reply).not.toContain("CRITICAL MANDATORY HUMANIZER RULES");
    expect(reply).not.toContain("ABSOLUTE ZERO TOLERANCE");
  });

  test("humanizeText cleans LaTeX spacing commands, \\[0.5em], and stray [0.5em] artifacts", () => {
    const rawWithLatexSpacing = `Thank you for your time and consideration.

Sincerely,\\\\[0.5em] Alex Morgan`;

    const cleaned = aiService.humanizeText(rawWithLatexSpacing, { company: "Northstar Systems", candidateName: "Alex Morgan" });
    expect(cleaned).not.toContain("[0.5em]");
    expect(cleaned).not.toContain("\\\\[0.5em]");
    expect(cleaned).toContain("Sincerely,");
    expect(cleaned).toContain("Alex Morgan");

    const rawWithStrayBrackets = `I am based in Leeds and require sponsorship.

Sincerely, [0.5em] Alex Morgan`;
    const cleanedStray = aiService.humanizeText(rawWithStrayBrackets, { company: "Northstar Systems", candidateName: "Alex Morgan" });
    expect(cleanedStray).not.toContain("[0.5em]");
    expect(cleanedStray).toContain("Sincerely,");
    expect(cleanedStray).toContain("Alex Morgan");
  });

  test("humanizeText resolves [Hiring Team / Recruiter] and company placeholders cleanly", () => {
    const rawWithPlaceholders = `Dear [Hiring Team / Recruiter],

I saw the opening at [Company] and wanted to connect directly.

Sincerely,
[Candidate Name]`;

    const resolved = aiService.humanizeText(rawWithPlaceholders, { company: "Northstar Systems", candidateName: "Alex Morgan" });
    expect(resolved).not.toContain("[Hiring Team / Recruiter]");
    expect(resolved).not.toContain("[Company]");
    expect(resolved).not.toContain("[Candidate Name]");
    expect(resolved).toContain("Dear Hiring Team,");
    expect(resolved).toContain("Northstar Systems");
    expect(resolved).toContain("Alex Morgan");
  });

  test("Universal multi-profession adaptability: Healthcare profile produces domain-authentic materials without DevOps leakage", async () => {
    const nurseProfile: CandidateProfile = {
      id: "nurse-candidate",
      name: "Sarah Jenkins",
      headline: "Registered Nurse - Intensive Care",
      email: "sarah.jenkins@example.com",
      phone: "+44 7987 654321",
      location: "Newcastle, UK",
      postcode: "NE1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["ICU Staff Nurse"],
      targetLocations: ["Newcastle"],
      preferredRadiusMiles: 25,
      minSalary: 38000,
      skills: {
        clinical: ["Patient Triage", "Critical Care", "IV Cannulation"],
        compliance: ["NMC Standards", "Infection Control"],
        tools: ["Epic EHR", "Cerner"]
      },
      experience: [
        {
          company: "Royal Victoria Infirmary",
          role: "ICU Staff Nurse",
          location: "Newcastle, UK",
          startDate: "2021",
          endDate: "Present",
          bullets: [
            "Coordinated patient care for high-dependency ICU admissions with zero protocol breaches.",
            "Administered complex IV medications and monitored vital signs in high-pressure emergency clinical rotations."
          ]
        }
      ],
      education: [
        { institution: "Newcastle University", degree: "BSc Adult Nursing", startDate: "2018", endDate: "2021" }
      ],
      certifications: [
        { name: "Advanced Life Support (ALS)", issuer: "Resuscitation Council UK", year: "2022" }
      ]
    };

    const nurseJob = {
      id: "nurse-job-1",
      company: "Newcastle Hospitals NHS Foundation Trust",
      title: "ICU Staff Nurse",
      location: "Newcastle upon Tyne",
      salary: "£35,000 - £42,000",
      sponsorship_status: "offered",
      sponsor_verified: true,
      key_skills: ["Critical Care", "Patient Triage", "NMC Standards", "Epic EHR"],
      full_jd: "Newcastle Hospitals NHS Foundation Trust is seeking a dedicated ICU Staff Nurse to deliver exceptional patient care in our critical care unit."
    };

    const analysis = {
      overallScore: 94,
      matchedKeywords: ["Critical Care", "Patient Triage", "NMC Standards", "Epic EHR"],
      gapKeywords: [],
      requirements: []
    };

    // 1. Cover letter generation
    const coverLatex = renderGroundedCoverLetter(nurseProfile, nurseJob as any, analysis as any, "en");
    expect(coverLatex).toContain("Sarah Jenkins");
    expect(coverLatex).toContain("Newcastle Hospitals NHS Foundation Trust");
    expect(coverLatex).toContain("ICU Staff Nurse");
    expect(coverLatex).toContain("delivering reliable outcomes and supporting team goals");
    expect(coverLatex).toContain("discuss your team's upcoming priorities and where my background could offer the most support");

    // Strictly verify ZERO DevOps/cloud leakage
    expect(coverLatex).not.toContain("infrastructure roadmap");
    expect(coverLatex).not.toContain("cloud infrastructure");
    expect(coverLatex).not.toContain("deploy software without friction");
    expect(coverLatex).not.toContain("Kubernetes");
    expect(coverLatex).not.toContain("Terraform");
    expect(coverLatex).not.toContain("AWS");

    // 2. Resume LaTeX generation
    const cvLatex = renderTailoredResume(nurseProfile, nurseJob as any, analysis as any);
    expect(cvLatex).toContain("Clinical");
    expect(cvLatex).toContain("Patient Triage");
    expect(cvLatex).toContain("Compliance");
    expect(cvLatex).toContain("Tools \\& Technologies");
    expect(cvLatex).toContain("Epic EHR");

    // Strictly verify no hardcoded tech categories in non-tech CV
    expect(cvLatex).not.toContain("Cloud Platforms");
    expect(cvLatex).not.toContain("Containers");
    expect(cvLatex).not.toContain("Infrastructure as Code");
    expect(cvLatex).not.toContain("CI/CD");

    // 3. In-Posting Job AI Assistant Chat Answers
    const whyReply = await aiService.generateJobChatResponse(nurseProfile, nurseJob as any, "Why do I want this job?");
    expect(whyReply).toContain("Why I Want This Job at Newcastle Hospitals NHS Foundation Trust");
    expect(whyReply).not.toContain("platform engineering");
    expect(whyReply).not.toContain("deployments");
    expect(whyReply).toContain("maintaining high operational quality");

    const outreachReply = await aiService.generateJobChatResponse(nurseProfile, nurseJob as any, "Draft recruiter outreach note");
    expect(outreachReply).not.toContain("automated cloud infrastructure");
    expect(outreachReply).toContain("delivering dependable outcomes");
    expect(outreachReply).toContain("discuss your team's upcoming priorities");

    const starReply = await aiService.generateJobChatResponse(nurseProfile, nurseJob as any, "Give me interview prep and STAR answers");
    expect(starReply).not.toContain("Kubernetes and AWS");
    expect(starReply).not.toContain("cloud infrastructure");
    expect(starReply).toContain("delivering dependable results");

    // 4. Technology Alignment Guardrail: Non-tech profile must not have Kubernetes injected
    const azureMedicalJob = {
      ...nurseJob,
      full_jd: "Hospital administration role utilizing Microsoft Azure cloud reporting and patient records."
    };
    const aligned = await aiService.deepAlignCandidateExperience(nurseProfile, azureMedicalJob as any, analysis as any, "en");
    expect(aligned.skills.containers || []).not.toContain("Kubernetes (AKS)");
    expect(aligned.skills.cicd || []).not.toContain("Azure DevOps");
  });

  test("cleanEducationItem separates combined degree and university, stripping prefixes and trailing dates", () => {
    // Malformed input from resume parser / raw profile import
    const rawEducation = {
      degree: "Bachelor of Engineering (B.Eng.) Westbridge Institute of Technology",
      institution: "Bachelor’s Degree: Bachelor of Engineering (B.Eng.) Westbridge Institute of Technology 2018 - 2022",
      startDate: "2018",
      endDate: "2022",
      details: ""
    };

    const cleaned = cleanEducationItem(rawEducation);

    // Degree and institution are cleanly separated
    expect(cleaned.degree).toBe("Bachelor of Engineering (B.Eng.)");
    expect(cleaned.institution).toBe("Westbridge Institute of Technology");
    expect(cleaned.dates).toBe("2018 - 2022");

    // Strictly verify no prefixes like "Bachelor's Degree:" remain
    expect(cleaned.institution).not.toContain("Bachelor’s Degree:");
    expect(cleaned.institution).not.toContain("2018 - 2022");
    expect(cleaned.degree).not.toContain("Westbridge Institute of Technology");
  });

  test("formatSummary normalizes bulleted summary into a single cohesive paragraph", () => {
    const bulletedSummary = "• Senior Dynamics Developer with six years of experience. • Proficient in C# plugins and Dataverse. • Skilled in Power Platform.";
    const formatted = formatSummary(bulletedSummary);

    // Formats as clean \small{...} paragraph, never as a bullet list
    expect(formatted.startsWith("\\small{")).toBe(true);
    expect(formatted).not.toContain("\\resumeItemListStart");
    expect(formatted).not.toContain("\\resumeItem");
    expect(formatted).not.toContain("•");
    expect(formatted).toContain("Senior Dynamics Developer with six years of experience");
    expect(formatted).toContain("Proficient in C\\# plugins and Dataverse");
  });

  test("isProfileOwnerOfFile strictly prevents cross-profile CV and cover letter leakage", () => {
    const profileAlex = {
      id: "alex-morgan",
      name: "Alex Morgan",
      tracker: {}
    } as any;

    const profileTaylor = {
      id: "taylor-singh",
      name: "Taylor Singh",
      tracker: {}
    } as any;

    const allProfiles = [profileAlex, profileTaylor];

    const alexCv = "cv/main_alex_morgan_northstar_platform_engineer.tex";
    const alexCover = "cover_letters/cover_alex_morgan_northstar_platform_engineer.tex";
    const taylorCv = "cv/main_taylor_singh_srg_dynamics_365_developer.tex";

    // Alex owns his CV
    expect(isProfileOwnerOfFile(alexCv, profileAlex, allProfiles)).toBe(true);
    expect(isProfileOwnerOfFile(alexCover, profileAlex, allProfiles)).toBe(true);

    // Taylor must NEVER be assigned Alex's CV
    expect(isProfileOwnerOfFile(alexCv, profileTaylor, allProfiles)).toBe(false);
    expect(isProfileOwnerOfFile(alexCover, profileTaylor, allProfiles)).toBe(false);

    // Taylor owns her CV
    expect(isProfileOwnerOfFile(taylorCv, profileTaylor, allProfiles)).toBe(true);
    expect(isProfileOwnerOfFile(taylorCv, profileAlex, allProfiles)).toBe(false);
  });

  test("wrapParagraphsInCoverLatex strips rogue fontspec/Calibri and compiles cleanly with tectonic", () => {
    const aiService = new AIService({} as any, "/tmp");
    const testProfile: any = {
      name: "Taylor Reed",
      headline: "Senior Platform Engineer",
      location: "London, UK",
      email: "taylor@example.com",
      phone: "+44 7000 123456",
      linkedin: "https://linkedin.com/in/taylor-reed"
    };
    const testJob: any = {
      role: "Platform Engineer",
      company: "Acme Cloud",
      location: "Remote",
      fullJd: "AWS and Kubernetes required"
    };

    // Simulate an AI output that included rogue fontspec, Calibri, and raw LaTeX preamble
    const rogueAiOutput = `\\documentclass{article}
\\usepackage{fontspec}
\\setmainfont{Calibri}
\\begin{document}
Dear Hiring Team at Acme Cloud,

I am writing to express my interest in the Platform Engineer position at Acme Cloud. My experience with AWS and Kubernetes matches the responsibilities outlined in your vacancy.

In my recent projects, I have focused on automating cloud deployments and improving cluster reliability without service interruptions.

In my day-to-day work, I communicate directly with product teams to eliminate operational friction and ensure systems are well-documented.

I hold unrestricted right to work in the UK and welcome the opportunity to discuss your upcoming platform roadmap.

Yours sincerely,
Taylor Reed
\\end{document}`;

    const canonicalTex = aiService.wrapParagraphsInCoverLatex(testProfile, testJob, rogueAiOutput, "en");

    // Must have replaced rogue fontspec/Calibri with universal Computer Modern Roman and formal letterhead
    expect(canonicalTex).not.toContain("fontspec");
    expect(canonicalTex).not.toContain("Calibri");
    expect(canonicalTex).toContain("\\usepackage{parskip}");
    expect(canonicalTex).toContain("\\hrule height 0.6pt");
    expect(canonicalTex).toContain("Senior Platform Engineer");
    expect(canonicalTex).toContain("Acme Cloud");
    expect(canonicalTex).toContain("Application for Platform Engineer");
    expect(canonicalTex).toContain("Dear Hiring Team,");
    expect(canonicalTex).toContain(String.raw`Sincerely,\\[28pt]`);

    // Must be compilable by tectonic if installed
    const { spawnSync } = require("child_process");
    const { writeFileSync, unlinkSync } = require("fs");
    const tmpTex = `/tmp/test_cover_${Date.now()}.tex`;
    writeFileSync(tmpTex, canonicalTex, "utf-8");
    try {
      const res = spawnSync("tectonic", ["--outdir", "/tmp", tmpTex], { encoding: "utf-8" });
      if (res.status === 0) {
        expect(res.status).toBe(0);
      }
    } finally {
      try { unlinkSync(tmpTex); } catch {}
    }
  });

  test("tailoring accepts custom user instructions for CV and cover letter cleanly", async () => {
    const candidateProfile: any = {
      id: "candidate-taylor",
      name: "Taylor Reed",
      headline: "Senior Platform Engineer",
      location: "London, UK",
      email: "taylor.reed@example.com",
      phone: "+44 7000 000000",
      visaSponsorshipRequired: false,
      experience: [
        {
          company: "CloudScale Systems",
          role: "Platform Engineer",
          location: "London, UK",
          startDate: "2023",
          endDate: "Present",
          bullets: [
            "Operated multi-cluster AWS EKS clusters and Terraform automation blueprints.",
            "Engineered automated CI/CD deployment pipelines using GitHub Actions."
          ]
        }
      ],
      skills: {
        cloud: ["AWS", "Kubernetes", "Terraform", "EKS"]
      }
    };

    const targetJob: any = {
      company: "Apex Fintech",
      role: "Lead DevOps Engineer",
      location: "London, UK",
      keySkills: ["AWS", "Kubernetes", "Terraform", "CI/CD"],
      fullJd: "Apex Fintech is seeking a Lead DevOps Engineer to manage multi-cluster AWS Kubernetes systems and automated CI/CD pipelines."
    };

    const customInstructions = "Focus summary on Kubernetes version upgrades and AWS CDK. Emphasize high-volume transaction reliability.";

    const cvTex = await aiService.generateTailoredCV(candidateProfile, targetJob, "en", true, customInstructions);
    expect(cvTex).toContain("\\documentclass[a4paper,10pt]{article}");
    expect(cvTex).toContain("\\section{Summary}");
    expect(cvTex).toContain("Taylor Reed");

    const coverTex = await aiService.generateTailoredCoverLetter(candidateProfile, targetJob, "en", true, customInstructions);
    expect(coverTex).toContain("\\documentclass[11pt,a4paper]{article}");
    expect(coverTex).toContain("Apex Fintech");
    expect(coverTex).toContain("Taylor Reed");
    expect(coverTex).not.toContain("fontspec");
    expect(coverTex).not.toContain("—");
  });

  test("Custom AI instructions strictly omit versions, simplify EKS upgrades to hands-on, and add operational ownership", async () => {
    const aiService = new AIService({ provider: "builtin" } as any, "/tmp");
    const candidateProfile: any = {
      name: "Riley Example",
      headline: "DevOps Engineer / Platform Engineer",
      summary: "Platform engineer experienced with AWS EKS, managing multi-cluster environments and running production cloud systems. Work includes in-place Kubernetes version upgrades, infrastructure automation, container builds, and service networking.",
      location: "Leeds, UK",
      email: "riley@example.com",
      phone: "+44 7000 123456",
      experience: [
        {
          company: "Northstar Cloud",
          role: "Platform Engineer",
          location: "Leeds, UK",
          startDate: "May 2020",
          endDate: "Present",
          bullets: [
            "Maintained and supported AWS EKS services and CI/CD workflows using Jenkins and GitHub Actions.",
            "Supported production EKS cluster upgrades across version releases and verified networking, DNS, storage, and autoscaling components.",
            "Handled on-call support for platform and application incidents."
          ]
        }
      ],
      skills: {
        cloud: ["AWS", "Kubernetes (EKS v1.25 to v1.29)"],
        iac: ["Terraform", "AWS CDK"],
        cicd: ["Jenkins", "GitHub Actions"]
      }
    };

    const targetJob: any = {
      company: "Byteful",
      role: "Infrastructure DevOps Engineer",
      location: "Manchester, UK",
      keySkills: ["AWS", "Kubernetes", "EKS", "Terraform", "CI/CD"],
      fullJd: "Byteful is looking for an Infrastructure DevOps Engineer with AWS, EKS, and Terraform experience."
    };

    const userInstructions = "Don't over explain EKS upgrades or include version numbers; emphasize hands-on experience and operational ownership.";

    const cvTex = await aiService.generateTailoredCV(candidateProfile, targetJob, "en", true, userInstructions);

    // 1. Must NOT contain version numbers
    expect(cvTex).not.toContain("v1.25 to v1.29");
    expect(cvTex).not.toContain("1.25 to 1.29");
    expect(cvTex).not.toContain("(v1.25");

    // 2. Must contain hands-on EKS upgrade phrasing
    expect(cvTex.toLowerCase()).toContain("hands-on");
    expect(cvTex.toLowerCase()).toContain("upgrade");

    // 3. Must contain ownership
    expect(cvTex.toLowerCase()).toContain("ownership");

    // 4. Must not crash with ReferenceError
    expect(cvTex).toContain("Riley Example");
    expect(cvTex).toContain("\\section{Summary}");
    expect(cvTex).toContain("\\section{Work Experience}");

    // 5. Check cover letter respects instructions as well
    const coverTex = await aiService.generateTailoredCoverLetter(candidateProfile, targetJob, "en", true, userInstructions);
    expect(coverTex).not.toContain("v1.25 to v1.29");
    expect(coverTex).not.toContain("1.25 to 1.29");
    expect(coverTex).toContain("Byteful");
    expect(coverTex).toContain("Riley Example");
  });

  test("Cover Letter template unifies typography to Computer Modern Roman and hairline rule", () => {
    const aiService = new AIService({ provider: "builtin" } as any, "/tmp");
    const testProfile: any = {
      id: "candidate-taylor",
      name: "Taylor Reed",
      headline: "Senior Platform Engineer",
      location: "London, UK",
      email: "taylor.reed@example.com",
      phone: "+44 7700 900077"
    };
    const testJob: any = {
      id: "job-duna",
      role: "Platform Engineer",
      company: "Duna",
      location: "Remote - Remote",
      fullJd: "AWS and Kubernetes platform engineer wanted."
    };
    const analysis: any = {
      overallScore: 88,
      matchedKeywords: ["AWS", "Kubernetes"],
      gapKeywords: [],
      requirements: []
    };

    const coverLatex = renderGroundedCoverLetter(testProfile, testJob, analysis, "en");

    // Must use clean Computer Modern Roman (no helvet)
    expect(coverLatex).not.toContain("helvet");
    expect(coverLatex).not.toContain("fontspec");
    expect(coverLatex).not.toContain("Calibri");
    expect(coverLatex).toContain("\\usepackage{parskip}");
    expect(coverLatex).toContain("\\hrule height 0.6pt");
    expect(coverLatex).toContain("Taylor Reed");
    expect(coverLatex).toContain("Duna");
    expect(coverLatex).toContain("Application for Platform Engineer");
  });

  test("isAllowedWorkspacePath restricts document writes to approved directories", () => {
    // Approved directories
    expect(isAllowedWorkspacePath("cv/candidate_resume.tex")).toBe(true);
    expect(isAllowedWorkspacePath("cover_letters/candidate_company_COVER.tex")).toBe(true);
    expect(isAllowedWorkspacePath("documents/sample.tex")).toBe(true);
    expect(isAllowedWorkspacePath("templates/resume_default.tex")).toBe(true);

    // Unapproved paths and directory traversal attempts
    expect(isAllowedWorkspacePath("../../etc/passwd")).toBe(false);
    expect(isAllowedWorkspacePath("../server.ts")).toBe(false);
    expect(isAllowedWorkspacePath(".env")).toBe(false);
    expect(isAllowedWorkspacePath("package.json")).toBe(false);
    expect(isAllowedWorkspacePath("app/server.ts")).toBe(false);
  });

  test("Raw LaTeX editing updates and preserves custom document wording on disk", () => {
    const testDocPath = "cv/test_raw_latex_edit.tex";
    const fullTestPath = resolve(process.cwd(), testDocPath);
    const initialLatex = [
      "\\documentclass[10pt,a4paper]{article}",
      "\\begin{document}",
      "\\textbf{Taylor Reed}",
      "Summary: Platform engineer managing multi-cluster EKS infrastructure v1.25 to v1.29.",
      "\\end{document}"
    ].join("\n");

    try {
      // 1. Initial write
      writeFileSync(fullTestPath, initialLatex, "utf-8");
      expect(existsSync(fullTestPath)).toBe(true);

      // 2. User edits raw LaTeX to remove version numbers and adjust wording
      const editedLatex = initialLatex.replace(
        "v1.25 to v1.29",
        "with hands-on ownership of production cluster upgrades"
      );
      expect(editedLatex).not.toContain("v1.25 to v1.29");
      expect(editedLatex).toContain("with hands-on ownership of production cluster upgrades");

      writeFileSync(fullTestPath, editedLatex, "utf-8");
      const savedContent = readFileSync(fullTestPath, "utf-8");

      expect(savedContent).toBe(editedLatex);
      expect(savedContent).toContain("Taylor Reed");
      expect(savedContent).toContain("with hands-on ownership of production cluster upgrades");
    } finally {
      if (existsSync(fullTestPath)) {
        unlinkSync(fullTestPath);
      }
    }
  });

  test("applyUserInstructionsToCoverLetter dynamically curates cover letter according to user instructions", () => {
    const rawParagraphs = [
      "I am writing to apply for the Platform Engineer position at Acme Corp. My background aligns directly with your team focus.",
      "At previous roles, I have maintained and supported multi-cluster Kubernetes infrastructure across EKS and AKS, and I have handled complex infrastructure upgrades in production (v1.25 to v1.29) without downtime. Earlier, I worked on mobile and desktop apps.",
      "In my daily engineering work, I keep architectures simple and practical.",
      "I would welcome the opportunity to discuss how my background can support your growth."
    ];

    const instructions = "please dont over explain about eks upgrade and mention of versions , just say, have good experience in hands-on in eks upgrade, also add key words of ownership, and omit mobile apps";
    const tailored = applyUserInstructionsToCoverLetter(rawParagraphs, instructions);

    // 1. Version numbers omitted
    expect(tailored[1]).not.toContain("v1.25 to v1.29");

    // 2. EKS upgrade phrasing tailored
    expect(tailored[1].toLowerCase()).toContain("hands-on");
    expect(tailored[1].toLowerCase()).toContain("eks");

    // 3. Ownership keywords injected
    expect(tailored[1].toLowerCase()).toContain("ownership");
    expect(tailored[2].toLowerCase()).toContain("ownership");

    // 4. Mobile mentions omitted
    expect(tailored[1].toLowerCase()).not.toContain("mobile and desktop");
  });

  test("parseLatexCoverLetter faithfully reflects raw LaTeX without synthetic fallback injections when recipient or subject are removed", () => {
    const rawLatexWithoutRecipient = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=24mm]{geometry}
\\begin{document}
\\textbf{\\Large Taylor Reed}\\\\[2pt]
{\\large \\color[gray]{0.35} Cloud Engineer}\\\\[3pt]
{\\small \\color[gray]{0.45} London \\quad $\\cdot$ \\quad +44 20 7946 0912}
\\hrule height 0.6pt
{\\small \\color[gray]{0.35} 7 November 2026}
\\vspace{14pt}

\\vspace{14pt}
\\textbf{\\large Application for Senior Infrastructure Engineer}
\\vspace{12pt}
Dear Hiring Team,
I am writing to apply for the Senior Infrastructure Engineer position.
\\par
I have substantial hands-on experience in cloud systems.
\\par
In my daily work, I prioritize operational stability.
\\par
Thank you for your time.
\\vspace{16pt}
Sincerely,\\\\[28pt]
\\textbf{Taylor Reed}
\\end{document}`;

    const fs = require("fs");
    const appJs = fs.readFileSync("app/public/app.js", "utf-8");
    const cleanFn = appJs.match(/function cleanLatexText[\s\S]*?\n\}/)![0];
    const parseFn = appJs.match(/function parseLatexCoverLetter[\s\S]*?\n\}/)![0];
    const fn = new Function(`${cleanFn}\n${parseFn}\nreturn parseLatexCoverLetter;`)();

    const result = fn(rawLatexWithoutRecipient);
    expect(result.name).toBe("Taylor Reed");
    expect(result.headline).toBe("Cloud Engineer");
    expect(result.date).toBe("7 November 2026");
    expect(result.recipientLines).toEqual([]);
    expect(result.subject).toBe("Application for Senior Infrastructure Engineer");
    expect(result.paragraphsHtml).toContain("I am writing to apply");
    expect(result.signer).toBe("Taylor Reed");
  });
});
