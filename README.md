<p align="center"><img src="assets/mascot/pip_flight_loop.gif" width="144" alt="Pip, the AI Job Search mascot"></p>

# Job Search Studio

A local, evidence-first desktop web app for researching roles, checking fit, and producing grounded LaTeX applications. The interface keeps the job requirement, the matching resume evidence, and the generated document visible in one workspace.

This project extends the workflow in [ai-job-search-dev/ai-job-search](https://github.com/ai-job-search-dev/ai-job-search). It keeps that project’s candidate-first, review-led approach while adding an adaptive UI, a persistent resume backbone, deterministic scoring, and local PDF compilation.

## What it does

- Imports PDF, plain-text, or LaTeX resumes and stores the reviewed result as the canonical candidate profile.
- Creates a reusable LaTeX backbone from that profile.
- Scores full job descriptions with deterministic, evidence-based dimensions and separate eligibility, language, and location gates.
- Shows which resume lines support each job requirement and makes unsupported requirements explicit.
- Tailors resumes and cover letters without inventing employers, qualifications, metrics, or skills.
- Uses AI only for optional constrained rewrites. Matching, gates, and scoring work without a model.
- Compiles PDFs locally with LuaLaTeX or XeLaTeX.
- Runs in current browsers on macOS and Windows, with launchers for each platform.

## Quick start

### 1. Fork and clone

Forking a public repository creates a public fork. The `/setup` workflow writes personal data into tracked profile files. If you need a private job-search repository, use the private-remote approach in [SETUP.md section 8](SETUP.md#8-pulling-upstream-updates-into-a-private-repository) before running setup.

```bash
gh repo fork ai-job-search-dev/ai-job-search --clone
cd ai-job-search
```

For this extended repository, clone your own fork or working copy instead.

### 2. Install prerequisites

Install [Bun](https://bun.sh). PDF output also requires a local TeX distribution:

- macOS: MacTeX or BasicTeX with the required LaTeX packages.
- Windows: MiKTeX or TeX Live, with `lualatex` and `xelatex` available on `PATH`.
- Linux: TeX Live with the extra and recommended font packages.

PDF resume import uses Poppler’s `pdftotext` when available, with Python `pypdf` as a fallback. Plain text and `.tex` imports require neither.

### 3. Run the app

```bash
bun install
bun run dev
```

Open `http://127.0.0.1:3333`.

Platform launchers:

```bash
# macOS or Linux
bun run app
```

```powershell
# Windows PowerShell
bun run app:windows
```

## Recommended workflow

1. Open Candidate and import your current resume.
2. Review the parsed name and contact fields before saving.
3. Select a saved job and add the complete posting if needed.
4. Review eligibility and language gates before considering the score.
5. Select requirements to inspect their source evidence.
6. Tailor the application, review every claim, then build the PDF locally.

The score is not an ATS vendor prediction. It is a transparent internal fit score: technical evidence 30%, experience relevance 25%, behavioral evidence 15%, and career alignment 30%. Location is shown as a gate and does not inflate the number.

## AI use

The built-in mode is deterministic and makes no model call. You can optionally configure Ollama, OpenAI, Anthropic, or Gemini in AI settings. Resume facts remain the source of truth: model output may reorder or rewrite supported material, but it must not add facts.

Cloud providers receive the text required for the requested rewrite. API keys and candidate profiles are stored in gitignored files under `data/`. Review your provider’s privacy terms before enabling a cloud model.

## Privacy

This is local software, not a guarantee against every data leak. Protect the repository like any other folder containing personal documents.

- `data/profiles.json`, `data/ai_config.json`, generated CVs, cover letters, PDFs, and tracker data are ignored by Git.
- PDF extraction and LaTeX compilation run locally.
- The server binds to `127.0.0.1`, not the local network.
- Do not commit personal resumes or API keys. Run the security tests before publishing changes.

## Development

```bash
bun run test:app
bun run check:app
python3 -m unittest tests.test_readme_assets tests.test_onboarding_privacy
```

The broader Python suite requires Python 3.10 or newer.

## Desktop Applications & Packaging

### macOS App (.app & DMG)
```bash
bun run build:dmg
```
* Compiles a native Swift Cocoa/WebKit application (`/Applications/AI Job Search Studio.app`) with macOS Dock integration.
* Creates `dist/AI-Job-Search-Studio.dmg` for distribution.

### Windows Application (Portable Standalone ZIP)
The Windows package is completely self-contained and portable—it bundles the **Bun runtime** (`runtime/bun.exe`) and has **zero external npm dependencies**. The end user does not need to install Bun, Node.js, or Python.

#### 1. Running the Windows Package
1. Download or extract **`AI-Job-Search-Studio-Windows.zip`**.
2. Double-click **`AI Job Search Studio.cmd`**.
3. The app automatically launches in a dedicated desktop application window (powered by Microsoft Edge App Mode, hiding browser bars and tabs for a native window feel).
4. All candidate data, profiles, and tailored files are preserved in `%LOCALAPPDATA%\AI Job Search Studio\`.

#### 2. Optional: PDF Compilation on Windows
To compile LaTeX resumes directly to PDF on Windows, install a LaTeX engine using Windows Package Manager (`winget`):
```powershell
# Recommended: Fast, self-contained modern compiler
winget install Tectonic.Tectonic

# Or full TeX Live / MiKTeX distribution:
winget install MiKTeX.MiKTeX
```
*Alternatively, you can click **"Open Overleaf ↗"** or **"Copy LaTeX"** inside the app to render PDFs online with zero local tools.*

#### 3. Building the Windows Package
You can build the Windows distribution from **either Windows or macOS/Linux**:
```bash
# From macOS or Linux (downloads official Windows bun.exe and zips package):
bun run build:windows:sh

# From Windows PowerShell:
bun run build:windows
```
Output: `dist/AI-Job-Search-Studio-Windows.zip` (portable, ~52 MB compressed).

## Project structure

- `app/` — local HTTP server, deterministic application engine, resume parser, LaTeX renderer, and UI.
- `.claude/` — canonical workflow and candidate-profile specifications.
- `.agents/skills/` — portable portal-search commands.
- `cv/` and `cover_letters/` — local generated application material.
- `documents/` — local supporting records.

## Attribution

Inspired by [ai-job-search-dev/ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) and its contributors. This repository is an independent UI-led extension of that workflow.

## License

MIT.
