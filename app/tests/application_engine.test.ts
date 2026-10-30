import { describe, expect, test } from "bun:test";
import { analyzeApplication, analyzeTailoredResume, buildGroundedSummary, extractResumeEvidence, stripLatex } from "../application_engine";
import type { CandidateProfile } from "../profiles_manager";

const profile: CandidateProfile = {
  id: "sam", name: "Sam Lee", headline: "Platform Engineer", email: "sam@example.com", phone: "", location: "London", postcode: "", linkedin: "", github: "",
  visaSponsorshipRequired: true, targetRoles: ["Senior Platform Engineer"], targetLocations: ["London", "Remote"], preferredRadiusMiles: 30, minSalary: 0,
  skills: { cloud: ["AWS"], devops: ["Kubernetes", "Terraform", "GitHub Actions"], languages: ["Python"], tools: ["Prometheus"] },
  experience: [{ company: "Acme", role: "Platform Engineer", location: "London", startDate: "2022", endDate: "Present", bullets: ["Built AWS Kubernetes clusters with Terraform.", "Wrote GitHub Actions deployment pipelines and Prometheus alerts."] }],
  education: [], certifications: [], spokenLanguages: ["English"]
};

describe("application evidence scoring", () => {
  test("scores only supported requirements and exposes gaps", () => {
    const result = analyzeApplication(profile, { company: "Example", role: "Senior Platform Engineer", location: "London", fullJd: "We require AWS, Kubernetes, Terraform, Python and Datadog. You will collaborate with product teams and own CI/CD.", keySkills: [] });
    expect(result.matchedKeywords).toContain("AWS");
    expect(result.matchedKeywords).toContain("Kubernetes");
    expect(result.gapKeywords).toContain("Datadog");
    expect(result.requirements.find(item => item.requirement === "Datadog")?.evidence).toEqual([]);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.provenance).toContain("Deterministic");
  });

  test("fails a hard citizenship gate for a sponsorship-dependent candidate", () => {
    const result = analyzeApplication(profile, { company: "Secure", role: "Platform Engineer", location: "London", fullJd: "Applicants must be a UK citizen. AWS experience required." });
    expect(result.gates.eligibility.verdict).toBe("FAIL");
  });

  test("does not inflate score from location", () => {
    const base = { company: "Example", role: "Platform Engineer", fullJd: "AWS and Kubernetes required." };
    const local = analyzeApplication(profile, { ...base, location: "London" });
    const distant = analyzeApplication(profile, { ...base, location: "Bristol" });
    expect(local.overallScore).toBe(distant.overallScore);
    expect(local.gates.location.verdict).toBe("PASS");
    expect(distant.gates.location.verdict).toBe("FLAG");
  });

  test("does not match short aliases inside unrelated words or add generic summary claims", () => {
    const job = { company: "Orbit", role: "Platform Engineer", location: "London", fullJd: "Maintain reliable AWS infrastructure with Terraform." };
    const analysis = analyzeApplication(profile, job);
    expect(analysis.matchedKeywords).not.toContain("Machine Learning");
    const summary = buildGroundedSummary(profile, job, analysis);
    expect(summary).not.toMatch(/proven|scalable systems|best engineering practices/i);
  });

  test("strictly penalizes cross-domain role mismatches between Dynamics and DevOps", () => {
    const dynamicsProfile: CandidateProfile = {
      id: "manju", name: "Manjubhargavi", headline: "Senior Dynamics 365 CRM & Power Platform Developer",
      email: "manju@example.com", phone: "", location: "Middlesbrough, UK", postcode: "", linkedin: "", github: "",
      visaSponsorshipRequired: false, targetRoles: ["Senior Dynamics Developer", "Power Platform Developer"],
      targetLocations: ["Remote", "Middlesbrough, UK"], preferredRadiusMiles: 40, minSalary: 0,
      skills: {
        "Dynamics 365": ["Microsoft Dynamics 365", "Dataverse", "C# Plugins", "Workflows"],
        "Power Platform": ["Power Apps", "Power Automate", "Power BI"],
        "Development": [".NET", "C#", "JavaScript", "SQL Server"]
      },
      experience: [{
        company: "SeatPe", role: "Senior Dynamics Developer", location: "Middlesbrough, UK", startDate: "2024", endDate: "Present",
        bullets: ["Developed custom Power Apps and automated flows in Dataverse.", "Wrote C# plugins and REST integrations for Dynamics 365."]
      }],
      education: [], certifications: [], spokenLanguages: ["English"]
    };

    const devopsJob = {
      company: "Synextra",
      role: "Senior Platform Engineer (DevOps)",
      location: "Birchwood",
      fullJd: "Looking for a Senior Platform Engineer with Azure, CI/CD, Terraform, Kubernetes, and C# experience.",
      keySkills: ["Azure", "Kubernetes", "Terraform", "CI/CD"]
    };

    const dynamicsJob = {
      company: "Avanade",
      role: "Senior Dynamics 365 CE Developer",
      location: "Remote",
      fullJd: "Seeking a Senior Dynamics 365 CE Developer to build Dataverse solutions, Power Apps, and custom C# plugins.",
      keySkills: ["Dynamics 365", "Power Platform", "Dataverse", "C#"]
    };

    // Dynamics candidate on DevOps role must be heavily penalized
    const devopsAnalysis = analyzeApplication(dynamicsProfile, devopsJob);
    expect(devopsAnalysis.overallScore).toBeLessThanOrEqual(25);
    expect(devopsAnalysis.verdict).toBe("Poor fit");
    expect(devopsAnalysis.dimensions.career.score).toBe(0);
    expect(devopsAnalysis.dimensions.career.note).toContain("Incompatible domain");

    // Dynamics candidate on Dynamics role must be high fit
    const dynamicsAnalysis = analyzeApplication(dynamicsProfile, dynamicsJob);
    expect(dynamicsAnalysis.overallScore).toBeGreaterThanOrEqual(75);
    expect(dynamicsAnalysis.verdict).toBe("Strong fit");

    // DevOps candidate (profile) on Dynamics role must be heavily penalized
    const devopsOnDynamics = analyzeApplication(profile, dynamicsJob);
    expect(devopsOnDynamics.overallScore).toBeLessThanOrEqual(25);
    expect(devopsOnDynamics.verdict).toBe("Poor fit");
    expect(devopsOnDynamics.dimensions.career.score).toBe(0);
    expect(devopsOnDynamics.dimensions.career.note).toContain("Incompatible domain");
  });

  test("accurately curates and scores non-tech candidates (e.g. nurse, accountant) for their respective jobs", () => {
    const nurseProfile: CandidateProfile = {
      id: "sarah-nurse", name: "Sarah Connor", headline: "Registered General Nurse",
      email: "sarah@example.com", phone: "", location: "Manchester, UK", postcode: "M1", linkedin: "", github: "",
      visaSponsorshipRequired: false, targetRoles: ["Staff Nurse", "Senior Staff Nurse"],
      targetLocations: ["Manchester, UK"], preferredRadiusMiles: 25, minSalary: 0,
      skills: {
        "Clinical": ["Patient Care", "Acute Triage", "IV Cannulation", "Wound Management"],
        "Certifications": ["BLS", "ACLS"]
      },
      experience: [{
        company: "Manchester Royal Infirmary", role: "Staff Nurse", location: "Manchester, UK", startDate: "2018", endDate: "Present",
        bullets: ["Provided acute patient care in emergency triage and medical assessment unit.", "Administered IV cannulation and wound management according to NMC guidelines."]
      }],
      education: [], certifications: [], spokenLanguages: ["English"]
    };

    const nurseJob = {
      company: "NHS Trust",
      role: "Staff Nurse - Acute Medicine",
      location: "Manchester",
      fullJd: "We are recruiting a dedicated Staff Nurse. Must have valid NMC PIN. Key responsibilities include patient care, acute triage, IV cannulation, and wound management. BLS certification required.",
      keySkills: ["Patient Care", "Triage", "BLS"]
    };

    const accountingJob = {
      company: "Deloitte",
      role: "Senior Financial Auditor",
      location: "Manchester",
      fullJd: "Seeking a Senior Financial Auditor with IFRS, financial reporting, and statutory auditing experience.",
      keySkills: ["Auditing", "IFRS"]
    };

    // Nurse on Nurse job must be a strong fit
    const nurseAnalysis = analyzeApplication(nurseProfile, nurseJob);
    expect(nurseAnalysis.overallScore).toBeGreaterThanOrEqual(75);
    expect(nurseAnalysis.verdict).toBe("Strong fit");
    expect(nurseAnalysis.matchedKeywords).toContain("Patient Care");

    // Nurse on Accounting job must be poor fit / incompatible
    const nurseOnFinance = analyzeApplication(nurseProfile, accountingJob);
    expect(nurseOnFinance.overallScore).toBeLessThanOrEqual(30);
    expect(nurseOnFinance.verdict).toMatch(/Poor fit|Weak fit/);
  });

  test("analyzeTailoredResume calculates elevated dual ATS score for tailored resume while preserving domain boundaries", () => {
    const job = {
      company: "Do It",
      role: "Senior Platform Engineer",
      location: "London",
      fullJd: `We are seeking a Senior Platform Engineer to build and operate our multicloud platform across AWS and GCP.
Requirements:
- Deep experience with Kubernetes lifecycle management and cluster upgrades.
- Infrastructure as Code with Terraform.
- CI/CD automation pipelines using GitHub Actions.
- Observability and alerting with Prometheus and Grafana.
- Python scripting for platform automation.`,
      keySkills: ["AWS", "GCP", "Kubernetes", "Terraform", "GitHub Actions", "Prometheus", "Grafana", "Python"]
    };

    // Baseline un-tailored analysis
    const baseline = analyzeApplication(profile, job);
    expect(baseline.overallScore).toBeLessThan(75);

    // Mock rendered tailored LaTeX resume
    const mockTailoredLatex = `
\\begin{document}
\\Huge \\textbf{Sam Lee} \\\\
\\large Senior Platform Engineer \\\\
\\small sam@example.com $|$ London, UK

\\section{Professional Summary}
\\small{Senior Platform Engineer specializing in multicloud AWS and GCP infrastructure, Kubernetes cluster lifecycle management, Terraform infrastructure as code, and Prometheus monitoring.}

\\section{Work Experience}
\\resumeSubheading{Acme Cloud Systems}{London, UK}{Senior Platform Engineer}{2022 -- Present}
\\resumeItemListStart
  \\resumeItem{Architected and managed multi-region Kubernetes clusters on AWS and GCP using Terraform and Helm.}
  \\resumeItem{Engineered automated CI/CD deployment pipelines with GitHub Actions, reducing release cycle time.}
  \\resumeItem{Implemented Prometheus and Grafana observability stack with comprehensive alerting.}
  \\resumeItem{Automated platform infrastructure workflows and operational tasks using Python and Bash.}
\\resumeItemListEnd

\\section{Technical Skills}
\\begin{itemize}
  \\item{\\textbf{Cloud \\& Platforms}{: AWS, GCP, Kubernetes, Docker}}
  \\item{\\textbf{Infrastructure as Code}{: Terraform, Helm}}
  \\item{\\textbf{CI/CD \\& Observability}{: GitHub Actions, Prometheus, Grafana, Datadog}}
  \\item{\\textbf{Languages}{: Python, Bash}}
\\end{itemize}
\\end{document}
`;

    // Tailored resume analysis
    const tailored = analyzeTailoredResume(mockTailoredLatex, job, profile, baseline);
    expect(tailored.overallScore).toBeGreaterThanOrEqual(80);
    expect(tailored.overallScore).toBeGreaterThan(baseline.overallScore);
    expect(tailored.verdict).toBe("Strong fit");
    expect(tailored.provenance).toContain("Tailored ATS document analysis");
    expect(tailored.matchedKeywords).toContain("Kubernetes");
    expect(tailored.matchedKeywords).toContain("Terraform");
    expect(tailored.matchedKeywords).toContain("Prometheus");

    // Incompatible domain test: Nurse applying for Platform Engineer cannot exceed 25% even with tailored resume
    const nurseProfile: CandidateProfile = {
      id: "nurse-test",
      name: "Sarah Nurse",
      headline: "Registered Nurse",
      email: "sarah@example.com",
      phone: "",
      location: "London",
      postcode: "",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Registered Nurse"],
      targetLocations: ["London"],
      preferredRadiusMiles: 20,
      minSalary: 0,
      skills: { clinical: ["Patient Care", "Triage"] },
      experience: [{ company: "NHS", role: "Staff Nurse", location: "London", startDate: "2020", endDate: "Present", bullets: ["Provided patient triage."] }],
      education: [],
      certifications: [],
      spokenLanguages: ["English"]
    };
    const nurseBaseline = analyzeApplication(nurseProfile, job);
    const nurseTailored = analyzeTailoredResume(mockTailoredLatex, job, nurseProfile, nurseBaseline);
    expect(nurseTailored.overallScore).toBeLessThanOrEqual(25);
  });
});
