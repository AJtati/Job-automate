export interface ContractRoleEvidence {
  title?: unknown;
  description?: unknown;
  summary?: unknown;
  employmentType?: unknown;
  employment_type?: unknown;
  jobType?: unknown;
  job_type?: unknown;
  contractType?: unknown;
  contract_type?: unknown;
  typeOfEmployment?: unknown;
  type_of_employment?: unknown;
  workType?: unknown;
  work_type?: unknown;
  contractTerm?: unknown;
  contract_term?: unknown;
  [key: string]: unknown;
}

const CONTRACT_FIELDS = [
  "employmentType", "employment_type", "jobType", "job_type",
  "contractType", "contract_type", "typeOfEmployment", "type_of_employment",
  "workType", "work_type", "contractTerm", "contract_term",
] as const;

const CONTRACT_PROFESSION_TITLE = /\bcontracts?\s+(?:manager|management|administrator|administration|specialist|analyst|negotiator|lawyer|attorney|officer|coordinator|lead|director|reviewer|drafting|writer)\b/i;
const CLEAR_CONTRACT_TITLE = /\b(?:fixed[- ]term|temporary|temp(?:orary)?|freelance(?:r)?|contractor|interim|locum|casual|seasonal)\b/i;
const CONTRACT_DURATION = /\b(?:\d{1,2}\s*[- ]?\s*(?:month|week|year)s?|short[- ]term|long[- ]term)\s+(?:fixed[- ]term\s+)?contract\b|\bcontract\s+(?:of|for)\s+\d{1,2}\s*(?:month|week|year)s?\b|\bcontract\b[^.;\n]{0,24}\b\d{1,2}\s*[- ]?\s*(?:month|week|year)s?\b/i;
const CONTRACT_ROLE_WORDING = /\b(?:contract(?:or)?|fixed[- ]term|temporary|temp|freelance|interim|locum|casual|seasonal)\s+(?:role|position|assignment|opportunity|engagement|basis)\b|\b(?:on|working on)\s+a\s+contract\s+basis\b|\b(?:inside|outside)\s+ir35\b|\bday[- ]rate\b/i;
const EMPLOYMENT_TYPE_LABEL = /\b(?:employment|job|position|work)\s+(?:type|status|basis|arrangement)\s*[:=-]\s*(?:contract(?:or)?|fixed[- ]term|temporary|temp|freelance|interim|locum|casual|seasonal)\b/i;

function flattenTypeValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(flattenTypeValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [record.name, record.label, record.type, record.value].flatMap(flattenTypeValue);
  }
  return typeof value === "string" ? [value] : [];
}

export function isContractRole(evidence: ContractRoleEvidence): boolean {
  const title = String(evidence.title || "").replace(/\s+/g, " ").trim();
  const titleIsContractProfession = CONTRACT_PROFESSION_TITLE.test(title);
  const structuredType = CONTRACT_FIELDS
    .flatMap(field => flattenTypeValue(evidence[field]))
    .map(value => value.replace(/[_–—]+/g, "-").replace(/\s+/g, " ").trim());

  if (structuredType.some(value => /\b(?:contract(?:or)?|fixed[- ]term|temporary|temp|freelance(?:r)?|interim|locum|casual|seasonal)\b/i.test(value) && !CONTRACT_PROFESSION_TITLE.test(value))) {
    return true;
  }
  if (CLEAR_CONTRACT_TITLE.test(title) || CONTRACT_DURATION.test(title)) return true;
  if (/\bcontract\b/i.test(title) && !titleIsContractProfession) return true;

  const description = [evidence.description, evidence.summary]
    .filter(value => typeof value === "string")
    .join(" ")
    .slice(0, 30000);
  return CONTRACT_DURATION.test(description) || EMPLOYMENT_TYPE_LABEL.test(description) || CONTRACT_ROLE_WORDING.test(description);
}
