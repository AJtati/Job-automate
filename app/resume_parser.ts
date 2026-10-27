import type { CandidateProfile, EducationItem, ProjectItem, WorkExperience } from "./profiles_manager";

export interface ResumeParseResult {
  profile: Partial<CandidateProfile>;
  warnings: string[];
  confidence: number;
}

const SECTION_NAMES = [
  "summary", "profile", "professional summary", "about", "about me", "executive summary",
  "experience", "work experience", "professional experience", "work history", "employment", "career history",
  "projects", "technical projects", "key projects", "notable projects",
  "skills", "technical skills", "key skills", "core skills", "core competencies", "technical competencies", "competencies", "skills & competencies", "tools & technologies", "technologies",
  "education", "academic background", "qualifications",
  "certifications", "licenses", "courses", "awards"
];

export function cleanTextArtifacts(rawText: string): string {
  return (rawText || "")
    // Repair hyphenated words split across lines
    .replace(/(\b[a-zA-Z]{3,})-\s*\r?\n\s*([a-zA-Z]{2,}\b)/g, "$1$2")
    // Fix single-letter PDF kerning gaps in common words
    .replace(/\bF\s+eb\b/gi, "Feb")
    .replace(/\bW\s+ork\b/gi, "Work")
    .replace(/\bT\s+ech\b/gi, "Tech")
    .replace(/\bT\s+echnology\b/gi, "Technology")
    .replace(/\bT\s+echnological\b/gi, "Technological")
    .replace(/\bT\s+esting\b/gi, "Testing")
    .replace(/\bB\.\s*T\s+ech\b/gi, "B.Tech")
    .replace(/\bR\s+oles\b/gi, "Roles")
    .replace(/\bM\s+arketing\b/gi, "Marketing")
    // Missing spaces after closing parentheses
    .replace(/\)([A-Za-z])/g, ") $1");
}

function cleanLatex(value: string): string {
  return value
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\(?:textbf|textit|emph|underline|small|large|Huge|scshape)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/~|\$\|\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plainLines(rawText: string): string[] {
  const normalized = cleanTextArtifacts(rawText)
    .replace(/\\section\{([^}]+)\}/g, "\n$1\n")
    .replace(/\\resumeItem\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, "\n- $1\n")
    .replace(/\\\\/g, "\n");
  return normalized.split(/\r?\n/).map(line => cleanLatex(line)).filter(Boolean);
}

function findContact(rawText: string) {
  const cleaned = cleanTextArtifacts(rawText);
  const labelledLocation = cleaned.match(/^(?:location|based in|address|residing in|city)\s*[:\-]\s*(.+)$/im)?.[1]?.trim();

  // Check top lines (header / contact area, typically first 15 lines)
  const headerLines = cleaned.split(/\r?\n/).slice(0, 15);
  const locationTerms = /\b(?:united kingdom|great britain|england|scotland|wales|northern ireland|ireland|remote|london|hartlepool|middlesbrough|leeds|manchester|birmingham|newcastle|durham|edinburgh|glasgow|bristol|liverpool|sheffield|nottingham|leicester|coventry|belfast|cardiff|southampton|reading|oxford|cambridge|derby|stockton|sunderland|darlington|york|milton keynes|norwich|swansea|bournemouth|swindon|teesside|hull|plymouth|stoke|luton|preston|aberdeen|dundee|dublin|new york|california|san francisco|chicago|austin|toronto|vancouver|sydney|melbourne|berlin|paris|amsterdam|munich|singapore|dubai|india|hyderabad|bangalore|mumbai|delhi|chennai|pune)\b/i;

  const contactLocation = headerLines
    .flatMap(line => line.split(/\s*[|·—–-]\s*/))
    .map(value => value.trim())
    .find(value => locationTerms.test(value) && !value.includes("@") && !/\d{5,}/.test(value) && value.length < 60);

  // Also check for postal code in header
  const postcodeMatch = cleaned.match(/\b([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})\b/i);

  let visaSponsorshipRequired: boolean | undefined = undefined;
  if (/no\s+sponsorship\s+required|right\s+to\s+work\s+in\s+the\s+uk|uk\s+citizen|british\s+citizen|settled\s+status|indefinite\s+leave\s+to\s+remain|no\s+visa\s+required/i.test(cleaned)) {
    visaSponsorshipRequired = false;
  } else if (/requires?\s+(?:visa\s+)?sponsorship|visa\s+sponsorship\s+required|tier\s*2\s+sponsorship/i.test(cleaned)) {
    visaSponsorshipRequired = true;
  }

  return {
    email: cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || "",
    phone: cleaned.match(/(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,5}\)?[ .-]?)?\d{3,4}[ .-]?\d{3,4}/)?.[0]?.trim() || "",
    linkedin: cleaned.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%.-]+/i)?.[0] || "",
    github: cleaned.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+/i)?.[0] || "",
    location: labelledLocation || contactLocation || "",
    postcode: postcodeMatch ? postcodeMatch[1].toUpperCase() : "",
    visaSponsorshipRequired,
  };
}

function latexExperiences(rawText: string): WorkExperience[] {
  const matches = [...rawText.matchAll(/\\resumeSubheading\s*\{([^{}]*)\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}([\s\S]*?)(?=\\resumeSubheading|\\section|\\resumeSubHeadingListEnd|$)/g)];
  return matches.map(match => {
    const dates = cleanLatex(match[4]).split(/\s+(?:--|–|—|to)\s+/i);
    const bullets = [...match[5].matchAll(/\\resumeItem\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map(item => cleanLatex(item[1])).filter(Boolean);
    return {
      company: cleanLatex(match[1]),
      location: cleanLatex(match[2]),
      role: cleanLatex(match[3]),
      startDate: dates[0] || "",
      endDate: dates[1] || "",
      bullets,
    };
  }).filter(item => item.company || item.role);
}

function plainExperiences(rawText: string): WorkExperience[] {
  const lines = sectionSlice(plainLines(rawText), ["experience", "work experience", "professional experience", "work history", "employment", "career history"]);
  const datePattern = /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[ .-]*)?((?:19|20)\d{2})\s*(?:--|–|—|-|to)\s*((?:present|current)|(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[ .-]*)?(?:19|20)\d{2})/i;
  const roleWords = /engineer|developer|architect|consultant|manager|lead|analyst|specialist|administrator|director|intern|designer|scientist|researcher|officer|coordinator|accountant|executive|advisor|head|practitioner|nurse|associate|auditor|strategist|writer|editor|doctor|physician|therapist|clinician|technician|instructor|teacher|professor|trainer|buyer|merchandiser|planner|assistant|representative|recruiter|controller|worker|chemist|biologist|surveyor|operator|supervisor|agent|mechanic|electrician|builder|chef|cook/i;
  const results: WorkExperience[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const date = line.match(datePattern);
    if (!date) {
      index++;
      continue;
    }

    const beforeDate = line.slice(0, date.index).replace(/[|,·–—-]+$/g, "").trim();
    const parts = beforeDate.split(/\s+(?:at|@)\s+|\s*[|,·]\s*/i).filter(Boolean);
    let role = parts.find(part => roleWords.test(part)) || "";
    let company = parts.find(part => part !== role && !/remote|hybrid|united kingdom|london|uk/i.test(part)) || "";
    let location = parts.find(part => /remote|hybrid|london|united kingdom|uk/i.test(part)) || "";

    // Check line AFTER (Format: Role + Dates on line 1, Company + Location on line 2)
    const nextLine = (lines[index + 1] || "").trim();
    let advanceIndex = index + 1;

    if (!company && nextLine && !datePattern.test(nextLine) && !/^[-•*]/.test(nextLine) && !SECTION_NAMES.includes(nextLine.toLowerCase().replace(/[:•-]/g, "").trim())) {
      const nextParts = nextLine.split(/\s*,\s*|\s*\|\s*/);
      if (nextParts.length > 0) {
        company = nextParts[0].trim();
        if (nextParts.length > 1 && !location) {
          location = nextParts.slice(1).join(", ").trim();
        }
        advanceIndex = index + 2;
      }
    }

    // Fallback: check lines BEFORE (Format: Company on line 1, Role + Dates on line 2)
    if (!company) {
      const prevLine = (lines[index - 1] || "").trim();
      const prevTwo = (lines[index - 2] || "").trim();
      const isBulletContinuation = (s: string) => /^[-•*]/.test(s) || s.length > 70 || /\b(?:and|with|for|to|in|of|using)\b$/i.test(s);
      if (prevLine && !isBulletContinuation(prevLine) && !datePattern.test(prevLine)) {
        if (!role && roleWords.test(prevLine)) role = prevLine;
        else company = prevLine;
      } else if (prevTwo && !isBulletContinuation(prevTwo) && !datePattern.test(prevTwo)) {
        if (!role && roleWords.test(prevTwo)) role = prevTwo;
        else company = prevTwo;
      }
    }

    if (!role && beforeDate) role = beforeDate;
    if (!role && parts.length) role = parts[0];
    if (!company && parts.length > 1) company = parts[1];

    // Collect bullets
    const bullets: string[] = [];
    for (let cursor = advanceIndex; cursor < lines.length; cursor++) {
      const bLine = lines[cursor];
      if (datePattern.test(bLine)) break;
      if (SECTION_NAMES.includes(bLine.toLowerCase().replace(/[:•-]/g, "").trim())) break;

      if (/^[-•*]\s*/.test(bLine)) {
        bullets.push(bLine.replace(/^[-•*]\s*/, "").trim());
      } else if (bullets.length > 0) {
        bullets[bullets.length - 1] += ` ${bLine}`;
      } else if (!company && !bLine.includes(":") && bLine.length < 50) {
        company = bLine;
      }
    }

    const startMonth = date[1] ? date[1].trim() : "";
    const startYear = date[2] ? date[2].trim() : "";
    const startDate = [startMonth, startYear].filter(Boolean).join(" ");
    const endDate = date[3] ? date[3].trim() : "Present";

    if (role || company) {
      results.push({
        company: company || "Enterprise Solutions",
        role: role || "Senior Professional",
        location,
        startDate,
        endDate,
        bullets
      });
    }

    index = advanceIndex;
  }

  return results.filter((item, index, all) => index === all.findIndex(other => `${other.company}|${other.role}|${other.startDate}` === `${item.company}|${item.role}|${item.startDate}`));
}

function latexProjects(rawText: string): ProjectItem[] {
  const matches = [...rawText.matchAll(/\\resumeProjectHeading\s*\{([\s\S]*?)\}\s*\{([^{}]*)\}([\s\S]*?)(?=\\resumeProjectHeading|\\section|\\resumeSubHeadingListEnd|$)/g)];
  return matches.map(match => {
    const heading = cleanLatex(match[1]);
    const [name, tools = ""] = heading.split(/\s*\|\s*/, 2);
    const bullets = [...match[3].matchAll(/\\resumeItem\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map(item => cleanLatex(item[1])).filter(Boolean);
    return { name, tools, category: cleanLatex(match[2]), bullets };
  }).filter(item => item.name);
}

function sectionSlice(lines: string[], names: string[]): string[] {
  const start = lines.findIndex(line => names.includes(line.toLowerCase().replace(/^[-•*0-9.]+\s*/, "").replace(/[:•-]/g, "").trim()));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && SECTION_NAMES.includes(line.toLowerCase().replace(/^[-•*0-9.]+\s*/, "").replace(/[:•-]/g, "").trim()));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}

function skillGroups(rawText: string) {
  const section = sectionSlice(plainLines(rawText), [
    "skills", "technical skills", "key skills", "core skills",
    "technical competencies", "core competencies", "competencies",
    "skills & competencies", "tools & technologies", "technologies"
  ]);
  const text = section.join("\n");

  const customGroups: Record<string, string[]> = {};
  const allParsedSkills: string[] = [];

  for (let i = 0; i < section.length; i++) {
    let line = section[i].replace(/^[-•*]\s*/, "").trim();
    // Check if subsequent lines continue this category before next category or bullet
    while (i + 1 < section.length && !/^[-•*]/.test(section[i + 1]) && !section[i + 1].includes(":") && !SECTION_NAMES.includes(section[i + 1].toLowerCase().replace(/[:•-]/g, "").trim())) {
      line += " " + section[i + 1].trim();
      i++;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 50) {
      const categoryLabel = line.slice(0, colonIdx).trim().replace(/^[-•*]\s*/, "");
      const skillsStr = line.slice(colonIdx + 1).trim();
      // Split on commas outside parentheses
      const items = skillsStr.split(/,(?![^(]*\))/g).map(item => item.trim()).filter(Boolean);
      if (items.length > 0) {
        customGroups[categoryLabel] = items;
        allParsedSkills.push(...items);
      }
    } else {
      const items = line.split(/,(?![^(]*\))/g).map(item => item.trim()).filter(Boolean);
      allParsedSkills.push(...items);
    }
  }

  // Heuristic classification across standard ATS categories
  const isCloud = (s: string) => /aws|amazon|azure|gcp|google cloud|cloudflare/i.test(s);
  const isDevops = (s: string) => /devops|ci\/cd|pipeline|pac cli|docker|kubernetes|terraform|terragrunt|ansible|helm|argocd|gitops|openshift|pulumi|jenkins|agile|scrum/i.test(s);
  const isLang = (s: string) => /c#|\.net|dotnet|javascript|typescript|python|x\+\+|sql|html|css|powershell|bash|java|golang|go|rust|ruby|php|kotlin|swift|scala/i.test(s);
  const isTool = (s: string) => /dynamics|crm|power apps|power automate|power platform|dataverse|power bi|ssrs|dax|copilot|nunit|jasmine|tdd|rsat|git/i.test(s);

  const cloud = [...new Set(allParsedSkills.filter(isCloud))];
  const devops = [...new Set(allParsedSkills.filter(isDevops))];
  const languages = [...new Set(allParsedSkills.filter(isLang))];
  const tools = [...new Set(allParsedSkills.filter(isTool))];

  return {
    cloud,
    devops,
    languages,
    tools,
    custom: customGroups,
    raw: text,
  };
}

function educationItems(rawText: string): EducationItem[] {
  const lines = sectionSlice(plainLines(rawText), ["education", "academic background", "qualifications"]);
  if (!lines.length) return [];

  const dateIndex = lines.findIndex(line => /(?:19|20)\d{2}.*(?:19|20)\d{2}|present/i.test(line));
  const dates = dateIndex >= 0 ? lines[dateIndex].match(/(?:19|20)\d{2}|present/gi) || [] : [];

  let degree = lines.find(line => /bsc|msc|bachelor|master|degree|diploma|phd|b\.?tech/i.test(line)) || lines[0] || "";
  let institution = lines.find(line => /university|college|institute|school/i.test(line)) || lines[1] || "";

  // Clean degree line (remove "Bachelor's Degree:" prefix or date ranges trailing)
  degree = degree
    .replace(/^bachelor[’']?s\s+degree\s*:\s*/i, "")
    .replace(/\s*(?:19|20)\d{2}\s*(?:--|–|—|-|to)\s*(?:(?:19|20)\d{2}|present)/gi, "")
    .trim();

  // If institution contains city/country after parentheses, format cleanly
  institution = institution.replace(/\)([A-Za-z])/g, ") $1").trim();

  return [{
    degree: degree || "Bachelor's Degree",
    institution: institution || "University",
    startDate: dates[0] || "",
    endDate: dates[1] || dates[0] || "",
    details: lines.filter((_, index) => index !== dateIndex && lines[index] !== degree && lines[index] !== institution).slice(2).join("; "),
  }];
}

export function deriveTargetRoles(headline: string, experiences: WorkExperience[] = [], skills: Record<string, any> = {}): string[] {
  const roles = new Set<string>();
  if (headline && headline.trim() && headline.length < 70) {
    roles.add(headline.trim());
  }
  for (const exp of experiences || []) {
    if (exp.role && exp.role.trim() && exp.role.length < 60) {
      roles.add(exp.role.trim());
    }
  }

  const primaryRole = headline || experiences[0]?.role || "";
  const allRolesAndSkills = `${primaryRole} ${(experiences || []).map(e => e.role).join(" ")} ${Object.values(skills || {}).flat().join(" ")}`.toLowerCase();

  // Specific domain matches ONLY when primary role or unambiguous skills match
  if (/dynamics|power platform|dataverse|power apps|power automate|dynamics 365/i.test(allRolesAndSkills)) {
    roles.add("Senior Dynamics Developer");
    roles.add("Dynamics 365 Developer");
    roles.add("Power Platform Developer");
    roles.add("Power Platform Consultant");
    roles.add("Dynamics 365 CRM Technical Consultant");
  } else if (/\bdevops\b|kubernetes|terraform|ci\/cd|site reliability engineer|\bsre\b/i.test(allRolesAndSkills)) {
    roles.add("DevOps Engineer");
    roles.add("Platform Engineer");
    roles.add("Cloud Engineer");
    roles.add("Infrastructure Engineer");
    roles.add("Site Reliability Engineer (SRE)");
  } else if (/nurse|nursing|healthcare|clinical|patient care/i.test(allRolesAndSkills)) {
    roles.add("Staff Nurse");
    roles.add("Senior Staff Nurse");
    roles.add("Clinical Nurse Specialist");
    roles.add("Registered General Nurse");
  } else if (/accountant|accounting|finance|financial analyst|audit|bookkeeper/i.test(allRolesAndSkills)) {
    roles.add("Financial Analyst");
    roles.add("Senior Accountant");
    roles.add("Management Accountant");
    roles.add("Financial Controller");
  } else if (/marketing|seo|content creator|copywriter|social media|brand strategist/i.test(allRolesAndSkills)) {
    roles.add("Marketing Manager");
    roles.add("Senior Marketing Specialist");
    roles.add("Digital Marketing Lead");
    roles.add("Brand Strategist");
  } else if (/data scientist|machine learning|ml engineer|ai engineer/i.test(allRolesAndSkills)) {
    roles.add("Data Scientist");
    roles.add("Machine Learning Engineer");
    roles.add("AI Engineer");
    roles.add("Data Analyst");
    roles.add("Data Engineer");
  } else if (/full stack|frontend|backend|software engineer|software developer|\.net|java|c#/i.test(allRolesAndSkills)) {
    roles.add("Senior Software Engineer");
    roles.add("Full Stack Developer");
    roles.add("Backend Developer");
    roles.add("Software Developer");
  } else if (/product manager|scrum master|agile delivery|project manager/i.test(allRolesAndSkills)) {
    roles.add("Technical Project Manager");
    roles.add("Product Manager");
    roles.add("Scrum Master");
    roles.add("Agile Delivery Lead");
  } else if (/qa lead|automation test|sdet|quality assurance/i.test(allRolesAndSkills)) {
    roles.add("QA Lead");
    roles.add("Automation Test Engineer");
    roles.add("SDET");
    roles.add("Quality Assurance Engineer");
  } else if (primaryRole) {
    // Universal role hierarchy derivation from whatever profession the candidate has
    roles.add(primaryRole);
    if (!primaryRole.toLowerCase().startsWith("senior")) roles.add(`Senior ${primaryRole}`);
    if (!primaryRole.toLowerCase().startsWith("lead")) roles.add(`Lead ${primaryRole}`);
    roles.add(`${primaryRole} Specialist`);
    roles.add(`${primaryRole} Consultant`);
  }

  return [...roles].filter(Boolean).slice(0, 5);
}

export function deriveTargetLocations(location: string): string[] {
  const loc = (location || "").trim();
  const locLower = loc.toLowerCase();
  const results = new Set<string>(["Remote"]);

  if (loc) {
    results.add(loc);
  }

  if (/middlesbrough|teesside|stockton|hartlepool/i.test(locLower)) {
    results.add("Middlesbrough, UK");
    results.add("Newcastle, UK");
    results.add("Leeds, UK");
  } else if (/leeds|bradford|york|harrogate/i.test(locLower)) {
    results.add("Leeds, UK");
    results.add("Manchester, UK");
    results.add("Sheffield, UK");
  } else if (/manchester|salford/i.test(locLower)) {
    results.add("Manchester, UK");
    results.add("Liverpool, UK");
    results.add("Leeds, UK");
  } else if (/london/i.test(locLower)) {
    results.add("London, UK");
  } else if (/birmingham/i.test(locLower)) {
    results.add("Birmingham, UK");
    results.add("Coventry, UK");
  } else if (/newcastle|sunderland|durham/i.test(locLower)) {
    results.add("Newcastle, UK");
    results.add("Durham, UK");
    results.add("Sunderland, UK");
  }

  results.add("United Kingdom");
  return [...results].slice(0, 5);
}

export function derivePostcode(location: string, text: string): string {
  const postcodeMatch = text.match(/\b([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})\b/i);
  if (postcodeMatch) return postcodeMatch[1].toUpperCase();

  const loc = (location || "").toLowerCase();
  if (loc.includes("middlesbrough") || loc.includes("teesside")) return "TS1";
  if (loc.includes("stockton")) return "TS18";
  if (loc.includes("hartlepool")) return "TS24";
  if (loc.includes("darlington")) return "DL1";
  if (loc.includes("sunderland")) return "SR1";
  if (loc.includes("durham")) return "DH1";
  if (loc.includes("newcastle")) return "NE1";
  if (loc.includes("york")) return "YO1";
  if (loc.includes("leeds")) return "LS1";
  if (loc.includes("sheffield")) return "S1";
  if (loc.includes("manchester")) return "M1";
  if (loc.includes("liverpool")) return "L1";
  if (loc.includes("birmingham")) return "B1";
  if (loc.includes("nottingham")) return "NG1";
  if (loc.includes("leicester")) return "LE1";
  if (loc.includes("coventry")) return "CV1";
  if (loc.includes("bristol")) return "BS1";
  if (loc.includes("reading")) return "RG1";
  if (loc.includes("oxford")) return "OX1";
  if (loc.includes("cambridge")) return "CB1";
  if (loc.includes("southampton")) return "SO14";
  if (loc.includes("cardiff")) return "CF10";
  if (loc.includes("belfast")) return "BT1";
  if (loc.includes("edinburgh")) return "EH1";
  if (loc.includes("glasgow")) return "G1";
  if (loc.includes("aberdeen")) return "AB10";
  if (loc.includes("dundee")) return "DD1";
  if (loc.includes("london")) return "EC1A";
  return "";
}

export function deriveMinSalary(headline: string, experiences: WorkExperience[] = []): number {
  const text = `${headline} ${(experiences || []).map(e => e.role).join(" ")}`.toLowerCase();
  if (/nurse|nursing|healthcare|clinical|nhs/i.test(text)) {
    if (/lead|senior|specialist|band 7|band 8/i.test(text)) return 45000;
    return 35000;
  }
  if (/lead|principal|architect|director|head/i.test(text)) return 85000;
  if (/senior/i.test(text)) return 70000;
  if (/junior|trainee|graduate|intern/i.test(text)) return 35000;
  return 55000;
}

export function parseResumeDeterministically(rawText: string): ResumeParseResult {
  const lines = plainLines(rawText);
  const contact = findContact(rawText);
  const firstContent = lines.filter(line => !contact.email || !line.includes(contact.email));
  const name = firstContent.find(line => line.length >= 3 && line.length <= 60 && !/^curriculum vitae|resume|cv$/i.test(line)) || "";
  const nameIndex = lines.indexOf(name);

  let headline = "";
  if (nameIndex >= 0) {
    for (let i = nameIndex + 1; i < Math.min(lines.length, nameIndex + 6); i++) {
      const line = lines[i];
      if (SECTION_NAMES.includes(line.toLowerCase().replace(/[:•-]/g, "").trim())) break;
      const parts = line.split(/\s*[|·•]\s*/).map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (!part.includes("@") && !/\d{4,}/.test(part) && !/linkedin|github|portfolio|http/i.test(part) && part.length >= 3 && part.length < 80 && !/united kingdom|great britain|london|manchester/i.test(part)) {
          if (/engineer|developer|architect|consultant|manager|lead|analyst|specialist|administrator|director|designer|scientist|researcher|officer|coordinator|accountant|executive|advisor|head|practitioner|nurse|associate|doctor|physician|therapist|clinician|technician|instructor|teacher|professor|trainer|assistant|recruiter|worker|surveyor|agent|chef/i.test(part) || (!headline && parts.length === 1)) {
            headline = part;
            break;
          }
        }
      }
      if (headline) break;
    }
  }

  const summaryLines = sectionSlice(lines, ["summary", "profile", "professional summary"]);
  const experiences = latexExperiences(rawText);
  if (!experiences.length) experiences.push(...plainExperiences(rawText));
  const projects = latexProjects(rawText);
  const groupedSkills = skillGroups(rawText);
  const warnings: string[] = [];
  if (!name) warnings.push("Name was not identified. Add it before saving the profile.");
  if (!experiences.length) warnings.push("Work history could not be structured automatically. Review the source text before saving.");
  const allSkills = [
    ...groupedSkills.cloud,
    ...groupedSkills.devops,
    ...groupedSkills.languages,
    ...groupedSkills.tools,
    ...Object.values(groupedSkills.custom).flat()
  ];
  if (!allSkills.length) warnings.push("Technical skills were not grouped automatically.");

  const derivedHeadline = headline || experiences[0]?.role || "";
  const targetRoles = deriveTargetRoles(derivedHeadline, experiences, groupedSkills.custom);
  const targetLocations = deriveTargetLocations(contact.location);
  const postcode = contact.postcode || derivePostcode(contact.location, rawText);
  const minSalary = deriveMinSalary(derivedHeadline, experiences);

  const seenSkill = new Set<string>();
  const allUniqueSkills: string[] = [];
  for (const s of allSkills) {
    const clean = s.trim();
    const lower = clean.toLowerCase();
    if (clean && !seenSkill.has(lower)) {
      seenSkill.add(lower);
      allUniqueSkills.push(clean);
    }
  }

  const populated = [name, contact.email, contact.phone, derivedHeadline, experiences.length, projects.length, groupedSkills.raw].filter(Boolean).length;
  return {
    profile: {
      name,
      headline: derivedHeadline,
      summary: summaryLines.join(" "),
      ...contact,
      postcode: postcode || (contact.location ? derivePostcode(contact.location, rawText) : ""),
      visaSponsorshipRequired: contact.visaSponsorshipRequired ?? false,
      targetRoles,
      targetLocations,
      preferredRadiusMiles: 70,
      minSalary,
      keywords: allUniqueSkills,
      skills: {
        ...groupedSkills.custom,
        cloud: groupedSkills.cloud.length ? groupedSkills.cloud : (groupedSkills.custom.cloud || []),
        devops: groupedSkills.devops.length ? groupedSkills.devops : (groupedSkills.custom.devops || []),
        languages: groupedSkills.languages.length ? groupedSkills.languages : (groupedSkills.custom.languages || []),
        tools: groupedSkills.tools.length ? groupedSkills.tools : (groupedSkills.custom.tools || []),
      },
      experience: experiences,
      projects,
      education: educationItems(rawText),
      certifications: [],
    },
    warnings,
    confidence: Math.min(100, Math.round((populated / 7) * 100)),
  };
}
