# ⚡ AI Job Search Studio & Agentic Career Assistant

> **A native macOS & web-based AI recruitment workstation that runs locally on your machine.**  
> Features real-time job scraping, multi-candidate profiles, automatic model recommendation, and humanized ATS-compliant LaTeX CV/Cover Letter generation.

---

## 🌟 Highlights

- **🍏 Native macOS Apple Design System:** Beautiful 3-pane workstation with dark mode, frosted glass surfaces, real-time LaTeX PDF preview, and native window controls.
- **⚡ Auto-Select Best & Cheap Model:** Enter your API key or point to local Ollama, then click the *⚡ Auto-Select* button. The app queries live cloud catalogs and automatically chooses the highest-performance, most cost-effective model (e.g., `gpt-4o-mini`, `claude-3-5-haiku`, `qwen2.5-coder:3b`), dynamically updating as cloud providers release new versions.
- **👥 Multi-Candidate Architecture:** Manage multiple candidate profiles (different people, domains, or seniority levels) in a single unified dashboard with 1-click profile switching.
- **🎯 Dynamic Scenarios & AI Assistant:** Natural language scenario prompts ("Moved to Manchester", "Target Lead/Staff roles", "Focus on remote only") dynamically update commute calculations, sponsorship flags, and matching algorithms.
- **📄 Humanized ATS LaTeX Engine:** Direct, active-voice engineering prose that eliminates AI marketing clichés and shallow riders. Produces 100% machine-parsable ATS resumes with PDF generation.
- **🔒 Zero Data Breach Guarantee:** All personal profiles and API keys are kept strictly in local gitignored storage (`data/*.json`). Only clean templates are tracked in Git, ensuring anyone can fork and clone safely.

---

## 🚀 Quick Start (Anyone Can Clone & Run)

### 1. Prerequisites
- **[Bun](https://bun.sh)** (recommended for ultra-fast startup) or Node.js v18+:
  - macOS / Linux / WSL:
    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```
  - Windows (PowerShell):
    ```powershell
    powershell -c "irm bun.sh/install.ps1 | iex"
    ```
- **LaTeX Engine** (optional, needed only to compile `.tex` resumes into PDF):
  - macOS: `brew install --cask mactex-no-gui` or `brew install basictex`
  - Linux (Ubuntu/Debian): `sudo apt install texlive-latex-extra texlive-fonts-recommended`
  - Windows: Install [MiKTeX](https://miktex.org/download) or [TeX Live](https://www.tug.org/texlive/)

### 2. Clone and Install
```bash
git clone https://github.com/AJtati/Job-automate.git
cd Job-automate

# Install dependencies (takes ~1 second with Bun)
bun install
```

### 3. Launch the App
```bash
# Start the Studio server (open http://localhost:3333 in any browser)
bun run dev

# Or launch as a standalone desktop window on macOS:
bun run app
```

Visit **http://localhost:3333** in your browser (Chrome, Safari, Edge, Firefox).

---

## 🤖 AI Models: Local & Cloud Options

The app is completely model-agnostic. You can run 100% private, free local models or connect cloud AI keys:

| Provider | Supported Models | Recommended (Fast & Cheap) | Setup |
| :--- | :--- | :--- | :--- |
| **Local Ollama** | Any Ollama model | `qwen2.5-coder:3b` / `llama3.2:3b` | `ollama run qwen2.5-coder:3b` (Free & 100% Private) |
| **OpenAI** | GPT-4o, GPT-4o-mini, o1-mini | `gpt-4o-mini` | Add OpenAI API key in `⚙️ Settings` |
| **Anthropic** | Claude 3.5 Sonnet, Haiku | `claude-3-5-haiku-20241022` | Add Anthropic API key in `⚙️ Settings` |
| **Google Gemini** | Gemini 1.5 Flash, Pro | `gemini-1.5-flash` | Add Gemini API key in `⚙️ Settings` |
| **Groq / OpenRouter** | Llama 3.3 70B, DeepSeek R1 | `llama-3.3-70b-versatile` | Add Provider API key in `⚙️ Settings` |

### ⚡ Auto-Select Best & Cheap Model
In the top-right header, click **⚙️ Settings**:
1. Select your provider (Ollama, OpenAI, Anthropic, Gemini, Groq, OpenRouter).
2. Enter your API key (stored only on your local machine).
3. Click **⚡ Auto-Select Best & Cheap Model**.
4. The studio inspects available models and automatically configures the best balance of speed, cost, and reasoning power for your workload.

---

## 👥 Multi-Candidate Profiles

Manage multiple candidate profiles from the top bar:
- **Switch Profiles:** Click the candidate avatar dropdown in the titlebar to toggle between saved candidate identities.
- **Add New Candidate:** Click `+ Add New Candidate Profile` to create an entry with custom skills, location, target roles, and visa constraints.
- **Edit in Real-Time:** Update home base location, minimum salary target, commute radius, and technical skills anytime via the sidebar editor.

---

## 🍏 Build Native macOS .app & DMG

To package the studio into a distributable, standalone macOS application and DMG installer:

```bash
bun run build:dmg
```

This automated pipeline:
1. Compiles the native Swift Cocoa WebKit binary with full Dock and menu bar support.
2. Generates an Apple-standard high-resolution multi-size `.icns` icon.
3. Packages an installer `.dmg` with an `/Applications` symlink ready for drag-and-drop installation in `dist/AI-Job-Search-Studio.dmg`.

---

## 🔍 Job Portal Scraping CLIs

The repository contains modular portal search skills under `.agents/skills/`:

| Portal | Scope | Command Example |
| :--- | :--- | :--- |
| **LinkedIn** | Global / Multi-country | `bun run .agents/skills/linkedin-search/cli/src/cli.ts search -q "DevOps" -l "London"` |
| **FreeHire** | Multi-market Tech Aggregator | `bun run .agents/skills/freehire-search/cli/src/cli.ts search -q "Platform"` |
| **Jobindex** | Denmark | `bun run .agents/skills/jobindex-search/cli/src/cli.ts search -q "Kubernetes"` |
| **Jobnet** | Danish Public Portal | `bun run .agents/skills/jobnet-search/cli/src/cli.ts search -q "Engineer"` |

---

## 🛡️ Privacy & Security

- **No Personal Data Stored in Git:** Default profiles are loaded from [data/profiles.template.json](data/profiles.template.json).
- **Local Storage Only:** When you create or edit profiles, they are written to `data/profiles.json` and `data/ai_config.json`, which are permanently excluded from Git by [.gitignore](.gitignore).
- **Humanized Resume Writing:** Generated CVs strictly ban robotic boilerplate, forced triads, and shallow marketing jargon.

---

## 🙏 Acknowledgements & Attribution

Special thanks and heartfelt gratitude to **[Mads Lorentzen](https://github.com/MadsLorentzen)** and the open-source contributors of **[ai-job-search](https://github.com/MadsLorentzen/ai-job-search)**.

This project was inspired by and builds upon the pioneering CLI workflow, portal search skills, and career guidance methodologies created in the original `ai-job-search` repository. While **Job-Automate** significantly extends the concept into a full-stack, multi-candidate desktop studio with direct multi-provider AI support and native macOS Apple design, the original conceptual foundation and job scraping protocols established by Mads remain the bedrock of this work.

---

## 📄 License

MIT License. Free for personal and commercial use.

