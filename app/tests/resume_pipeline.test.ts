import { describe, expect, test } from "bun:test";
import { analyzeApplication } from "../application_engine";
import { parseResumeDeterministically } from "../resume_parser";
import { createLatexBackbone, renderGroundedCoverLetter, renderTailoredResume } from "../resume_engine";
import type { CandidateProfile } from "../profiles_manager";

const latex = String.raw`\textbf{\Huge Jordan Patel} \\
Platform Engineer \\
jordan@example.com | +44 7700 900123
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
    const plain = `Jordan Patel\nPlatform Engineer\njordan@example.com\n\nProfessional Experience\nNorthstar Ltd\nPlatform Engineer | January 2021 - Present\n- Built Kubernetes services on AWS with Terraform.\n- Cut deployment recovery time from 30 minutes to 8 minutes.\n\nEducation\nBSc Computer Science\nExample University\n2017 - 2020`;
    const result = parseResumeDeterministically(plain);
    expect(result.profile.experience?.[0].company).toBe("Northstar Ltd");
    expect(result.profile.experience?.[0].role).toBe("Platform Engineer");
    expect(result.profile.experience?.[0].bullets).toHaveLength(2);
  });

  test("extracts source facts without sample-profile fabrication", () => {
    const result = parseResumeDeterministically(latex);
    expect(result.profile.name).toBe("Jordan Patel");
    expect(result.profile.email).toBe("jordan@example.com");
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
    const profile: CandidateProfile = { id:"jordan", name:parsed.name!, headline:parsed.headline!, email:parsed.email!, phone:parsed.phone||"", location:"London", postcode:"", linkedin:"", github:"", visaSponsorshipRequired:false, targetRoles:["Platform Engineer"], targetLocations:["London"], preferredRadiusMiles:30, minSalary:0, skills:parsed.skills!, experience:parsed.experience!, education:parsed.education||[], certifications:[], latexBackbone:createLatexBackbone() };
    const job = { company:"Orbit", role:"Platform Engineer", location:"London", fullJd:"AWS, Kubernetes and Terraform are required for this platform role." };
    const analysis = analyzeApplication(profile, job);
    const output = renderTailoredResume(profile, job, analysis);
    expect(output).toContain("\\pdfgentounicode=1");
    expect(output).toContain("Northstar");
    expect(output).toContain("Cut deployment recovery time");
    expect(output).not.toContain("%%WORK_EXPERIENCE%%");
  });

  test("keeps LaTeX paragraph commands executable in grounded cover letters", () => {
    const parsed = parseResumeDeterministically(latex).profile as CandidateProfile;
    const profile = { ...parsed, id:"jordan", location:"London", postcode:"", linkedin:"", github:"", visaSponsorshipRequired:false, targetRoles:["Platform Engineer"], targetLocations:["London"], preferredRadiusMiles:30, minSalary:0, education:parsed.education||[], certifications:[] } as CandidateProfile;
    const job = { company:"Orbit & Co", role:"Platform Engineer", location:"London", fullJd:"AWS and Kubernetes are required." };
    const analysis = analyzeApplication(profile, job);
    const output = renderGroundedCoverLetter(profile, job, analysis);
    expect(output).toContain("Orbit \\& Co");
    expect(output).not.toContain("textbackslash{}par");
  });

  test("synthesizes tailored active-voice humanized experience when candidate has no uploaded resume", () => {
    // Manually created profile (e.g. Dynamics Developer or Data Scientist) with no uploaded resume
    const manualProfile: CandidateProfile = {
      id: "manju-test",
      name: "Manjubhargavi Cherupally",
      headline: "Senior Dynamics Developer",
      email: "manju@example.com",
      phone: "+44 7774 123456",
      location: "Manchester, United Kingdom",
      postcode: "M1",
      linkedin: "https://linkedin.com/in/manju",
      github: "https://github.com/manju",
      visaSponsorshipRequired: false,
      targetRoles: ["Senior Dynamics Developer"],
      targetLocations: ["Remote", "Manchester", "London"],
      preferredRadiusMiles: 50,
      minSalary: 75000,
      skills: {
        cloud: ["Azure"],
        devops: ["Microsoft Dynamics 365", "Power Apps", "Power Automate"],
        languages: ["C#", ".NET", "SQL"],
        tools: ["Dataverse"]
      },
      experience: [],
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

    // Resume should be complete with header, skills, and synthesized experience
    expect(resumeLatex).toContain("Manjubhargavi Cherupally");
    expect(resumeLatex).toContain("Senior Dynamics 365 Developer");
    expect(resumeLatex).toContain("Microsoft Dynamics 365");
    expect(resumeLatex).toContain("Enterprise Solutions");
    expect(resumeLatex).toContain("2021 -- Present");
    expect(resumeLatex).toContain("\\resumeSubheading");
    expect(resumeLatex).toContain("\\resumeItem{Architected and delivered scalable technical solutions");

    // Humanizer checks: Zero banned AI marketing clichés
    expect(resumeLatex).not.toContain("proven track record");
    expect(resumeLatex).not.toContain("mission-critical");
    expect(resumeLatex).not.toContain("seamlessly");
    expect(resumeLatex).not.toContain("leveraging");

    // Cover letter check: no generic error sentence
    const coverLatex = renderGroundedCoverLetter(manualProfile, job, analysis);
    expect(coverLatex).toContain("Contoso Enterprise");
    expect(coverLatex).toContain("Senior Dynamics 365 Developer");
    expect(coverLatex).not.toContain("The uploaded resume does not yet contain direct evidence");
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
});

