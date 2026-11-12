import { describe, expect, test } from "bun:test";
import { analyzeApplication } from "../application_engine";
import { parseResumeDeterministically } from "../resume_parser";
import { createLatexBackbone, renderGroundedCoverLetter, renderTailoredResume, cleanJobTitle, getDisplayRole, header, upgradeLegacyAtsBackbone } from "../resume_engine";
import type { CandidateProfile } from "../profiles_manager";
import { validateATSResumeText } from "../resume_pdf_validation";
import { AIService } from "../ai_service";

const latex = String.raw`\textbf{\Huge Alex Example} \\
Platform Engineer \\
alex@example.com | +44 7700 900123
\section{Summary}
Platform engineer working on reliable cloud systems.
\section{Work Experience}
\resumeSubheading{Northstar}{London}{Platform Engineer}{2021 -- Present}
\resumeItemListStart
\resumeItem{Built Kubernetes services on AWS with Terraform.}
\resumeItem{Cut deployment recovery time from 30 minutes to 8 minutes.}
\resumeItemListEnd
\section{Technical Skills}
Cloud Platforms: AWS
Containers and Infrastructure: Kubernetes, Terraform
Languages: Python
\section{Education}
BSc Computer Science
Example University
2017 -- 2020`;

describe("resume backbone pipeline", () => {
  test("structures conventional plain-text work history", () => {
    const plain = `Alex Example\nPlatform Engineer\nalex@example.com\n\nProfessional Experience\nNorthstar Ltd\nPlatform Engineer | January 2021 - Present\n- Built Kubernetes services on AWS with Terraform.\n- Cut deployment recovery time from 30 minutes to 8 minutes.\n\nEducation\nBSc Computer Science\nExample University\n2017 - 2020`;
    const result = parseResumeDeterministically(plain);
    expect(result.profile.experience?.[0].company).toBe("Northstar Ltd");
    expect(result.profile.experience?.[0].role).toBe("Platform Engineer");
    expect(result.profile.experience?.[0].bullets).toHaveLength(2);
  });

  test("extracts source facts without sample-profile fabrication", () => {
    const result = parseResumeDeterministically(latex);
    expect(result.profile.name).toBe("Alex Example");
    expect(result.profile.email).toBe("alex@example.com");
    expect(result.profile.experience?.[0].company).toBe("Northstar");
    expect(result.profile.experience?.[0].bullets[0]).toContain("Kubernetes");
    expect(JSON.stringify(result.profile)).not.toContain("Cloud Systems Ltd");
  });

  test("groups a conventional unlabelled skills line and reads a contact location", () => {
    const plain = `Alex Taylor\nSenior Platform Engineer\nalex@example.com | London, United Kingdom\n\nSKILLS\nAWS, Kubernetes, Terraform, Python`;
    const result = parseResumeDeterministically(plain);
    expect(result.profile.location).toBe("London, United Kingdom");
    expect(result.profile.skills?.cloud).toContain("AWS");
    expect(result.profile.skills?.devops).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(result.profile.skills?.languages).toContain("Python");
  });

  test("renders ATS-readable LaTeX from the persistent backbone", () => {
    const parsed = parseResumeDeterministically(latex).profile as CandidateProfile;
    const profile: CandidateProfile = { id:"alex", name:parsed.name!, headline:parsed.headline!, email:parsed.email!, phone:parsed.phone||"", location:"London", postcode:"", linkedin:"", github:"", visaSponsorshipRequired:false, targetRoles:["Platform Engineer"], targetLocations:["London"], preferredRadiusMiles:30, minSalary:0, skills:parsed.skills!, experience:parsed.experience!, education:parsed.education||[], certifications:[], latexBackbone:createLatexBackbone() };
    const job = { company:"Orbit", role:"Platform Engineer", location:"London", fullJd:"AWS, Kubernetes and Terraform are required for this platform role." };
    const analysis = analyzeApplication(profile, job);
    const output = renderTailoredResume(profile, job, analysis);
    expect(output).toContain("\\pdfgentounicode=1");
    expect(output).toContain("Northstar");
    expect(output).toContain("Cut deployment recovery time");
    expect(output).toContain("2021 - Present");
    expect(output).not.toContain("2021 -- Present");
    expect(output).not.toContain("%%WORK_EXPERIENCE%%");
  });

  test("migrates the generated sans-serif backbone back to the original LaTeX serif default", () => {
    const current = createLatexBackbone();
    const oldSansFontBlock = String.raw`\usepackage{iftex}
\ifXeTeX
  \usepackage{fontspec}
  \IfFontExistsTF{Arial}{
    \defaultfontfeatures{Ligatures=TeX,Kerning=Off}
    \setmainfont{Arial}
  }{
    \IfFontExistsTF{Liberation Sans}{
      \defaultfontfeatures{Ligatures=TeX,Kerning=Off}
      \setmainfont{Liberation Sans}
    }{}
  }
\else\ifLuaTeX
  \usepackage{fontspec}
  \IfFontExistsTF{Arial}{
    \defaultfontfeatures{Ligatures=TeX,Kerning=Off}
    \setmainfont{Arial}
  }{
    \IfFontExistsTF{Liberation Sans}{
      \defaultfontfeatures{Ligatures=TeX,Kerning=Off}
      \setmainfont{Liberation Sans}
    }{}
  }
\else
  \usepackage[T1]{fontenc}
  \usepackage{helvet}
  \renewcommand{\familydefault}{\sfdefault}
\fi\fi
`;
    const oldGenerated = current.replace("\\usepackage{needspace}\n", `\\usepackage{needspace}\n${oldSansFontBlock}`);
    expect(upgradeLegacyAtsBackbone(oldGenerated)).toBe(current);

    const customized = oldGenerated.replace("\\addtolength{\\textheight}{1.1in}", "\\addtolength{\\textheight}{1.0in}");
    expect(upgradeLegacyAtsBackbone(customized)).toBe(customized);
  });

  test("accepts extractable resume text and warns on split skills and Unicode date dashes", () => {
    const profile = {
      id: "alex",
      name: "Alex Example",
      headline: "Platform Engineer",
      email: "alex@example.com",
      phone: "",
      location: "London",
      postcode: "",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Platform Engineer"],
      targetLocations: ["London"],
      preferredRadiusMiles: 30,
      minSalary: 0,
      skills: { cloud: ["AWS"], devops: ["Kubernetes", "Terraform"] },
      experience: [],
      education: [],
      certifications: [],
    } as CandidateProfile;
    const source = String.raw`Alex Example alex@example.com AWS Kubernetes Terraform`;
    const readable = "Alex Example alex@example.com AWS Kubernetes Terraform. Built and maintained production platform services from 2021 - Present.";
    expect(validateATSResumeText(readable, source, profile).status).toBe("passed");

    const split = "Alex Example alex@example.com A WS Kubernetes Terraform. Built production platform services from 2021 – Present.";
    const result = validateATSResumeText(split, source, profile);
    expect(result.status).toBe("warning");
    expect(result.warnings.join(" ")).toContain("AWS");
    expect(result.warnings.join(" ")).toContain("non-ASCII dash");
  });

  test("keeps LaTeX paragraph commands executable in grounded cover letters", () => {
    const parsed = parseResumeDeterministically(latex).profile as CandidateProfile;
    const profile = { ...parsed, id:"alex", location:"London", postcode:"", linkedin:"", github:"", visaSponsorshipRequired:false, targetRoles:["Platform Engineer"], targetLocations:["London"], preferredRadiusMiles:30, minSalary:0, education:parsed.education||[], certifications:[] } as CandidateProfile;
    const job = { company:"Orbit & Co", role:"Platform Engineer", location:"London", fullJd:"AWS and Kubernetes are required." };
    const analysis = analyzeApplication(profile, job);
    const output = renderGroundedCoverLetter(profile, job, analysis);
    expect(output).toContain("Orbit \\& Co");
    expect(output).not.toContain("textbackslash{}par");
  });

  test("does not invent work history when a profile has no source experience", () => {
    const manualProfile: CandidateProfile = {
      id: "candidate-test",
      name: "Alex Example",
      headline: "Senior Dynamics Developer",
      email: "alex@example.com",
      phone: "",
      location: "Manchester, United Kingdom",
      postcode: "",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer"],
      targetLocations: ["Remote", "Manchester", "London"],
      preferredRadiusMiles: 50,
      minSalary: 0,
      skills: {
        cloud: ["Azure"],
        devops: ["Microsoft Dynamics 365", "Power Apps", "Power Automate"],
        languages: ["C#", ".NET", "SQL"],
        tools: ["Dataverse"]
      },
      experience: [],
      projects: [{ name: "Personal project", tools: "C#, SQL", bullets: ["Built a sample project catalog."] }],
      education: [],
      certifications: [],
      latexBackbone: createLatexBackbone()
    };
    const job = {
      company: "Contoso Enterprise",
      role: "Senior Dynamics 365 Developer",
      location: "Manchester",
      fullJd: "We are seeking a Senior Dynamics 365 Developer experienced in Microsoft Dynamics 365, Power Apps, Power Automate, C#, and Azure integrations."
    };

    const analysis = analyzeApplication(manualProfile, job);
    const resumeLatex = renderTailoredResume(manualProfile, job, analysis);

    expect(resumeLatex).toContain("Alex Example");
    expect(resumeLatex).toContain("Microsoft Dynamics 365");
    expect(resumeLatex).toContain("\\section{Technical Projects}");
    expect(resumeLatex).toContain("Personal project");
    expect(resumeLatex).toContain("Built a sample project catalog.");
    expect(resumeLatex).not.toContain("\\section{Work Experience}");
    expect(resumeLatex).not.toContain("Enterprise Solutions");
    expect(resumeLatex).not.toContain("Technology Consulting Partners");
    expect(resumeLatex).not.toContain("2021 - Present");
    expect(resumeLatex).not.toContain("Senior Professional");
    expect(resumeLatex).not.toContain("Architected and delivered scalable technical solutions");
  });

  test("keeps incomplete recorded roles without filling fictional employer or dates", () => {
    const parsed = parseResumeDeterministically(latex).profile as CandidateProfile;
    const partialProfile: CandidateProfile = {
      ...parsed,
      id: "candidate-partial-role",
      name: "Alex Example",
      email: "alex@example.com",
      phone: "",
      location: "",
      postcode: "",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: [],
      targetLocations: [],
      preferredRadiusMiles: 30,
      minSalary: 0,
      experience: [{ company: "", role: "Platform Engineer", location: "", startDate: "", endDate: "", bullets: ["Built a deployment helper."] }],
      education: [],
      certifications: [],
      latexBackbone: createLatexBackbone()
    };
    const job = { company: "Example", role: "Platform Engineer", location: "", fullJd: "" };
    const output = renderTailoredResume(partialProfile, job, analyzeApplication(partialProfile, job));
    const experienceStart = output.indexOf("\\section{Work Experience}");
    const skillsStart = output.indexOf("\\section{Technical Skills}");
    const workSection = output.slice(experienceStart, skillsStart);

    expect(workSection).toContain("\\resumeSubheading{}{}{Platform Engineer}{}");
    expect(workSection).toContain("Built a deployment helper.");
    expect(workSection).not.toContain("Enterprise Solutions");
    expect(workSection).not.toContain("2021 - Present");
  });

  test("uses the uploaded resume text for deterministic import fallback", async () => {
    const rawResume = `Alex Example\nPlatform Engineer\nalex@example.com\n\nProfessional Experience\nNorthstar Labs\nPlatform Engineer | January 2022 - Present\n- Built a release automation service with Go and Kubernetes.`;
    const aiService = new AIService({ provider: "builtin" } as any, "/tmp");
    const imported = await aiService.parseResumeText(rawResume);

    expect(imported.experience?.[0].company).toBe("Northstar Labs");
    expect(imported.experience?.[0].role).toBe("Platform Engineer");
    expect(imported.experience?.[0].bullets).toContain("Built a release automation service with Go and Kubernetes.");
    expect(imported.sourceResume?.text).toBe(rawResume);
  });

  test("does not ask an AI provider to invent work history for an empty profile", async () => {
    const prompts: string[] = [];
    const aiService = new AIService({ provider: "openai", openaiApiKey: "test" } as any, "/tmp");
    (aiService as any).generateText = async (prompt: string) => {
      prompts.push(prompt);
      if (prompt.includes("Generate 2 realistic work experience positions")) {
        return JSON.stringify([{
          company: "Test-only Fictional Employer",
          role: "Platform Engineer",
          location: "London",
          startDate: "2021",
          endDate: "Present",
          bullets: ["Fabricated test-only work item."]
        }]);
      }
      return "";
    };
    const emptyProfile: CandidateProfile = {
      id: "candidate-empty",
      name: "Alex Example",
      headline: "Platform Engineer",
      email: "alex@example.com",
      phone: "",
      location: "London",
      postcode: "",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Platform Engineer"],
      targetLocations: ["London"],
      preferredRadiusMiles: 30,
      minSalary: 0,
      skills: { cloud: ["AWS"], containers: ["Kubernetes"], iac: ["Terraform"] },
      experience: [],
      projects: [],
      education: [],
      certifications: []
    };
    const resumeLatex = await aiService.generateTailoredCV(emptyProfile, {
      company: "Example Systems",
      role: "Platform Engineer",
      location: "London",
      keySkills: ["AWS", "Kubernetes", "Terraform"]
    }, "en");

    expect(prompts.some(prompt => prompt.includes("Generate 2 realistic work experience positions"))).toBe(false);
    expect(resumeLatex).not.toContain("Test-only Fictional Employer");
    expect(resumeLatex).not.toContain("Fabricated test-only work item.");
    expect(resumeLatex).not.toContain("\\section{Work Experience}");
  });

  test("resume parser derives authentic domain roles and location for non-devops candidate", () => {
    const rawNurse = `SARAH CONNOR
Manchester, UK | sarah.connor@example.com | +44 7700 900555
Registered General Nurse

Professional Summary:
Band 6 Staff Nurse with 7 years clinical experience across acute medical wards.

Work Experience:
Manchester Royal Infirmary | Manchester, UK
Staff Nurse | Jan 2021 - Present
- Delivered acute medical care to cardiology patients.

Salford Royal Hospital | Salford, UK
Junior Staff Nurse | Aug 2018 - Dec 2020
- Provided post-operative patient wound care and medication administration.

Skills & Competencies:
Clinical: Patient Care, Acute Triage, IV Cannulation, Wound Management
Life Support: BLS, ACLS
Core: Team Leadership, Patient Advocacy

Education:
BSc Adult Nursing | University of Manchester | 2015 - 2018
`;

    const parsed = parseResumeDeterministically(rawNurse);
    expect(parsed.profile.name).toBe("SARAH CONNOR");
    expect(parsed.profile.headline).toBe("Registered General Nurse");
    expect(parsed.profile.location).toBe("Manchester, UK");
    expect(parsed.profile.postcode).toBe("M1");
    expect(parsed.profile.targetRoles).toContain("Staff Nurse");
    expect(parsed.profile.targetRoles).toContain("Senior Staff Nurse");
    expect(parsed.profile.targetRoles).not.toContain("DevOps Engineer");
    expect(parsed.profile.targetRoles).not.toContain("Platform Engineer");
    expect(parsed.profile.keywords?.length).toBeGreaterThan(0);
    expect(parsed.profile.keywords).toContain("Patient Care");
  });

  test("headline cleaner and display role aggressively purges recruiter noise and protects seniority", () => {
    // 1. Recruiter clickbait and ref codes
    const messyRole1 = "Trainee DevOps Engineer | No experience needed (Ref: 7501)";
    expect(cleanJobTitle(messyRole1)).toBe("Trainee DevOps Engineer");

    const messyRole2 = "Senior Platform Engineer - £85k - 95k + Hybrid (Ref: AB1234)";
    expect(cleanJobTitle(messyRole2)).toBe("Senior Platform Engineer");

    const messyRole3 = "Cloud Infrastructure Engineer / SRE | Remote UK | Immediate Start";
    expect(cleanJobTitle(messyRole3)).toBe("Cloud Infrastructure Engineer / SRE");

    // 2. Experienced candidate seniority protection:
    // When an experienced engineer applies to an entry/trainee scheme, never stamp 'Trainee' on their CV
    const experiencedCandidate: CandidateProfile = {
      id: "alex-test",
      name: "Alex Taylor",
      headline: "DevOps Engineer / Platform Engineer",
      email: "alex.taylor@example.com",
      phone: "+44 7700 900123",
      location: "Leeds, UK",
      postcode: "LS1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: true,
      targetRoles: ["DevOps Engineer", "Platform Engineer"],
      targetLocations: ["Remote", "Newcastle"],
      preferredRadiusMiles: 40,
      minSalary: 0,
      skills: { devops: ["Kubernetes", "Docker", "Terraform", "AWS", "CI/CD"] },
      experience: [
        { company: "CloudCorp", role: "DevOps Engineer", location: "UK", startDate: "2021", endDate: "Present", bullets: ["Maintained Kubernetes clusters."] },
        { company: "TechServices", role: "Systems Engineer", location: "UK", startDate: "2018", endDate: "2021", bullets: ["Automated deployments."] }
      ],
      education: [],
      certifications: []
    };

    const job = {
      company: "Qualify Nation Recruitment",
      role: messyRole1, // "Trainee DevOps Engineer | No experience needed (Ref: 7501)"
      location: "Newcastle",
      fullJd: "Exciting opportunity to join as a DevOps engineer. Training provided."
    };

    const analysis = analyzeApplication(experiencedCandidate, job);
    const displayRole = getDisplayRole(experiencedCandidate, job, analysis);

    // Must be calibrated to 'DevOps Engineer' without 'Trainee', 'Ref: 7501', or 'No experience needed'
    expect(displayRole).toBe("DevOps Engineer");
    expect(displayRole).not.toContain("Trainee");
    expect(displayRole).not.toContain("Ref: 7501");
    expect(displayRole).not.toContain("No experience needed");

    // Resume rendering check
    const resumeLatex = renderTailoredResume(experiencedCandidate, job, analysis);
    expect(resumeLatex).toContain("\\textbf{\\large DevOps Engineer}");
    expect(resumeLatex).not.toContain("Trainee DevOps Engineer");
    expect(resumeLatex).not.toContain("Ref: 7501");
    expect(resumeLatex).not.toContain("No experience needed");

    // Cover letter rendering check
    const coverLatex = renderGroundedCoverLetter(experiencedCandidate, job, analysis);
    expect(coverLatex).toContain("DevOps Engineer position at Qualify Nation Recruitment");
    expect(coverLatex).not.toContain("Trainee DevOps Engineer");
    expect(coverLatex).not.toContain("Ref: 7501");

    // 3. Headcount, tech laundry list, and plural noun purge
    const headcountRole = "2x Senior DevOps Engineers - Remote - AWS, Terraform, Lambda";
    expect(cleanJobTitle(headcountRole)).toBe("Senior DevOps Engineer");

    const headcountJob = {
      company: "Areti Group | B Corp",
      role: headcountRole,
      location: "Manchester Area, United Kingdom",
      fullJd: "We are seeking 2 Senior DevOps Engineers with strong AWS, Terraform, and Lambda."
    };
    const headcountAnalysis = analyzeApplication(experiencedCandidate, headcountJob);
    const headcountDisplayRole = getDisplayRole(experiencedCandidate, headcountJob, headcountAnalysis);
    expect(headcountDisplayRole).toBe("Senior DevOps Engineer");
    expect(headcountDisplayRole).not.toContain("2x");
    expect(headcountDisplayRole).not.toContain("Engineers");
    expect(headcountDisplayRole).not.toContain("AWS, Terraform, Lambda");

    const headcountResumeLatex = renderTailoredResume(experiencedCandidate, headcountJob, headcountAnalysis);
    expect(headcountResumeLatex).toContain("\\textbf{\\large Senior DevOps Engineer}");
    expect(headcountResumeLatex).not.toContain("2x Senior DevOps Engineers");

    // 3. Multi-Track: Dynamics 365 profile protection
    const dynamicsCandidate: CandidateProfile = {
      id: "candidate-test",
      name: "Alex Example",
      headline: "Senior Dynamics 365 CRM & Power Platform Developer",
      email: "alex@example.com",
      phone: "+44 7700 900456",
      location: "Manchester, UK",
      postcode: "M1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer"],
      targetLocations: ["Manchester"],
      preferredRadiusMiles: 30,
      minSalary: 0,
      skills: { dynamics: ["Power Apps", "Dataverse", "C# Plugins", "Workflows"] },
      experience: [
        { company: "Solutions Ltd", role: "Senior Dynamics Developer", location: "UK", startDate: "2021", endDate: "Present", bullets: ["Built custom Power Apps."] },
        { company: "Consulting", role: "CRM Developer", location: "UK", startDate: "2018", endDate: "2021", bullets: ["Wrote C# plugins."] }
      ],
      education: [],
      certifications: []
    };
    const messyDynamicsJob = {
      company: "Enterprise Cloud Partner",
      role: "Junior Dynamics 365 CRM Developer - Immediate Start | £45k (Ref: D365-99)",
      location: "Manchester",
      fullJd: "Seeking a Dynamics 365 developer with Power Platform and C# plugins experience."
    };
    const dynamicsAnalysis = analyzeApplication(dynamicsCandidate, messyDynamicsJob);
    const dynamicsRole = getDisplayRole(dynamicsCandidate, messyDynamicsJob, dynamicsAnalysis);
    expect(dynamicsRole).toContain("Dynamics 365");
    expect(dynamicsRole).not.toContain("Junior");
    expect(dynamicsRole).not.toContain("Ref: D365-99");
    expect(dynamicsRole).not.toContain("£45k");

    // 4. Multi-Track: QA & Testing profile protection
    const qaCandidate: CandidateProfile = {
      id: "samira-test",
      name: "Samira Khan",
      headline: "QA Engineer with 4.5 years of experience in Manual, Automation & API Testing",
      email: "samira.khan@example.com",
      phone: "+44 7700 900789",
      location: "London, UK",
      postcode: "E1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: true,
      targetRoles: ["QA Automation Engineer", "SDET"],
      targetLocations: ["London"],
      preferredRadiusMiles: 30,
      minSalary: 0,
      skills: { testing: ["Selenium", "Playwright", "Cypress", "Postman", "API Testing"] },
      experience: [
        { company: "FinTech QA", role: "QA Automation Engineer", location: "London", startDate: "2020", endDate: "Present", bullets: ["Designed Playwright test suites."] },
        { company: "Quality Lab", role: "Software Tester", location: "London", startDate: "2018", endDate: "2020", bullets: ["Manual and automated testing."] }
      ],
      education: [],
      certifications: []
    };
    const messyQaJob = {
      company: "Tech Recruitment",
      role: "Trainee QA Tester / Test Automation (Ref: QA-101) - Urgent Hire",
      location: "London",
      fullJd: "Exciting QA Tester opportunity. Experience with test automation is a plus."
    };
    const qaAnalysis = analyzeApplication(qaCandidate, messyQaJob);
    const qaRole = getDisplayRole(qaCandidate, messyQaJob, qaAnalysis);
    expect(qaRole).toContain("QA");
    expect(qaRole).not.toContain("Trainee");
    expect(qaRole).not.toContain("Ref: QA-101");
  });

  test("deep tailoring updates JD skills but does not invent work experience", async () => {
    const aiService = new AIService({ provider: "builtin" });
    const awsCandidate: CandidateProfile = {
      id: "alex-test",
      name: "Alex Taylor",
      headline: "DevOps Engineer / Platform Engineer",
      email: "alex.taylor@example.com",
      phone: "+44 7700 900123",
      location: "Leeds",
      postcode: "LS1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: true,
      targetRoles: ["DevOps Engineer", "Platform Engineer", "Cloud Engineer"],
      targetLocations: ["Leeds", "Manchester", "Remote"],
      preferredRadiusMiles: 70,
      minSalary: 75000,
      skills: {
        cloud: ["AWS"],
        containers: ["Docker", "Kubernetes"],
        cicd: ["Jenkins", "GitHub Actions"],
        iac: ["Terraform"]
      },
      experience: [
        {
          company: "Betting Tech Services",
          role: "Platform Engineer",
          location: "Leeds, UK",
          startDate: "2023",
          endDate: "Present",
          bullets: [
            "Maintained and supported multi-cluster AWS EKS infrastructure and CI/CD pipelines (Jenkins, GoCD, Concourse, GitHub Actions) for Free to Play betting services.",
            "Automated GitOps deployments with ArgoCD and Helm across staging and production clusters."
          ]
        },
        {
          company: "HealthTech Solutions",
          role: "DevOps Consultant",
          location: "Leeds, UK",
          startDate: "2021",
          endDate: "2023",
          bullets: [
            "Built microservice onboarding tools in Python and Jenkins to provision build jobs and Kubernetes manifests.",
            "Provisioned cloud and on-premises infrastructure using Terraform and Ansible Tower playbooks.",
            "Automated release workflows using Bash scripts and JSON templates across VSTS and Git pipelines."
          ]
        }
      ],
      education: [],
      certifications: []
    };

    const azureJob = {
      company: "Myn",
      role: "Azure DevOps Engineer – Hybrid (Lancaster, UK)",
      location: "Lancashire, United Kingdom",
      keySkills: ["aks", "azure", "azure-devops", "ci-cd", "docker", "kubernetes", "terraform"],
      fullJd: "Myn in Lancaster, UK, seeks an Azure DevOps Engineer to strengthen internal DevOps capabilities across cloud, automation and security. You will build secure Azure environments, design and implement CI/CD pipelines, manage AKS and Docker workflows."
    };

    const initialAnalysis = analyzeApplication(awsCandidate, azureJob);

    // 1. Test deepAlignCandidateExperience
    const alignedProfile = await aiService.deepAlignCandidateExperience(awsCandidate, azureJob, initialAnalysis, "en");

    expect(alignedProfile.skills.cloud).toContain("Azure");
    expect(alignedProfile.skills.containers).toContain("Kubernetes (AKS)");
    expect(alignedProfile.skills.cicd).toContain("Azure DevOps");

    const allAlignedBullets = alignedProfile.experience.flatMap(e => e.bullets || []);
    expect(allAlignedBullets.some(b => /Azure|AKS/i.test(b))).toBe(false);
    expect(allAlignedBullets.some(b => /Azure DevOps/i.test(b))).toBe(false);
    expect(allAlignedBullets[0]).toContain("AWS EKS infrastructure");

    // Verify Humanizer rules: no AI marketing clichés in aligned bullets
    const bannedCliches = /proven track record|mission-critical|seamlessly|leveraging|testament to|foster|spearheaded/i;
    for (const b of allAlignedBullets) {
      expect(bannedCliches.test(b)).toBe(false);
    }

    // 2. Test generateTailoredCV with deepTailor = true vs deepTailor = false
    const standardCV = await aiService.generateTailoredCV(awsCandidate, azureJob, "en", false);
    const deepCV = await aiService.generateTailoredCV(awsCandidate, azureJob, "en", true);

    // JD skills may be added to the categorized skills section, but should not be
    // converted into unsupported experience bullets.
    expect(deepCV).toContain("Azure DevOps");
    expect(standardCV).not.toContain("Kubernetes manifests for Azure Kubernetes Service (AKS)");
  });

  test("dynamic JD skills do not add an unrecorded certification keyword", async () => {
    const candidate = {
      id: "candidate-no-cert",
      name: "Alex Example",
      headline: "Platform Engineer",
      location: "Leeds",
      skills: { cloud: ["AWS"] },
      experience: [{ company: "Northstar Cloud", role: "Platform Engineer", location: "Leeds", startDate: "2022", endDate: "Present", bullets: ["Managed AWS platform services."] }],
      education: [],
      certifications: []
    } as CandidateProfile;
    const job = {
      company: "Example Systems",
      role: "Platform Engineer",
      location: "Remote",
      keySkills: ["Azure", "CKA"],
      fullJd: "Experience with Azure is preferred. The CKA certification is also preferred."
    };
    const result = await new AIService({ provider: "builtin" }).deepAlignCandidateExperience(
      candidate,
      job,
      analyzeApplication(candidate, job),
      "en",
      "At Northstar Cloud, add this point: I earned the CKA certification."
    );

    expect(result.skills.cloud).toContain("Azure");
    expect(Object.values(result.skills).flat().some(skill => /\bCKA\b/i.test(skill))).toBe(false);
    expect(result.experience[0].bullets).toEqual(["Managed AWS platform services."]);
    expect(result.certifications).toEqual([]);
  });

  test("built-in tailoring adds an explicitly supplied fact to the named employer", async () => {
    const aiService = new AIService({ provider: "builtin" });
    const candidate: CandidateProfile = {
      id: "alex-test",
      name: "Alex Taylor",
      headline: "DevOps Engineer / Platform Engineer",
      email: "alex.taylor@example.com",
      phone: "+44 7700 900123",
      location: "Leeds",
      postcode: "LS1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: [],
      targetLocations: [],
      preferredRadiusMiles: 0,
      minSalary: 0,
      skills: { cloud: ["AWS"], containers: ["Kubernetes"] },
      experience: [
        { company: "Northstar Cloud", role: "Platform Engineer", location: "Leeds", startDate: "2023", endDate: "Present", bullets: ["Maintained AWS platform services."] },
        { company: "HealthTech Solutions", role: "DevOps Consultant", location: "Leeds", startDate: "2021", endDate: "2023", bullets: ["Built Python automation tools."] }
      ],
      education: [],
      certifications: []
    };
    const job = {
      company: "Myn",
      role: "Azure DevOps Engineer",
      location: "Lancaster, UK",
      keySkills: ["Azure", "AKS", "Azure DevOps"],
      fullJd: "Seeking Azure DevOps experience with AKS."
    };
    const analysis = analyzeApplication(candidate, job);
    const tailored = await aiService.deepAlignCandidateExperience(
      candidate,
      job,
      analysis,
      "en",
      "At HealthTech Solutions, add this point: I used Microsoft Azure to automate deployment workflows for an internal product."
    );

    expect(tailored.experience[0].bullets).toEqual(["Maintained AWS platform services."]);
    expect(tailored.experience[1].bullets).toContain("Used Microsoft Azure to automate deployment workflows for an internal product.");
    expect(tailored.skills.cloud).toContain("Azure");
    expect(tailored.skills.containers).toContain("Kubernetes (AKS)");
    expect(tailored.skills.cicd || []).toContain("Azure DevOps");
    expect(tailored.certifications).toEqual([]);
  });

  test("AI tailoring humanizes a user-added fact without changing its employer or dates", async () => {
    const candidate = {
      id: "candidate-ai",
      name: "Alex Taylor",
      headline: "Platform Engineer",
      location: "Leeds",
      skills: { cloud: ["AWS"] },
      experience: [
        { company: "Northstar Cloud", role: "Platform Engineer", location: "Leeds", startDate: "2023", endDate: "Present", bullets: ["Maintained AWS platform services."] },
        { company: "HealthTech Solutions", role: "DevOps Consultant", location: "Leeds", startDate: "2021", endDate: "2023", bullets: ["Built Python automation tools."] }
      ],
      education: [],
      certifications: []
    } as CandidateProfile;
    const job = {
      company: "Myn",
      role: "Azure DevOps Engineer",
      location: "Lancaster, UK",
      keySkills: ["Azure", "AKS", "Azure DevOps"],
      fullJd: "Seeking Azure DevOps experience with AKS."
    };
    const instructions = "At HealthTech Solutions, add this point: I used Microsoft Azure to automate deployment workflows for an internal product.";
    const service = new AIService({ provider: "openai", openaiApiKey: "test" } as any);
    let capturedPrompt = "";
    (service as any).generateText = async (prompt: string) => {
      capturedPrompt = prompt;
      return JSON.stringify([
        { company: "Renamed company", role: "Renamed role", location: "Elsewhere", startDate: "1900", endDate: "1901", bullets: ["Operated AWS platform services."] },
        { company: "Another company", role: "Another role", location: "Elsewhere", startDate: "1900", endDate: "1901", bullets: ["Built Python automation tools.", "Automated deployment workflows for an internal product with Microsoft Azure.", "Configured AKS and Azure DevOps for the project."] }
      ]);
    };

    const tailored = await service.deepAlignCandidateExperience(candidate, job, analyzeApplication(candidate, job), "en", instructions);
    expect(capturedPrompt).toContain("Humanizer rules");
    expect(capturedPrompt).toContain(instructions);
    expect(tailored.experience[0].company).toBe("Northstar Cloud");
    expect(tailored.experience[0].startDate).toBe("2023");
    expect(tailored.experience[1].company).toBe("HealthTech Solutions");
    expect(tailored.experience[1].role).toBe("DevOps Consultant");
    expect(tailored.experience[1].startDate).toBe("2021");
    expect(tailored.experience[1].endDate).toBe("2023");
    expect(tailored.experience[1].bullets).toContain("Automated deployment workflows for an internal product with Microsoft Azure.");
    expect(tailored.experience[1].bullets).toHaveLength(2);
    expect(tailored.experience.flatMap(item => item.bullets || []).some(bullet => /AKS|Azure DevOps/i.test(bullet))).toBe(false);
    expect(tailored.skills.cloud).toContain("Azure");
    expect(tailored.skills.containers || []).toContain("Kubernetes (AKS)");
    expect(tailored.skills.cicd || []).toContain("Azure DevOps");
    expect(tailored.certifications || []).toEqual([]);
  });

  test("AI tailoring preserves every existing responsibility when its rewrite is shorter", async () => {
    const candidate = {
      id: "candidate-preserve-work",
      name: "Alex Example",
      headline: "Platform Engineer",
      location: "Leeds",
      skills: { cloud: ["AWS"] },
      experience: [{
        company: "Northstar Cloud",
        role: "Platform Engineer",
        location: "Leeds",
        startDate: "2020",
        endDate: "Present",
        bullets: [
          "Maintained AWS EKS clusters and CI/CD pipelines.",
          "Automated deployments with Helm and Terraform.",
          "Resolved production incidents and documented follow-up actions."
        ]
      }],
      education: [],
      certifications: []
    } as CandidateProfile;
    const service = new AIService({ provider: "openai", openaiApiKey: "test" } as any);
    (service as any).generateText = async () => JSON.stringify([{
      company: "Northstar Cloud",
      role: "Platform Engineer",
      bullets: ["Maintained AWS infrastructure and delivery pipelines."]
    }]);
    const job = { company: "Myn", role: "Platform Engineer", location: "Remote", fullJd: "AWS platform engineering role." };
    const result = await service.deepAlignCandidateExperience(candidate, job, analyzeApplication(candidate, job));

    expect(result.experience[0].bullets).toEqual(candidate.experience[0].bullets);
    expect(result.experience[0].startDate).toBe("2020");
    expect(result.experience[0].endDate).toBe("Present");
  });

  test("generateAptJobDesignation synthesizes believable natural title and falls back gracefully", async () => {
    const aiService = new AIService({ provider: "builtin" });
    const candidate: CandidateProfile = {
      id: "alex-climb",
      name: "Alex Taylor",
      headline: "DevOps Engineer / Platform Engineer",
      location: "Leeds, UK",
      targetRoles: ["DevOps Engineer", "Platform Engineer", "Cloud Engineer"],
      skills: { cloud: ["AWS", "Azure"], devops: ["Kubernetes", "Terraform", "CI/CD"] },
      experience: [
        { company: "Flutter UK", role: "Platform / DevOps Engineer", location: "Leeds", startDate: "2023", endDate: "Present", bullets: ["Built Kubernetes clusters."] }
      ],
      education: [],
      certifications: []
    };

    const climbJob = {
      company: "Climb Global Solutions",
      role: "Cloud & Infrastructure Solutions Engineer",
      location: "Remote (UK)",
      fullJd: "Seeking a Cloud & Infrastructure Solutions Engineer to lead cloud architecture and infrastructure automation across AWS and Kubernetes."
    };

    // 1. When provider is builtin (AI offline), falls back to local deterministic display role
    const fallbackTitle = await aiService.generateAptJobDesignation(candidate, climbJob);
    expect(fallbackTitle).toBeTruthy();

    // 2. Mock AI generation returning an apt, humanly believable title
    const mockAiService = new AIService({ provider: "openai", openaiApiKey: "mock-key" });
    (mockAiService as any).generateText = async () => "Senior Cloud & Infrastructure Engineer";

    const aiTitle = await mockAiService.generateAptJobDesignation(candidate, climbJob);
    expect(aiTitle).toBe("Senior Cloud & Infrastructure Engineer");
    // Ensure it is a natural title that bridges candidate background
    expect(aiTitle).not.toBe(climbJob.role);

    // 3. Verify renderTailoredResume uses the custom apt designation directly beneath the name in LaTeX
    const latex = renderTailoredResume(candidate, climbJob, { overallScore: 88, verdict: "Strong Match", matchedKeywords: ["AWS"], gapKeywords: [] } as any, undefined, "en", aiTitle);
    expect(latex).toContain("\\textbf{\\large Senior Cloud \\& Infrastructure Engineer}");

    // 4. Verify that if AI fails (throws error), it falls back to local getDisplayRole
    (mockAiService as any).generateText = async () => { throw new Error("API rate limited"); };
    const recoveredTitle = await mockAiService.generateAptJobDesignation(candidate, climbJob);
    expect(recoveredTitle).toBe(fallbackTitle);

    // 5. Verify generateTailoredCV integrates apt designation into tailor report and final LaTeX
    (mockAiService as any).generateText = async (prompt: string) => {
      if (prompt.includes("professional job title (designation)")) {
        return "Senior Cloud & Infrastructure Engineer";
      }
      return "Experienced platform engineer with strong AWS and Kubernetes expertise.";
    };
    const tailoredLatex = await mockAiService.generateTailoredCV(candidate, climbJob, "en", false);
    expect(tailoredLatex).toContain("\\textbf{\\large Senior Cloud \\& Infrastructure Engineer}");
    const report = mockAiService.getLastTailorReport();
    expect(report?.designation).toBe("Senior Cloud & Infrastructure Engineer");
  });

  test("candidate header customization respects individual header preferences and mobility notes", () => {
    const baseCandidate: CandidateProfile = {
      id: "candidate-a",
      name: "Candidate Example",
      headline: "Senior DevOps Engineer",
      email: "candidate@example.com",
      phone: "+44 7700 900123",
      location: "Manchester",
      postcode: "M1",
      linkedin: "https://linkedin.com/in/example-candidate",
      github: "https://github.com/example-candidate",
      portfolio: "https://example.com/portfolio",
      visaSponsorshipRequired: true,
      targetRoles: ["DevOps Engineer"],
      targetLocations: ["Remote", "Leeds"],
      preferredRadiusMiles: 70,
      minSalary: 0,
      skills: {},
      experience: [],
      education: [],
      certifications: []
    };

    // 1. Default without preferences includes all standard fields
    const defaultHdr = header(baseCandidate, "Senior DevOps Engineer");
    expect(defaultHdr).toContain("Manchester");
    expect(defaultHdr).toContain("+44 7700 900123");
    expect(defaultHdr).toContain("candidate@example.com");
    expect(defaultHdr).toContain("LinkedIn");
    expect(defaultHdr).toContain("\\href{https://github.com/example-candidate}{GitHub}");
    expect(defaultHdr).toContain("\\href{https://example.com/portfolio}{Portfolio}");

    // 2. Candidate opting to hide phone and append relocation mobility note
    const customCandidate: CandidateProfile = {
      ...baseCandidate,
      headerPreferences: {
        showLocation: true,
        showPhone: false,
        showEmail: true,
        showLinkedin: true,
        showGithub: false,
        showPortfolio: true,
        relocationNote: "Open to Relocation / Hybrid: Leeds, Manchester"
      }
    };
    const customHdr = header(customCandidate, "Senior DevOps Engineer");
    expect(customHdr).toContain("Manchester (Open to Relocation / Hybrid: Leeds, Manchester)");
    expect(customHdr).not.toContain("+44 7700 900123");
    expect(customHdr).toContain("candidate@example.com");
    expect(customHdr).toContain("LinkedIn");
    expect(customHdr).not.toContain("GitHub");
    expect(customHdr).toContain("Portfolio");

    // 3. Candidate opting to hide portfolio while showing GitHub
    const githubOnlyCandidate: CandidateProfile = {
      ...baseCandidate,
      headerPreferences: {
        showGithub: true,
        showPortfolio: false
      }
    };
    const githubOnlyHdr = header(githubOnlyCandidate, "Platform Engineer");
    expect(githubOnlyHdr).toContain("GitHub");
    expect(githubOnlyHdr).not.toContain("Portfolio");

    // 4. Different candidate opting for customLocationText and hiding location entirely
    const privacyCandidate: CandidateProfile = {
      ...baseCandidate,
      headerPreferences: {
        showLocation: false,
        showPhone: true,
        showEmail: true,
        showLinkedin: false,
        showGithub: false
      }
    };
    const privacyHdr = header(privacyCandidate, "Platform Engineer");
    expect(privacyHdr).not.toContain("Manchester");
    expect(privacyHdr).toContain("+44 7700 900123");
    expect(privacyHdr).not.toContain("LinkedIn");
  });

  test("generated LaTeX resumes retain the original serif default and ATS Unicode mapping", () => {
    const backbone = createLatexBackbone();
    expect(backbone).not.toContain("fontspec");
    expect(backbone).not.toContain("Arial");
    expect(backbone).not.toContain("helvet");
    expect(backbone).toContain("\\pdfgentounicode=1");
  });
});

