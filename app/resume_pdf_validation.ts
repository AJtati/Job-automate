import type { CandidateProfile } from "./profiles_manager";
import { escapeLatex } from "./resume_engine";

export type ATSValidationResult = {
  status: "passed" | "warning" | "unavailable" | "not_applicable";
  warnings: string[];
};

function normalizeATSCheckText(value: string): string {
  return value.normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/--+/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function validateATSResumeText(text: string, latexCode: string, profile: CandidateProfile): ATSValidationResult {
  const warnings: string[] = [];
  const normalizedText = normalizeATSCheckText(text);
  const visibleTerms = new Set<string>();
  const addIfVisible = (value?: string) => {
    const term = (value || "").trim();
    if (term.length < 2) return;
    const source = latexCode.toLowerCase();
    if (source.includes(term.toLowerCase()) || source.includes(escapeLatex(term).toLowerCase())) {
      visibleTerms.add(term);
    }
  };

  addIfVisible(profile.name);
  if (profile.headerPreferences?.showEmail !== false) addIfVisible(profile.email);
  if (profile.headerPreferences?.showPhone !== false) addIfVisible(profile.phone);
  for (const experience of profile.experience || []) {
    addIfVisible(experience.company);
    addIfVisible(experience.role);
    addIfVisible(experience.startDate);
    addIfVisible(experience.endDate);
  }
  for (const education of profile.education || []) {
    addIfVisible(education.institution);
    addIfVisible(education.degree);
    addIfVisible(education.startDate);
    addIfVisible(education.endDate);
  }
  for (const skills of Object.values(profile.skills || {})) {
    for (const skill of Array.isArray(skills) ? skills : []) addIfVisible(skill);
  }

  const normalizedLength = normalizedText.replace(/\s/g, "").length;
  if (normalizedLength < 80) warnings.push("The extracted PDF text is empty or too short.");
  if (/\(cid:\d+\)|\uFFFD/i.test(text)) warnings.push("The PDF text contains unreadable character placeholders.");

  const missing = [...visibleTerms].filter(term => !normalizedText.includes(normalizeATSCheckText(term)));
  if (missing.length) {
    const shown = missing.slice(0, 5).join(", ");
    const more = missing.length > 5 ? ` and ${missing.length - 5} more` : "";
    warnings.push(`The extracted text omits or splits: ${shown}${more}.`);
  }

  const nonAsciiDateRange = /(?<!\d)(?:19|20)\d{2}(?!\d)[ \t]*[\u2010-\u2015\u2212]|[\u2010-\u2015\u2212][ \t]*(?<!\d)(?:19|20)\d{2}(?!\d)/u;
  if (nonAsciiDateRange.test(text)) warnings.push("At least one date range uses a non-ASCII dash.");

  return { status: warnings.length ? "warning" : "passed", warnings };
}
