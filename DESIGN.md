---
name: Job Search Studio
description: A restrained evidence-first workspace for grounded job applications.
colors:
  proof-blue: "#315efb"
  deep-ink: "#172033"
  canvas: "#f4f6f9"
  paper: "#ffffff"
  quiet-surface: "#f7f8fa"
  divider: "#dfe4ec"
  secondary-text: "#667085"
  evidence-green: "#147d52"
  gap-amber: "#b85c00"
  error-red: "#b42318"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 750
    lineHeight: 1.45
    letterSpacing: "0.09em"
rounded:
  control: "8px"
  item: "10px"
  surface: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.proof-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "32px"
  requirement-item:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.item}"
    padding: "10px 11px 10px 34px"
---

# Design System: Job Search Studio

## Overview

**Creative North Star: "Evidence Thread"**

The product should feel like a precise review desk: dense enough for real comparison work, calm enough to sustain it, and explicit about where every claim comes from. Brand character lives in exact hierarchy, the proof-blue evidence connection, and disciplined status color rather than decorative effects.

The visual anti-reference is a generic AI dashboard: no glowing gradients, glass cards, floating marketing tiles, emoji controls, or inflated claims. The interface follows familiar desktop navigation and editing conventions while adapting cleanly to browser windows on macOS and Windows.

**Key Characteristics:**

- Evidence remains visually adjacent to decisions.
- Pale working surfaces sit inside a deep-ink navigation frame.
- Color communicates proof, gaps, success, and failure sparingly.
- System typography and appearance preserve platform familiarity.

## Colors

Proof Blue is the only action accent. Deep Ink anchors navigation and document text; green confirms evidence, amber marks gaps, and red is reserved for real failures.

**The Evidence Color Rule.** Blue connects a selected requirement to its source; it never decorates unrelated surfaces.

## Typography

**Display Font:** System sans-serif with Segoe UI fallback  
**Body Font:** System sans-serif with Segoe UI fallback  
**Document Font:** Georgia for the candidate name only

The shell uses compact platform typography for scanning. Uppercase labels are rare, small, and strongly tracked; document content uses conventional resume hierarchy.

## Layout

Desktop uses a fixed navigation rail and a three-pane workspace for job list, requirements, and application output. At 940px and below, the workspace becomes one pane at a time with explicit Jobs, Requirements, and Studio tabs. At 600px, header actions compact but remain reachable.

Spacing follows an 8px base rhythm with 16–24px working-area insets. Scrolling belongs to each pane on desktop and the active pane on narrow screens.

## Elevation & Depth

The shell is flat and separated by tonal surfaces and one-pixel dividers. Shadows are limited to document paper, dialogs, and transient toasts where physical layering has meaning.

**The Flat Workspace Rule.** Work panes do not float; content hierarchy, borders, and tone establish structure.

## Shapes

Controls use gently curved 8px corners, list items 10px, and major transient surfaces 12–14px. Pills are reserved for filters and compact status labels. Circular shapes are limited to evidence/status dots.

## Components

### Buttons

Primary buttons use Proof Blue with white text. Secondary buttons use paper with a visible divider border. Every control has a visible keyboard focus ring and a minimum 29–32px desktop height.

### Chips

Filter chips use a bordered pill. Selection adds a pale blue fill and blue text; semantic status chips use words as well as color.

### Cards / Containers

Job and requirement items are list rows, not decorative cards. They sit flat by default and gain a tinted fill or proof-blue stroke only when selected.

### Inputs / Fields

Fields use quiet surfaces, divider borders, 8px corners, and a blue focus border with a soft focus ring. Error feedback is direct and remains visible in the toast region.

### Navigation

The deep-ink rail uses text plus line icons. The active item receives a restrained lighter fill and blue leading marker. Mobile navigation uses a familiar menu and workspace tab row.

### Evidence Thread

The selected requirement is connected to the current document evidence with a thin dashed proof-blue Bézier line and endpoint dots. It disappears when panes are no longer simultaneous.

## Do's and Don'ts

### Do:

- **Do** keep requirements, gates, score provenance, and supporting evidence inspectable.
- **Do** use status words alongside green, amber, or red.
- **Do** honor system dark mode, reduced motion, and increased contrast.

### Don't:

- **Don't** use gradients, glass effects, emoji icons, or ornamental floating panels.
- **Don't** hide unsupported requirements or make AI confidence look like verified evidence.
- **Don't** turn every group into a rounded card; preserve the desktop-tool hierarchy.
