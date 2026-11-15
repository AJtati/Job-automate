import { describe, expect, test } from "bun:test";
import { isContractRole } from "../job_classification";

describe("contract role classification", () => {
  test("uses explicit employment type fields from provider data", () => {
    expect(isContractRole({ employment_type: "Contract" })).toBe(true);
    expect(isContractRole({ jobType: "Full-time" })).toBe(false);
  });

  test("recognizes clear contract labels in titles and descriptions", () => {
    expect(isContractRole({ title: "Cloud Engineer - Contract" })).toBe(true);
    expect(isContractRole({ title: "Senior Platform Engineer", description: "This is a 12-month fixed-term contract." })).toBe(true);
    expect(isContractRole({ title: "Senior Engineer", summary: "Outside IR35 with a day rate of £500." })).toBe(true);
  });

  test("does not mislabel roles that manage or negotiate contracts", () => {
    expect(isContractRole({ title: "Contract Manager", description: "Manage supplier agreements and contract negotiations." })).toBe(false);
    expect(isContractRole({ title: "Permanent Legal Counsel", description: "Draft and review commercial contracts." })).toBe(false);
  });
});
