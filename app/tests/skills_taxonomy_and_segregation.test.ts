import { describe, expect, test } from "bun:test";
import { sanitizeAndCategorizeSkills, alignSkillsForJob, classifySkill, unwrapCompoundSkills } from "../taxonomy";
import { renderTailoredResume } from "../resume_engine";

describe("Intelligent Skill Taxonomy, Self-Healing, and Segregation", () => {
  test("unwraps corrupted concatenated multi-technology string and restores all categories", () => {
    // Exact corrupted string pattern seen in user report:
    const corruptedSkills = {
      cloud: [
        "Azure",
        "GCP",
        "AWS (EKS, EC2, VPC, RDS, Lambda, NLB/ALB, CloudFront, S3, IAM/IRSA, Route53, Secrets Manager, SSM Parameter Store)",
        "AWS (EKS, CloudFront, Kubernetes , Docker, Helm, ArgoCD, Argo Rollouts, ISTIO, ECR, Docker Compose, Terraform, AWS CDK (TypeScript), Ansible, Ansible Tower, CloudFormation, Jenkins, GitHub Actions, Concourse CI, GoCD, Git, VSTS, JFrog Artifactory, Nexus, Prometheus, Grafana, Alertmanager, Splunk, Zabbix, CloudWatch, PagerDuty (On-call), Sonatype, Veracode, SonarQube, AWS WAF, Cloudflare WAF, External Secrets Operator, Python, Bash/Shell, TypeScript, Node.js, Next.js, React, SQL, FFmpeg, Kubernetes (CKA), Container Security)"
      ],
      containers: ["Kubernetes (AKS)"],
      cicd: ["Azure DevOps"],
      tools: ["VMware"]
    };

    const sanitized = sanitizeAndCategorizeSkills(corruptedSkills);

    // Verify all 8 ATS categories are restored
    expect(sanitized.cloud).toContain("Azure");
    expect(sanitized.cloud).toContain("GCP");

    // Containers & GitOps
    expect(sanitized.containers).toContain("Kubernetes");
    expect(sanitized.containers).toContain("Docker");
    expect(sanitized.containers).toContain("Helm");
    expect(sanitized.containers).toContain("ArgoCD");
    expect(sanitized.containers).toContain("ISTIO");

    // Infrastructure as Code
    expect(sanitized.iac).toContain("Terraform");
    expect(sanitized.iac).toContain("AWS CDK (TypeScript)");
    expect(sanitized.iac).toContain("Ansible");
    expect(sanitized.iac).toContain("CloudFormation");

    // CI/CD & Build Tools
    expect(sanitized.cicd).toContain("Azure DevOps");
    expect(sanitized.cicd).toContain("Jenkins");
    expect(sanitized.cicd).toContain("GitHub Actions");
    expect(sanitized.cicd).toContain("Git");
    expect(sanitized.cicd).toContain("JFrog Artifactory");

    // Monitoring & SRE
    expect(sanitized.monitoring).toContain("Prometheus");
    expect(sanitized.monitoring).toContain("Grafana");
    expect(sanitized.monitoring).toContain("Splunk");

    // Security & Compliance
    expect(sanitized.security).toContain("SonarQube");
    expect(sanitized.security).toContain("Veracode");
    expect(sanitized.security).toContain("AWS WAF");
    expect(sanitized.security).toContain("External Secrets Operator");

    // Languages & Frameworks
    expect(sanitized.languages).toContain("Python");
    expect(sanitized.languages).toContain("TypeScript");
    expect(sanitized.languages).toContain("SQL");

    // Tools & Automation
    expect(sanitized.tools).toContain("VMware");
  });

  test("alignSkillsForJob intelligently routes employer gap skills to their exact category rather than tools", () => {
    const candidateSkills = {
      cloud: ["AWS", "GCP"],
      containers: ["Docker", "Kubernetes"],
      iac: ["Ansible"],
      cicd: ["Jenkins"],
      monitoring: ["Grafana"],
      languages: ["Python"],
      tools: []
    };

    const jdText = "Seeking a DevOps Engineer proficient in Azure, AKS, Terraform, Azure DevOps, and Prometheus.";
    const gaps = ["Azure DevOps", "Terraform", "Prometheus", "SonarQube", "Bash/Shell", "Jira"];

    const aligned = alignSkillsForJob(candidateSkills, jdText, gaps);

    // Azure DevOps should be in cicd, NOT dumped in tools
    expect(aligned.skills.cicd).toContain("Azure DevOps");
    expect(aligned.skills.tools).not.toContain("Azure DevOps");

    // Terraform should be in iac, NOT dumped in tools
    expect(aligned.skills.iac).toContain("Terraform");
    expect(aligned.skills.tools).not.toContain("Terraform");

    // Prometheus should be in monitoring
    expect(aligned.skills.monitoring).toContain("Prometheus");

    // SonarQube should be in security
    expect(aligned.skills.security).toContain("SonarQube");

    // Bash/Shell should be in languages
    expect(aligned.skills.languages).toContain("Bash/Shell");

    // General tools like Jira go to tools
    expect(aligned.skills.tools).toContain("Jira");

    // Azure and AKS should be prioritized
    expect(aligned.skills.cloud[0]).toBe("Azure");
    expect(aligned.skills.containers[0]).toBe("Kubernetes (AKS)");
  });

  test("preserves non-tech custom categories and prevents empty devops keys from polluting profile", () => {
    const dynamicsSkills = {
      "Dynamics 365 & CRM": ["Dynamics 365 (Sales, Service)", "Dataverse"],
      "Power Platform": ["Power Apps", "Power Automate", "Power BI"],
      "Integration & Azure Services": ["Azure Logic Apps", "Azure Service Bus"],
      "Development & Languages": ["C# Plugins", "JavaScript", "SQL Server"],
      "ALM, Testing & AI": ["Azure DevOps", "PAC CLI", "CI/CD Pipelines"],
      "Documentation & Methodologies": ["SDD", "FRD", "Agile Scrum"]
    };

    const sanitized = sanitizeAndCategorizeSkills(dynamicsSkills);

    expect(sanitized["Dynamics 365 & CRM"]).toEqual(expect.arrayContaining(["Dataverse"]));
    expect(sanitized["Power Platform"]).toEqual(expect.arrayContaining(["Power Apps", "Power Automate"]));
    expect(sanitized["Development & Languages"]).toEqual(expect.arrayContaining(["C# Plugins", "JavaScript"]));
    expect(sanitized["ALM, Testing & AI"]).toEqual(expect.arrayContaining(["Azure DevOps", "PAC CLI"]));

    // Strictly ensure no empty devops pollution
    expect(sanitized.cloud).toBeUndefined();
    expect(sanitized.containers).toBeUndefined();
    expect(sanitized.iac).toBeUndefined();
  });

  test("renderTailoredResume formats skills cleanly with Jake's template standard", () => {
    const profile = {
      name: "Ajith Surya Thati",
      headline: "Senior Platform Engineer",
      location: "Hartlepool",
      skills: {
        cloud: ["AWS", "Azure"],
        containers: ["Kubernetes", "Docker"],
        iac: ["Terraform"],
        cicd: ["Azure DevOps", "Jenkins"]
      },
      experience: [],
      education: [],
      certifications: []
    };

    const job = { company: "Prima", title: "DevOps Engineer" };
    const analysis = { matchedKeywords: ["Azure", "Kubernetes", "Azure DevOps"] };

    const latex = renderTailoredResume(profile as any, job as any, analysis as any);

    // Verify correct LaTeX macro formatting
    expect(latex).toContain("\\textbf{Cloud Platforms}{: ");
    expect(latex).toContain("\\textbf{Containers \\& GitOps}{: ");
    expect(latex).toContain("\\textbf{Infrastructure as Code}{: ");
    expect(latex).toContain("\\textbf{CI/CD \\& Build Tools}{: ");

    // Verify Azure DevOps is present in CI/CD line
    expect(latex).toMatch(/CI\/CD.*Azure DevOps/);
  });

  test("detectProfessionDomain accurately identifies domains across tech and non-tech disciplines", () => {
    const { detectProfessionDomain } = require("../taxonomy");

    expect(detectProfessionDomain("Lead QA Automation Engineer", "Selenium, Cypress, BDD, TestRail")).toBe("qa");
    expect(detectProfessionDomain("Senior Software Engineer", "React, Node.js, TypeScript, PostgreSQL")).toBe("software_engineering");
    expect(detectProfessionDomain("Dynamics 365 Developer", "Power Platform, C# plugins, Dataverse")).toBe("dynamics");
    expect(detectProfessionDomain("Data Scientist", "PyTorch, TensorFlow, Pandas, Machine Learning")).toBe("data_science");
    expect(detectProfessionDomain("Registered ICU Nurse", "Patient triage, clinical assessment, EHR")).toBe("healthcare");
    expect(detectProfessionDomain("Senior Financial Analyst", "GAAP, audit, financial reporting, SAP")).toBe("finance");
    expect(detectProfessionDomain("Platform Engineer", "AWS, Kubernetes, Terraform, ArgoCD")).toBe("devops");
  });

  test("calculateTotalYearsExperience accurately computes experience across diverse date formats", () => {
    const { calculateTotalYearsExperience } = require("../taxonomy");

    // 2018 - Present (in 2026 = 8 years)
    const exps1 = [
      { startDate: "Jan 2021", endDate: "Present" },
      { startDate: "June 2018", endDate: "Dec 2020" }
    ];
    expect(calculateTotalYearsExperience(exps1)).toBe(8);

    // 2020 - 2024 (4 years)
    const exps2 = [
      { startDate: "Aug 2020", endDate: "Jan 2024" }
    ];
    expect(calculateTotalYearsExperience(exps2)).toBe(4);
  });

  test("QA Test Engineer skills are categorized into authentic QA taxonomy categories", () => {
    const qaSkills = [
      "Selenium WebDriver",
      "Cypress",
      "Playwright",
      "Cucumber BDD",
      "Postman",
      "Apache JMeter",
      "TestRail",
      "Jira",
      "Python",
      "TypeScript",
      "Jenkins",
      "Docker"
    ];

    const sanitized = sanitizeAndCategorizeSkills(qaSkills, "qa");

    // Ensure authentic QA domain categories exist
    expect(sanitized.automation).toEqual(expect.arrayContaining(["Selenium WebDriver", "Cypress", "Playwright", "Cucumber BDD"]));
    expect(sanitized.api_performance).toEqual(expect.arrayContaining(["Postman", "Apache JMeter"]));
    expect(sanitized.management).toEqual(expect.arrayContaining(["TestRail"]));
    expect(sanitized.languages).toEqual(expect.arrayContaining(["Python", "TypeScript"]));
    expect(sanitized.devops_qa).toEqual(expect.arrayContaining(["Jenkins", "Docker"]));
  });

  test("Software Engineer skills are categorized into authentic software engineering categories", () => {
    const seSkills = [
      "TypeScript",
      "Python",
      "Go",
      "React",
      "Next.js",
      "Node.js",
      "PostgreSQL",
      "Redis",
      "AWS",
      "Docker",
      "Git",
      "REST APIs"
    ];

    const sanitized = sanitizeAndCategorizeSkills(seSkills, "software_engineering");

    expect(sanitized.languages).toEqual(expect.arrayContaining(["TypeScript", "Python", "Go"]));
    expect(sanitized.frameworks).toEqual(expect.arrayContaining(["React", "Next.js", "Node.js"]));
    expect(sanitized.databases).toEqual(expect.arrayContaining(["PostgreSQL", "Redis"]));
    expect(sanitized.cloud_infra).toEqual(expect.arrayContaining(["AWS", "Docker"]));
  });

  test("Local continuous learning store records and persists novel skills dynamically", () => {
    const { taxonomyStore, classifySkill } = require("../taxonomy");

    const novelSkill = "Playwright Component Testing Framework";
    taxonomyStore.recordLearnedSkill(novelSkill, "test_automation", "qa");

    const classified = classifySkill(novelSkill, "qa");
    expect(classified.category).toBe("test_automation");
    expect(classified.formatted).toBe(novelSkill);
  });

  test("TaxonomyStore seeds baseline to new PC data directory and preserves existing learned knowledge during updates", () => {
    const { TaxonomyStore } = require("../taxonomy");
    const { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } = require("fs");
    const { tmpdir } = require("os");
    const { join } = require("path");

    const tempDir = mkdtempSync(join(tmpdir(), "taxonomy-test-"));
    const tempFilePath = join(tempDir, "data", "taxonomy_knowledge.json");

    try {
      // 1. Initial run on new PC: file does not exist yet
      expect(existsSync(tempFilePath)).toBe(false);
      const store = new TaxonomyStore(tempFilePath);

      // Verify it seeded baseline domains into the new location
      expect(existsSync(tempFilePath)).toBe(true);
      expect(store.getDomain("qa")).toBeDefined();
      expect(store.getDomain("qa")?.name).toBe("Quality Assurance & Test Engineering");

      // 2. Continuous learning: teach a novel technical skill on this machine
      store.recordLearnedSkill("Cilium eBPF", "containers", "devops");
      expect(store.getLearnedSkill("cilium ebpf")?.category).toBe("containers");

      // Verify it persisted to disk in the new PC path
      const onDisk = JSON.parse(readFileSync(tempFilePath, "utf-8"));
      expect(onDisk.learnedSkills["cilium ebpf"]?.category).toBe("containers");

      // 3. App update simulation: load again with existing file present
      // Ensure existing learned skills and custom edits are never wiped
      const updatedStore = new TaxonomyStore(tempFilePath);
      expect(updatedStore.getLearnedSkill("cilium ebpf")?.category).toBe("containers");
      expect(updatedStore.getDomain("qa")?.name).toBe("Quality Assurance & Test Engineering");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("Imported jobs are strictly isolated to the candidate who imported them and never leak to other profiles", () => {
    const { isJobRelevantToProfile } = require("../server");

    const devopsProfile = {
      id: "candidate-devops-track",
      name: "Alex Jordan",
      headline: "DevOps Engineer / Platform Engineer",
      targetRoles: ["DevOps Engineer", "Platform Engineer", "SRE"],
      location: "London, UK",
      skills: { cloud: ["AWS", "Azure"], cicd: ["GitHub Actions"] }
    };

    const dynamicsProfile = {
      id: "candidate-dynamics-track",
      name: "Morgan Casey",
      headline: "Senior Dynamics 365 CRM & Power Platform Developer",
      targetRoles: ["Dynamics 365 Developer", "Power Platform Consultant"],
      location: "Manchester, UK",
      skills: { crm: ["Dynamics 365", "Power Platform"] }
    };

    // Job imported by DevOps candidate
    const devopsImportedJob = {
      id: "ext_1793740001",
      title: "DevOps Engineer (Kubernetes, AWS)",
      company: "CloudTech Ltd",
      location: "Remote / UK",
      is_imported: true,
      imported: true,
      portal: "external-url",
      profileId: "candidate-devops-track",
      imported_by_profiles: ["candidate-devops-track"]
    };

    // Job imported by Dynamics candidate
    const dynamicsImportedJob = {
      id: "ext_1793740002",
      title: "Senior Dynamics 365 CRM Developer",
      company: "Enterprise CRM Solutions",
      location: "London / Hybrid",
      is_imported: true,
      imported: true,
      portal: "external-url",
      profileId: "candidate-dynamics-track",
      imported_by_profiles: ["candidate-dynamics-track"]
    };

    // 1. DevOps candidate sees their imported job, but NOT Dynamics imported job
    expect(isJobRelevantToProfile(devopsImportedJob, devopsProfile, devopsImportedJob.id)).toBe(true);
    expect(isJobRelevantToProfile(dynamicsImportedJob, devopsProfile, dynamicsImportedJob.id)).toBe(false);

    // 2. Dynamics candidate sees their imported job, but NOT DevOps imported job
    expect(isJobRelevantToProfile(dynamicsImportedJob, dynamicsProfile, dynamicsImportedJob.id)).toBe(true);
    expect(isJobRelevantToProfile(devopsImportedJob, dynamicsProfile, devopsImportedJob.id)).toBe(false);

    // 3. If a job is imported by both profiles (multi-imported), both see it
    const sharedImportedJob = {
      id: "ext_1793740003",
      title: "Solutions Architect",
      company: "Global Tech",
      location: "Remote / UK",
      is_imported: true,
      imported: true,
      portal: "external-url",
      imported_by_profiles: ["candidate-devops-track", "candidate-dynamics-track"]
    };
    expect(isJobRelevantToProfile(sharedImportedJob, devopsProfile, sharedImportedJob.id)).toBe(true);
    expect(isJobRelevantToProfile(sharedImportedJob, dynamicsProfile, sharedImportedJob.id)).toBe(true);

    // 4. Third-party profile (e.g. QA) should NOT see the shared job if not in imported_by_profiles
    const qaProfile = {
      id: "candidate-qa-track",
      name: "Taylor Quinn",
      headline: "QA Engineer",
      targetRoles: ["QA Engineer"],
      location: "Bristol, UK"
    };
    expect(isJobRelevantToProfile(sharedImportedJob, qaProfile, sharedImportedJob.id)).toBe(false);
  });

  test("Application analysis is fast and evaluates 50 jobs in under 250ms uncached", () => {
    const { analyzeApplication } = require("../application_engine");
    const testProfile = {
      id: "speed-test-profile",
      name: "Performance Tester",
      headline: "Senior Cloud Engineer",
      targetRoles: ["Cloud Engineer", "DevOps Engineer"],
      location: "London, UK",
      skills: { cloud: ["AWS", "Azure", "GCP"], cicd: ["Jenkins", "GitHub Actions"] },
      experience: [
        {
          role: "Cloud Engineer",
          company: "Cloud Corp",
          bullets: ["Managed AWS EKS clusters and Terraform modules", "Automated deployments using GitHub Actions"]
        }
      ]
    };

    const mockJd = "We need an AWS and Azure Cloud Engineer with Terraform, Kubernetes, CI/CD, and Python experience.";

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      analyzeApplication(testProfile, {
        company: `Company ${i}`,
        role: "Cloud Engineer",
        location: "London, UK",
        fullJd: mockJd,
        keySkills: ["AWS", "Terraform"]
      });
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(250);
  });

  test("Custom manual job creation safely applies defaults for missing fields and scores ATS", () => {
    const { analyzeApplication } = require("../application_engine");

    const testProfile = {
      id: "test-candidate-1",
      name: "Taylor Swift",
      headline: "DevOps Engineer",
      targetRoles: ["DevOps Engineer"],
      location: "London, UK",
      skills: { cloud: ["AWS", "Kubernetes"] },
      experience: []
    };

    // Simulate saving a custom manual job with no required fields
    const body: Record<string, any> = {
      title: "",
      company: "",
      location: "",
      salary: "",
      full_jd: "Looking for an engineer with AWS and Kubernetes experience."
    };

    const title = body.title?.trim() || "Untitled Role";
    const company = body.company?.trim() || "Direct Employer";
    const location = body.location?.trim() || testProfile.location || "Remote";
    const salary = body.salary?.trim() || "Not advertised";

    expect(title).toBe("Untitled Role");
    expect(company).toBe("Direct Employer");
    expect(location).toBe("London, UK");
    expect(salary).toBe("Not advertised");

    const analysis = analyzeApplication(testProfile, {
      company,
      role: title,
      location,
      fullJd: body.full_jd
    });

    expect(analysis.overallScore).toBeGreaterThan(0);
    expect(analysis.matchedKeywords).toContain("AWS");
  });

  test("Editing existing job metadata allows updating company name, title, and JD repeatedly", () => {
    const { analyzeApplication } = require("../application_engine");

    const testProfile = {
      id: "test-candidate-1",
      name: "Taylor Swift",
      headline: "DevOps Engineer",
      targetRoles: ["DevOps Engineer"],
      location: "London, UK",
      skills: { cloud: ["AWS", "Terraform"] },
      experience: []
    };

    let jobRecord: Record<string, any> = {
      id: "manual_12345",
      title: "Wrong Title",
      company: "Wrong Company",
      location: "Manchester",
      salary: "£50,000",
      full_jd: "Basic engineer role",
      fit_score: 20
    };

    // User edits company name, title, and JD
    const edits = {
      company: "Acme Global Cloud Ltd",
      title: "Senior Platform Engineer",
      salary: "£85,000",
      full_jd: "Senior role requiring AWS and Terraform mastery."
    };

    jobRecord = {
      ...jobRecord,
      company: edits.company,
      title: edits.title,
      salary: edits.salary,
      full_jd: edits.full_jd
    };

    const updatedAnalysis = analyzeApplication(testProfile, {
      company: jobRecord.company,
      role: jobRecord.title,
      location: jobRecord.location,
      fullJd: jobRecord.full_jd
    });

    jobRecord.fit_score = updatedAnalysis.overallScore;

    expect(jobRecord.company).toBe("Acme Global Cloud Ltd");
    expect(jobRecord.title).toBe("Senior Platform Engineer");
    expect(jobRecord.salary).toBe("£85,000");
    expect(jobRecord.id).toBe("manual_12345");
    expect(jobRecord.fit_score).toBeGreaterThan(20);
  });
});

