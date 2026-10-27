import type { CandidateProfile, EducationItem, ProjectItem, WorkExperience } from "./profiles_manager";

export interface ResumeParseResult {
  profile: Partial<CandidateProfile>;
  warnings: string[];
  confidence: number;
}

const SECTION_NAMES = ["summary", "profile", "experience", "work experience", "professional experience", "projects", "technical projects", "skills", "technical skills", "education", "certifications"];

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
  const normalized = rawText
    .replace(/\\section\{([^}]+)\}/g, "\n$1\n")
    .replace(/\\resumeItem\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, "\n- $1\n")
    .replace(/\\\\/g, "\n");
  return normalized.split(/\r?\n/).map(line => cleanLatex(line)).filter(Boolean);
}

function findContact(rawText: string) {
  const labelledLocation = rawText.match(/^(?:location|based in|address)\s*:\s*(.+)$/im)?.[1]?.trim();
  const contactLocation = rawText
    .split(/\r?\n/)
    .flatMap(line => line.split(/\s*[|·]\s*/))
    .map(value => value.trim())
    .find(value => /\b(?:united kingdom|great britain|england|scotland|wales|northern ireland|ireland|remote)\b/i.test(value));
  return {
    email: rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || "",
    phone: rawText.match(/(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,5}\)?[ .-]?)?\d{3,4}[ .-]?\d{3,4}/)?.[0]?.trim() || "",
    linkedin: rawText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%.-]+/i)?.[0] || "",
    github: rawText.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+/i)?.[0] || "",
    location: labelledLocation || contactLocation || "",
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
  const lines = sectionSlice(plainLines(rawText), ["experience", "work experience", "professional experience"]);
  const datePattern = /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[ .-]*)?((?:19|20)\d{2})\s*(?:--|–|—|-|to)\s*((?:present|current)|(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[ .-]*)?(?:19|20)\d{2})/i;
  const roleWords = /engineer|developer|architect|consultant|manager|lead|analyst|specialist|administrator|director|intern/i;
  const results: WorkExperience[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const date = line.match(datePattern);
    if (!date) continue;
    const beforeDate = line.slice(0, date.index).replace(/[|,·–—-]+$/g, "").trim();
    const parts = beforeDate.split(/\s+(?:at|@)\s+|\s*[|,·]\s*/i).filter(Boolean);
    const previous = (lines[index - 1] || "").trim();
    const previousTwo = (lines[index - 2] || "").trim();
    let role = parts.find(part => roleWords.test(part)) || "";
    let company = parts.find(part => part !== role && !/remote|hybrid|united kingdom|london/i.test(part)) || "";
    if (!role && roleWords.test(previous)) role = previous;
    if (!role && roleWords.test(previousTwo)) role = previousTwo;
    if (!company) company = role === previous ? previousTwo : previous;
    if (!role && parts.length) role = parts[0];
    if (!company && parts.length > 1) company = parts[1];

    const bullets: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const next = lines[cursor];
      if (datePattern.test(next)) break;
      if (/^[-•*]\s*/.test(next)) bullets.push(next.replace(/^[-•*]\s*/, "").trim());
      else if (bullets.length && next.length > 35) bullets[bullets.length - 1] += ` ${next}`;
      if (bullets.length >= 8) break;
    }
    if (role || company) {
      results.push({ company, role, location: parts.find(part => /remote|hybrid|london|united kingdom|uk/i.test(part)) || "", startDate: [date[1], date[2]].filter(Boolean).join(" ").trim(), endDate: date[3], bullets });
    }
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
  const start = lines.findIndex(line => names.includes(line.toLowerCase().replace(/:$/, "")));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && SECTION_NAMES.includes(line.toLowerCase().replace(/:$/, "")));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}

function skillGroups(rawText: string) {
  const section = sectionSlice(plainLines(rawText), ["skills", "technical skills"]);
  const text = section.join("\n");
  const values = (label: RegExp) => {
    const line = section.find(item => label.test(item));
    if (!line) return [];
    return line.replace(/^.*?:/, "").split(/[,|•]/).map(item => item.trim()).filter(Boolean);
  };

  const customGroups: Record<string, string[]> = {};
  for (const line of section) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 40) {
      const label = line.slice(0, colonIdx).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const items = line.slice(colonIdx + 1).split(/[,|•]/).map(item => item.trim()).filter(Boolean);
      if (items.length > 0) {
        customGroups[label] = items;
      }
    }
  }

  const unlabelled = section
    .filter(line => !line.includes(":"))
    .flatMap(line => line.split(/[,|•]/))
    .map(item => item.trim())
    .filter(Boolean);
  const grouped = {
    cloud: unlabelled.filter(item => /^(?:aws|amazon web services|azure|microsoft azure|gcp|google cloud|cloudflare)$/i.test(item)),
    devops: unlabelled.filter(item => /^(?:kubernetes|docker|terraform|terragrunt|ansible|helm|argocd|argo cd|gitops|openshift|pulumi)$/i.test(item)),
    languages: unlabelled.filter(item => /^(?:python|java|javascript|typescript|go|golang|rust|c\+\+|c#|ruby|php|kotlin|swift|scala|bash|powershell|sql)$/i.test(item)),
  };
  const categorised = new Set([...grouped.cloud, ...grouped.devops, ...grouped.languages].map(item => item.toLowerCase()));
  const otherTools = unlabelled.filter(item => !categorised.has(item.toLowerCase()));

  return {
    cloud: [...new Set([...values(/cloud|platform/i), ...grouped.cloud])],
    devops: [...new Set([...values(/devops|container|infrastructure|delivery|gitops/i), ...grouped.devops])],
    languages: [...new Set([...values(/language|framework/i), ...grouped.languages])],
    tools: [...new Set([...values(/tool|monitor|observ|ci\/cd/i), ...otherTools])],
    custom: customGroups,
    raw: text,
  };
}

function educationItems(rawText: string): EducationItem[] {
  const lines = sectionSlice(plainLines(rawText), ["education"]);
  if (!lines.length) return [];
  const dateIndex = lines.findIndex(line => /(?:19|20)\d{2}.*(?:19|20)\d{2}|present/i.test(line));
  const dates = dateIndex >= 0 ? lines[dateIndex].match(/(?:19|20)\d{2}|present/gi) || [] : [];
  return [{
    degree: lines.find(line => /bsc|msc|bachelor|master|degree|diploma|phd/i.test(line)) || lines[0],
    institution: lines.find(line => /university|college|institute|school/i.test(line)) || lines[1] || "",
    startDate: dates[0] || "",
    endDate: dates[1] || dates[0] || "",
    details: lines.filter((_, index) => index !== dateIndex).slice(2).join("; "),
  }];
}

export function parseResumeDeterministically(rawText: string): ResumeParseResult {
  const lines = plainLines(rawText);
  const contact = findContact(rawText);
  const firstContent = lines.filter(line => !contact.email || !line.includes(contact.email));
  const name = firstContent.find(line => line.length >= 3 && line.length <= 60 && !/^curriculum vitae|resume|cv$/i.test(line)) || "";
  const nameIndex = lines.indexOf(name);
  const headline = lines.slice(nameIndex + 1).find(line => line.length < 90 && !/[|@]/.test(line) && !SECTION_NAMES.includes(line.toLowerCase())) || "";
  const summaryLines = sectionSlice(lines, ["summary", "profile"]);
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

  const populated = [name, contact.email, contact.phone, headline, experiences.length, projects.length, groupedSkills.raw].filter(Boolean).length;
  return {
    profile: {
      name,
      headline: headline || experiences[0]?.role || "",
      summary: summaryLines.join(" "),
      ...contact,
      skills: {
        ...groupedSkills.custom,
        cloud: groupedSkills.cloud.length ? groupedSkills.cloud : groupedSkills.custom.cloud || [],
        devops: groupedSkills.devops.length ? groupedSkills.devops : groupedSkills.custom.devops || [],
        languages: groupedSkills.languages.length ? groupedSkills.languages : groupedSkills.custom.languages || [],
        tools: groupedSkills.tools.length ? groupedSkills.tools : groupedSkills.custom.tools || [],
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
