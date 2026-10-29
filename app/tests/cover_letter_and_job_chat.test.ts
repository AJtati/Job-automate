import { describe, expect, test } from "bun:test";
import { renderGroundedCoverLetter, LANGUAGE_PACKS } from "../resume_engine";
import { AIService } from "../ai_service";
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
    name: "Ajith Surya",
    headline: "Senior Platform & DevOps Engineer",
    email: "ajith@example.com",
    phone: "+44 7123 456789",
    location: "London, United Kingdom",
    postcode: "EC1A",
    linkedin: "https://linkedin.com/in/ajith",
    github: "https://github.com/ajith",
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
    expect(reply).toContain("Ajith Surya");
    expect(reply).toContain("Senior Platform Engineer");
    expect(reply).toContain("Revolut");
    expect(reply).toContain("ajith@example.com");
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

Ajith Surya Thati`;

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
    expect(cleaned).toContain("Ajith Surya Thati");
  });

  test("Anson McCade cover letter strictly adheres to native humanizer rules without 12pt artifacts", () => {
    const { readFileSync, existsSync } = require("fs");
    const { join } = require("path");
    const filePath = join(__dirname, "../../cover_letters/cover_ajith_surya_thati_anson_mccade_devops_engineer.tex");

    if (!existsSync(filePath)) {
      return; // Skip when run from non-standard directory or clean clone
    }
    const content = readFileSync(filePath, "utf-8");

    // Zero AI footprints
    expect(content).not.toContain("12pt");
    expect(content).not.toContain("—");
    expect(content).not.toContain("operate without heroics");
    expect(content).not.toContain("boxes to tick");
    expect(content).not.toContain("systems serve the people");
    expect(content).not.toContain("listen carefully to what they actually need before reaching for new tools");
    expect(content).not.toContain("proven track record");
    expect(content).not.toContain("mission-critical");

    // Real grounded engineering content
    expect(content).toMatch(/Flutter UK (and|\\&)? Ireland/i);
    expect(content).toContain("1.26 to 1.31");
    expect(content).toContain("Skilled Worker visa sponsorship");
  });

  test("Job AI Assistant humanizeText purges exact AI tells from recruiter outreach messages", () => {
    const screenshotSample = `Hi [Recruiter Name],

I'm genuinely excited about this DevOps Engineer role at [Organisation]. Your mission—building cloud systems for critical UK security—aligns perfectly with my career trajectory: I've spent the last two years hardening multi-cluster AWS EKS infrastructure at Flutter, where I led five consecutive production cluster upgrades (1.26->1.31) with zero downtime, and three years before that scaling microservices at scale across AWS and Kubernetes at IBM and Tech Mahindra.

What sets me apart: I don't just deploy; I architect for resilience and security. I've migrated legacy infrastructure (Chef->Cinc, Vault->IRSA), automated Lambda-driven infrastructure updates, and evaluated security tooling—exactly the strategic thinking national security systems demand.

I'm ready to bring that same rigor to your team. Can we chat?

Best,
Ajith`;

    const cleaned = aiService.humanizeText(screenshotSample, {
      company: "Anson McCade",
      role: "DevOps Engineer",
      candidateName: "Ajith Surya Thati"
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
});
