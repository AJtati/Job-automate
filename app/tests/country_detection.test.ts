import { describe, expect, test } from "bun:test";
import { detectCandidateCountry } from "../job_sources";

describe("International Multi-Country Detection", () => {
  test("detects Germany from location and targetLocations", () => {
    const res1 = detectCandidateCountry("Berlin, Germany");
    expect(res1.countryName).toBe("Germany");
    expect(res1.freehireCode).toBe("DE");
    expect(res1.isUk).toBe(false);

    const res2 = detectCandidateCountry("Munich", ["Frankfurt", "Hamburg"]);
    expect(res2.countryName).toBe("Germany");
    expect(res2.freehireCode).toBe("DE");
  });

  test("detects India from location and targetLocations", () => {
    const res1 = detectCandidateCountry("Bangalore, India");
    expect(res1.countryName).toBe("India");
    expect(res1.freehireCode).toBe("IN");
    expect(res1.isUk).toBe(false);

    const res2 = detectCandidateCountry("Hyderabad", ["Mumbai", "Pune"]);
    expect(res2.countryName).toBe("India");
    expect(res2.freehireCode).toBe("IN");
  });

  test("detects United States from location and targetLocations", () => {
    const res1 = detectCandidateCountry("Austin, Texas, United States");
    expect(res1.countryName).toBe("United States");
    expect(res1.freehireCode).toBe("US");
    expect(res1.isUk).toBe(false);

    const res2 = detectCandidateCountry("New York", ["San Francisco", "Seattle"]);
    expect(res2.countryName).toBe("United States");
    expect(res2.freehireCode).toBe("US");
  });

  test("detects France, Canada, Australia, and Netherlands", () => {
    expect(detectCandidateCountry("Paris, France").freehireCode).toBe("FR");
    expect(detectCandidateCountry("Toronto, Canada").freehireCode).toBe("CA");
    expect(detectCandidateCountry("Sydney, Australia").freehireCode).toBe("AU");
    expect(detectCandidateCountry("Amsterdam, Netherlands").freehireCode).toBe("NL");
  });

  test("defaults to United Kingdom when location is in UK or unstated", () => {
    const res1 = detectCandidateCountry("London, United Kingdom");
    expect(res1.countryName).toBe("United Kingdom");
    expect(res1.freehireCode).toBe("GB");
    expect(res1.isUk).toBe(true);

    const res2 = detectCandidateCountry(undefined, []);
    expect(res2.countryName).toBe("United Kingdom");
    expect(res2.freehireCode).toBe("GB");
    expect(res2.isUk).toBe(true);
  });
});

describe("Multilingual Language Detection and Localized Resumes", () => {
  const { detectLanguageDeterministically, createLocalizedBackbone, renderTailoredResume, renderGroundedCoverLetter } = require("../resume_engine");
  const { AIService } = require("../ai_service");

  test("detects German, Spanish, French, and English from resume text", () => {
    const deText = "Berufserfahrung: Senior Cloud Architect in Berlin, Deutschland. Ausbildung: Technische Universität München.";
    expect(detectLanguageDeterministically(deText)).toBe("de");

    const esText = "Experiencia laboral: Desarrollador Backend con conocimientos en AWS y Docker. Educación y formación académica.";
    expect(detectLanguageDeterministically(esText)).toBe("es");

    const frText = "Expérience professionnelle: Ingénieur DevOps et Cloud à Paris. Compétences techniques et formation.";
    expect(detectLanguageDeterministically(frText)).toBe("fr");

    const enText = "Work experience: Senior Cloud Infrastructure Engineer based in London, UK. Core technical skills.";
    expect(detectLanguageDeterministically(enText)).toBe("en");
  });

  test("generates localized LaTeX backbones with proper babel and section titles", () => {
    const deBackbone = createLocalizedBackbone("de");
    expect(deBackbone).toContain("[ngerman]{babel}");
    expect(deBackbone).toContain("\\section{Profil}");
    expect(deBackbone).toContain("\\section{Berufserfahrung}");
    expect(deBackbone).toContain("\\section{Kenntnisse und Fähigkeiten}");
    expect(deBackbone).toContain("\\section{Ausbildung}");

    const esBackbone = createLocalizedBackbone("es");
    expect(esBackbone).toContain("[spanish]{babel}");
    expect(esBackbone).toContain("\\section{Perfil Profesional}");
    expect(esBackbone).toContain("\\section{Experiencia Laboral}");
    expect(esBackbone).toContain("\\section{Habilidades Técnicas}");
    expect(esBackbone).toContain("\\section{Educación}");

    const enBackbone = createLocalizedBackbone("en");
    expect(enBackbone).toContain("[english]{babel}");
    expect(enBackbone).toContain("\\section{Summary}");
    expect(enBackbone).toContain("\\section{Work Experience}");
  });

  test("renders tailored resume in German with localized date and section headings", () => {
    const mockProfile = {
      id: "test_de_candidate",
      name: "Max Mustermann",
      headline: "Senior Cloud Engineer",
      location: "Munich, Germany",
      email: "max@example.de",
      phone: "+49 170 1234567",
      targetRoles: ["Cloud Engineer"],
      targetLocations: ["Munich"],
      preferredLanguage: "de",
      skills: {
        cloud: ["AWS", "Azure"],
        containers: ["Docker", "Kubernetes"]
      },
      experience: [
        {
          company: "BMW Group",
          role: "Cloud Infrastructure Architect",
          location: "München, Deutschland",
          startDate: "2020",
          endDate: "Present",
          bullets: ["Entwicklung skalierbarer Kubernetes-Cluster auf AWS."]
        }
      ],
      education: [
        {
          degree: "Master of Science Informatik",
          institution: "TU München",
          startDate: "2015",
          endDate: "2018"
        }
      ]
    };

    const mockJob = {
      company: "Siemens AG",
      role: "Senior Cloud Platform Engineer",
      location: "Munich, Germany",
      keySkills: ["AWS", "Kubernetes", "Docker"]
    };

    const mockAnalysis = {
      overallScore: 92,
      verdict: "Strong fit",
      matchedKeywords: ["AWS", "Kubernetes", "Docker"],
      requirements: []
    };

    const deCv = renderTailoredResume(mockProfile, mockJob, mockAnalysis, "Erfahrener Cloud Engineer mit Expertise in AWS und Kubernetes.", "de");
    expect(deCv).toContain("[ngerman]{babel}");
    expect(deCv).toContain("\\section{Berufserfahrung}");
    expect(deCv).toContain("Heute"); // Replaces 'Present' with 'Heute'
    expect(deCv).toContain("BMW Group");
  });

  test("AIService.detectCountryAndLanguage resolves country, currency, and language", async () => {
    const aiService = new AIService();
    const resultDe = await aiService.detectCountryAndLanguage({
      location: "Berlin, Germany",
      text: "Berufserfahrung als Software-Entwickler in München."
    });

    expect(resultDe.countryName).toBe("Germany");
    expect(resultDe.freehireCode).toBe("DE");
    expect(resultDe.adzunaCode).toBe("de");
    expect(resultDe.currency).toBe("€");
    expect(resultDe.language).toBe("de");

    const resultIn = await aiService.detectCountryAndLanguage({
      location: "Bangalore, India",
      text: "Software development engineer with 5 years experience."
    });

    expect(resultIn.countryName).toBe("India");
    expect(resultIn.freehireCode).toBe("IN");
    expect(resultIn.currency).toBe("₹");
    expect(resultIn.language).toBe("en");
  });
});
