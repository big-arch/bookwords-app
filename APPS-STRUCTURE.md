# Two Independent Applications

This repository contains **two completely separate applications**. They share GitHub repository infrastructure but are designed as independent projects.

## BookWords
- **Location:** Root directory (`/`)
- **Files:** `index.html`, `script.js`, `styles.css`, `sw.js`, `manifest.webmanifest`
- **Purpose:** Personal English vocabulary learning app
- **Published:** https://big-arch.github.io/bookwords-app/
- **Data Storage:** Supabase (optional sync), localStorage (device storage)
- **Status:** Production, active development

## BIM Academy
- **Location:** `/bim/` directory
- **Files:** `bim/index.html`, `bim/app.js`, `bim/styles.css`, `bim/sw.js`, `bim/manifest.webmanifest`
- **Purpose:** Mobile learning app for BIM/ТИМ, Revit, Navisworks, AutoCAD, Civil 3D
- **Published:** https://big-arch.github.io/bookwords-app/bim/
- **Data Storage:** localStorage only (local device progress)
- **Status:** Production, complete

## Independence

Both applications are **completely independent**:
- No shared code (separate index.html, JS, CSS)
- Separate service workers (`sw.js` for BookWords, `bim/sw.js` for BIM Academy)
- Separate localStorage keys (`bookwords-state-v1` vs `bim-academy-state-v1`)
- Separate PWA manifests with unique cache keys
- Different branch: BIM Academy developed on `claude/bim-learning-app-wtjg6z`

## Future: Separate Repositories

For true application independence, each should eventually have its own repository:
- `bookwords-app` → BookWords only
- `bim-learning-app` → BIM Academy only

Each with:
- Independent publishing/deployment pipelines
- Own domains or subdomains
- Separate branches and version control history

## Branch Strategy

- **`main`**: BookWords production (stable)
- **`claude/bim-learning-app-wtjg6z`**: BIM Academy development (before separation)

Once separated into different repositories, each will have its own main branch.
