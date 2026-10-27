import { describe, expect, test } from "bun:test";
import { assessSponsorship, classifyVacancySponsorship, findSponsor, matchesSponsorshipMode, parseSponsorCsv } from "../sponsorship";

const csv = `Organisation Name,Town/City,County,Type & Rating,Route\n"Example & Sons, Limited",London,London,A rating,Skilled Worker\nOther Co Ltd,Leeds,,A rating,Global Business Mobility\n`;
const records = parseSponsorCsv(csv);

describe("sponsorship verification", () => {
  test("parses quoted GOV.UK CSV rows and matches harmless legal suffix differences", () => {
    expect(records).toHaveLength(2);
    expect(findSponsor(records, "Example and Sons Ltd").verified).toBe(true);
    expect(findSponsor(records, "Example Technologies").verified).toBe(false);
    expect(findSponsor([{ organisation: "Version 1 Solutions Limited", town: "", county: "", rating: "A", route: "Skilled Worker" }], "Version 1").verified).toBe(true);
  });

  test("negative vacancy wording takes priority over generic sponsorship wording", () => {
    expect(classifyVacancySponsorship("Visa sponsorship is not available for this role.").status).toBe("unavailable");
    expect(classifyVacancySponsorship("Skilled Worker visa sponsorship is offered.").status).toBe("offered");
    expect(classifyVacancySponsorship("Applicants must have the right to work.").status).toBe("not-stated");
  });

  test("explicit mode requires a licensed employer and positive vacancy wording", () => {
    const offered = assessSponsorship(records, "Example & Sons", "Skilled Worker sponsorship is available.");
    const unstated = assessSponsorship(records, "Example & Sons", "Join our engineering team.");
    expect(matchesSponsorshipMode(offered, "explicit")).toBe(true);
    expect(matchesSponsorshipMode(unstated, "licensed")).toBe(true);
    expect(matchesSponsorshipMode(unstated, "explicit")).toBe(false);
  });
});
