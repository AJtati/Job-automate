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
- Archives confirmed expired postings separately from application status, keeps applied roles saved, and treats a materially changed repost as a new listing.

## Quick start

### 1. Fork and clone

Forking a public repository creates a public fork. The `/setup` workflow writes personal data into tracked profile files. If you need a private job-search repository, use the private-remote approach in [SETUP.md section 8](SETUP.md#8-pulling-upstream-updates-into-a-private-repository) before running setup.

```bash
gh repo fork ai-job-search-dev/ai-job-search --clone
cd ai-job-search
```

For this extended repository, clone your own fork or working copy instead.

### 2. Install prerequisites

Install [Bun](https://bun.sh) to run the app from source. Source runs can use a local Tectonic or TeX Live installation for PDF generation.

The packaged macOS and Windows apps bundle Bun, PDF.js for PDF resume import, Tectonic for PDF generation, and the LaTeX support files used by the resume and cover-letter templates. Packaged apps do not require Python, Poppler, Swift command-line tools, or a separate TeX installation for those workflows.

JobSpy aggregation remains an optional search source that needs Python with `python-jobspy`. AI rewriting also needs a configured provider key; keys are not included in installers.

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

Expired Postings uses explicit closure signals or passed application deadlines. A posting is not marked expired only because it is old or missing from a later scrape. LinkedIn detail checks are limited to one saved listing per scrape, time out after five seconds, and are cached for seven days; other sources are checked only when their data includes an explicit closure or deadline.

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
Run this from the cloned repository on macOS. The build machine needs Bun, internet access to download the pinned runtimes and LaTeX resources, and Apple Command Line Tools (`xcode-select --install`) for `swiftc` and the macOS packaging utilities. A full Xcode installation is not required.

* Compiles a native Swift Cocoa/WebKit application (`/Applications/AI Job Search Studio.app`) with macOS Dock integration.
* Creates `dist/AI-Job-Search-Studio.dmg` for distribution.
* Builds a universal DMG for Intel and Apple Silicon Macs, with a macOS 13 minimum.
* Bundles Bun, PDF.js, Tectonic, and an offline cache of the LaTeX files used by the supported resume languages.

### Windows Application (Setup EXE and Portable ZIP)
The Windows package includes a Windows Bun runtime, PDF.js, the Windows Tectonic executable, and cached LaTeX support files. The setup installs per-user and stores profile/job data under `%LOCALAPPDATA%\AI Job Search Studio\`.

#### 1. Running the Windows Package
1. Download or extract **`AI-Job-Search-Studio-Windows.zip`**.
2. Double-click **`AI Job Search Studio.cmd`**.
3. The app automatically launches in a dedicated desktop application window (powered by Microsoft Edge App Mode, hiding browser bars and tabs for a native window feel).
4. All candidate data, profiles, and tailored files are preserved in `%LOCALAPPDATA%\AI Job Search Studio\`.
For a regular installer, run `AI-Job-Search-Studio-Setup.exe`; it creates Start Menu shortcuts and can optionally create a desktop shortcut.

#### 2. PDF Import and Generation
PDF resume import and local PDF generation work from the packaged app without separately installing a parser or TeX distribution. The package uses Tectonic locally, so first-use LaTeX downloads are not needed.

#### 3. Building the Windows Package
You can build the Windows distribution from **either Windows or macOS/Linux**:
```bash
# From macOS or Linux (downloads official Windows bun.exe and zips package):
bun run build:windows:sh

# From Windows PowerShell:
bun run build:windows
```
Output: `dist/AI-Job-Search-Studio-Windows.zip` (portable) and, when built on Windows with Inno Setup 6, `dist/AI-Job-Search-Studio-Setup.exe`.

Run either command from the cloned repository after installing Bun. The macOS/Linux script creates only the portable ZIP. On Windows, `bun run build:windows` creates the ZIP and also creates `dist/AI-Job-Search-Studio-Setup.exe` when Inno Setup 6 is installed (`ISCC.exe` on `PATH` or in its default install location). Without Inno Setup, the ZIP is still produced. Runtime assets are version-pinned and SHA-256 checked. Internet access is needed on the build machine to fetch runtimes and prepare the offline TeX cache, but not for first-use PDF generation.

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
