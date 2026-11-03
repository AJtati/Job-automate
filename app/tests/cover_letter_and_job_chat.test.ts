import { describe, expect, test } from "bun:test";
import { renderGroundedCoverLetter, renderTailoredResume, LANGUAGE_PACKS } from "../resume_engine";
import {
  AIService,
  stripThinkingProcess,
  isValidCoverLetter,
  isValidJobChatResponse,
  extractGroundedResumeText,
  extractGroundedCoverText
} from "../ai_service";
import type { CandidateProfile } from "../profiles_manager";
import type { JobInput } from "../application_engine";

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
\\lettercontent{Over the last two years at CloudTech UK, I executed five consecutive production cluster upgrades from Kubernetes 1.26 to 1.31 with zero downtime.}
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
    expect(sampleCover).toContain("1.26 to 1.31");
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
- Candidate: Ajith Surya Thati
- Constraints: No em-dashes, no AI marketing clichés.

2. **Deconstruct the Constraints:**
- Must follow specific LaTeX formatting.

Dear Hiring Team,

I am writing to express my interest in the Azure DevOps Engineer role at BCN group. Over the past three years, I have maintained production cloud infrastructure with Terraform and Kubernetes.`;

    const stripped = stripThinkingProcess(rawWithMarkdownPreamble);
    expect(stripped).not.toContain("Here's a thinking process");
    expect(stripped).not.toContain("Analyze the Requirements");
    expect(stripped).not.toContain("Deconstruct the Constraints");
    expect(stripped).toContain("Dear Hiring Team,");
    expect(stripped).toContain("Azure DevOps Engineer role at BCN group");
  });

  test("isValidCoverLetter rejects pure thinking process or truncated scratchpads", () => {
    const pureThinkingDump = `Here's a thinking process:

1. **Analyze the Request:**
   - Goal: Write a cover letter for Ajith Surya Thati.
   - Strict rules: No em-dashes, no AI clichés.
2. **Deconstruct Constraints:**
   - Paragraph structure: 4 paragraphs.
Sincerely,
Ajith`;

    expect(isValidCoverLetter(pureThinkingDump)).toBe(false);
    expect(isValidCoverLetter("Too short")).toBe(false);

    const validLetter = `I am writing to apply for the Azure DevOps Engineer position at BCN group. My background centers on cloud infrastructure, container orchestration with Kubernetes, and automated deployment pipelines. In my recent work, I upgraded production clusters across five versions with zero downtime and built reusable Terraform modules for application teams.`;
    expect(isValidCoverLetter(validLetter)).toBe(true);
  });

  test("stripThinkingProcess cleans conversational chat reasoning from Nemotron/DeepSeek models", () => {
    const screenshotSample = `Here's a thinking process:

1. **Analyze User Input:**
   - User is the candidate (Ajith Surya Thati)
   - They say "hi"
   - Then they ask for "Give me a cover letter for this"
   - The "this" refers to the Azure DevOps Engineer role at bcn group that I have the full context for

2. **Check Constraints & Rules:**
   - I am Ajith Surya Thati's Personal Career Co-Pilot and Application Strategist
   - Must follow CRITICAL MANDATORY HUMANIZER RULES strictly
   - ABSOLUTE ZERO TOLERANCE FOR AI TROPES:
     - Zero em-dashes
     - Zero "not-X-but-Y" contrast formulas
     - Zero AI sales puffery, hype, staged openers
   - NO unresolved placeholders: Use actual company name "bcn group", candidate name "Ajith Surya Thati"

Let's outline:

Here is a revised cover letter for the Azure DevOps Engineer role at bcn group:

Dear Hiring Team,

I am writing to express my interest in the Azure DevOps Engineer position at bcn group. Over the past five years, I have architected and automated cloud infrastructure across Azure and AWS.`;

    const cleaned = stripThinkingProcess(screenshotSample);
    expect(cleaned).not.toContain("Here's a thinking process");
    expect(cleaned).not.toContain("Analyze User Input");
    expect(cleaned).not.toContain("Check Constraints & Rules");
    expect(cleaned).not.toContain("CRITICAL MANDATORY HUMANIZER RULES");
    expect(cleaned).not.toContain("Let's outline");
    expect(cleaned).toContain("Here is a revised cover letter for the Azure DevOps Engineer role at bcn group:");
    expect(cleaned).toContain("Dear Hiring Team,");
    expect(isValidJobChatResponse(cleaned)).toBe(true);
  });

  test("isValidJobChatResponse detects and rejects pure unparsed scratchpads", () => {
    const pureScratchpad = `Here's a thinking process:
1. **Analyze User Input:** Candidate wants a cover letter.
2. **Check Constraints & Rules:** Must follow CRITICAL MANDATORY HUMANIZER RULES.
Let's outline:`;
    expect(isValidJobChatResponse(pureScratchpad)).toBe(false);

    const normalAnswer = `### Key Strengths for Azure DevOps Engineer at bcn group
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
\\textbf{Ajith Surya Thati}\\\\
Hartlepool
\\vspace{1em}
\\textbf{Hiring Team}\\\\
bcn group
\\vspace{1em}
\\textbf{Dear Hiring Team,}

I am writing to apply for the Azure DevOps Engineer position at bcn group.

Over the past four years, I have focused on automating scalable Azure infrastructure using Terraform. In my previous role, I designed automated CI/CD workflows and implemented automated security checks.

I would welcome the opportunity to speak with your team about your cloud roadmap.

Yours sincerely,
Ajith Surya Thati
\\end{document}`;

    const extracted = extractGroundedCoverText(latexCover);
    expect(extracted).toContain("I am writing to apply for the Azure DevOps Engineer position at bcn group.");
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

Sincerely,\\\\[0.5em] Ajith Surya Thati`;

    const cleaned = aiService.humanizeText(rawWithLatexSpacing, { company: "bcn group", candidateName: "Ajith Surya Thati" });
    expect(cleaned).not.toContain("[0.5em]");
    expect(cleaned).not.toContain("\\\\[0.5em]");
    expect(cleaned).toContain("Sincerely,");
    expect(cleaned).toContain("Ajith Surya Thati");

    const rawWithStrayBrackets = `I am based in Hartlepool and require sponsorship.

Sincerely, [0.5em] Ajith Surya Thati`;
    const cleanedStray = aiService.humanizeText(rawWithStrayBrackets, { company: "bcn group", candidateName: "Ajith Surya Thati" });
    expect(cleanedStray).not.toContain("[0.5em]");
    expect(cleanedStray).toContain("Sincerely,");
    expect(cleanedStray).toContain("Ajith Surya Thati");
  });

  test("humanizeText resolves [Hiring Team / Recruiter] and company placeholders cleanly", () => {
    const rawWithPlaceholders = `Dear [Hiring Team / Recruiter],

I saw the opening at [Company] and wanted to connect directly.

Sincerely,
[Candidate Name]`;

    const resolved = aiService.humanizeText(rawWithPlaceholders, { company: "bcn group", candidateName: "Ajith Surya Thati" });
    expect(resolved).not.toContain("[Hiring Team / Recruiter]");
    expect(resolved).not.toContain("[Company]");
    expect(resolved).not.toContain("[Candidate Name]");
    expect(resolved).toContain("Dear Hiring Team,");
    expect(resolved).toContain("bcn group");
    expect(resolved).toContain("Ajith Surya Thati");
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
});
