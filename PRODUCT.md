# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Job seekers who want the rigor of the upstream AI Job Search workflow without operating it from a terminal. The primary user imports an existing CV, reviews job matches, and produces truthful application material from a desktop interface on macOS or Windows.

## Product Purpose

AI Job Search Studio turns a candidate's existing resume into a structured, reusable source profile, finds and evaluates roles, and creates job-specific application documents. Success means the user can trace every score and generated claim back to the candidate profile and job description, then export ATS-readable PDFs that pass the upstream verification rules.

## Positioning

The product keeps the local, file-based, auditable workflow of `ai-job-search-dev/ai-job-search` and adds a desktop operating interface. The uploaded resume supplies both the factual candidate backbone and the default LaTeX document structure. AI is used selectively for extraction, relevance ranking, and rewriting; deterministic code owns validation, scoring evidence, file safety, and PDF checks.

## Operating Context

Users work from a local repository containing profile data, job-search state, LaTeX templates, generated documents, and the upstream command specifications. The app runs locally in a desktop window or browser. Internet access is optional except for live job searches, cloud AI providers, and explicitly selected remote services.

## Capabilities and Constraints

- Import `.pdf`, `.tex`, `.txt`, and `.md` resumes and review the parsed result before it becomes the active profile.
- Preserve the source resume and a reusable LaTeX backbone for future application documents.
- Evaluate jobs with the canonical eligibility, language, technical, experience, behavioral, location, and career-alignment rules.
- Show an evidence-based ATS analysis with matched requirements, supported gaps, gates, and score provenance.
- Tailor CV and cover-letter content to the complete job description without fabricating claims.
- Keep the built-in LinkedIn and direct-employer ATS searches active, with optional supplemental feeds from Reed, CV-Library, Adzuna, Jobicy, Arbeitnow, Remotive, and Google Jobs through a configured provider.
- Distinguish an employer found on the GOV.UK sponsor register from a vacancy that explicitly states sponsorship is available.
- Compile locally when a supported LaTeX engine is installed; never upload personal documents to a third-party compiler without explicit consent.
- Verify page count, layout, and extractable PDF text before marking documents ready.
- Work on macOS and Windows. Native packaging may differ, but profile, search, analysis, generation, and export behavior must remain the same.
- Keep candidate data local by default and excluded from version control.

## Brand Commitments

The product name is AI Job Search Studio. The tone is calm, direct, and specific. Pip, the upstream courier bird asset, may appear as a restrained empty-state or onboarding mark but not as repeated decoration.

## Evidence on Hand

- Canonical workflow and profile specifications under `.claude/`.
- Portal search skills under `.agents/skills/`.
- Upstream project behavior and documentation from `https://github.com/ai-job-search-dev/ai-job-search`.
- Existing web UI under `app/public/` and macOS wrapper under `native_app/`.
- Resume templates in `cv/` and `cover_letters/`.
- Existing Python workflow tests under `tests/`.
- No verified customer testimonials, benchmark claims, or hiring-success metrics for this fork.

## Product Principles

- Candidate facts are immutable evidence; tailoring changes emphasis and wording, not history.
- Every score explains itself.
- Local processing is the default and external transmission is explicit.
- The interface reveals complexity when it helps a decision and stays quiet during routine work.
- Generated documents are not ready until the rendered PDF and ATS text layer have been checked.

## Accessibility & Inclusion

The desktop interface must support keyboard-only use, visible focus, semantic labels, 200% zoom, reduced motion, light and dark system appearances, and WCAG AA contrast. Layout must remain usable in narrow Windows and macOS window sizes.
