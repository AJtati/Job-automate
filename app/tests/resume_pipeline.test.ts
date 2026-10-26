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
});
