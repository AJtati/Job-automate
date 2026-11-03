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
});

