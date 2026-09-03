# LGN Platform Frontend

This is the React + TypeScript + Vite frontend for the LGN platform.

## Setup & Running Locally

### Local Development (inside Docker)
The simplest way to run both the frontend and backend is using Docker Compose. 

Please see the [Root README](../README.md) for full Docker Compose instructions and commands.

### Local Node Environment (without Docker)
If you prefer running outside Docker, you can install dependencies and run the Vite dev server locally:

```bash
npm install
npm run dev
```

---

## URL Parameters & Developer Debug Options

### 1. Theme Options & URL Parameters

| Trigger / Parameter | Action / Result | Notes |
| :--- | :--- | :--- |
| **Default Theme** | Light Theme (`HOME LIGHT` spec) | `#f5f5f5` bg, `#000000` text, black registered logo |
| **`?theme=dark`** | Force Dark Theme | Activates dark theme via URL parameter |
| **`?dark=true`** | Force Dark Theme | Alternative URL flag |
| **`?dark=1`** | Force Dark Theme | Alternative URL flag |
| **`?theme=light`** | Force Light Theme | Overrides saved local preference |
| **`?debug=true`** / **`?dev=true`** | Enable Debug Buttons | Unhides floating dev buttons on production URLs |
| **Floating Dev Toggle** | **`[ ☀️ Theme: Light / Dark ]`** | Button at bottom-right corner; saves choice to `localStorage` |
| **`?geme=tuning`** / **`?tune=geme`** | Open the Geme Tuning panel | Also reachable from the **`[ 🧪 Geme Tuning ]`** floating button. Only appears when the backend reports `GEME_DEBUG`, which is local development only — see the [Geme section of the root README](../README.md#tuning-gemes-persona-local-only). Edits are kept in `localStorage` under `lgn_geme_tuning`. |

### 2. Direct View Navigation

Since routing is plain `useState` (no router/URL paths), these params set the initial view/sub-view so a specific screen can be linked to directly for QA or screenshotting instead of clicking through nav:

| Parameter | Values | Notes |
| :--- | :--- | :--- |
| **`?view=`** | `home` \| `capsule` \| `timeline` \| `about` \| `invest` \| `contact` \| `submit-film` | Sets the initial top-level view. Invalid/missing values fall back to `home`. |
| **`?sub=`** | `mission-vision` \| `purpose` \| `board-staff` | Sets the initial About sub-view. Only relevant when `view=about`. |
| **`?action=`** | `reflect` \| `discuss` \| `practice` \| `gather` | Jumps straight into a Capsule sub-page (Reflect/Discuss/Practice). Only relevant when `view=capsule`. |

Example: `?view=capsule&action=discuss` opens the Discuss guide directly. These only set initial state — in-app navigation (clicking nav links/buttons) still works normally and does not update the URL.

### 3. Interactive Grid Overlay

- **Keyboard Shortcut**: Press **`Ctrl + G`** (or **`Alt + G`**) anywhere on the page to toggle grid overlay guides.
- **Floating Button**: Click **`[ 🌐 Grid Overlay ON / OFF ]`** at the bottom-right corner.
- **URL Parameter**: **`?grid=true`** turns it on for the initial render — combine with `?view=` (above) to link directly to a specific page with the overlay already showing.
- **Scoping**: the overlay renders *inside* the current page's own wrapper element (e.g. `.home-view-wrapper`, `.about-container`), so its columns/rows always match that page's real rendered box — not a separate guess spanning header-to-footer. Column/row counts differ by page: Home uses the 12-col/6-row grid, all other pages use 6-col/3-row.
- **Grid Specifications**:
  - **`Col 1 (Sidebar)`**: Cyan guide starting at `40px`.
  - **`Col 2 (Spacer)`**: Buffer column.
  - **`Col 3 (Body Start)`**: Green guide starting at `664px` (`1216px` body width across Cols 3–6).
  - **`Cols 4–6`**: Red grid bounds with `32px` column gutters.

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.


Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
