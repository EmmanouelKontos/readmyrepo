# RepoAtlas — Architecture, Security & AI Context Intelligence

**RepoAtlas** is a zero-server, 100% client-side static repository intelligence workspace that transforms any GitHub repository (public or private) or local workspace folder into an interactive **AST Dependency Graph**, **16-Rule Forensic Security & Performance Audit**, and **1-Click `AGENTS.md` + Master Refactoring Blueprint**.

---

## Key Capabilities

- **Universal Multi-Language AST Dependency Graph**:
  - Resolves cross-file module dependencies across **TypeScript / JavaScript** (ESM, CommonJS, tsconfig aliases, `.js` → `.ts` resolution), **Python**, **Rust** (`mod` / `use crate::`), **C11 / C++** (`#include "..."`), **Chrome Extensions (Manifest V3)** (`manifest.json` → service worker & content scripts), and **Tauri v2 Desktop Apps** (Frontend `invoke('cmd')` → Rust `#[tauri::command]`).
  - Interactive SVG canvas with pan/zoom, radial 1-hop dependency spotlight, topological layer grouping, and circular dependency cycle highlighting (2-hop & 3-hop DFS cycle detection).
- **16-Rule Forensic Static Analysis Engine**:
  - Comment-stripped scanning across **8 Security Rules** (`SEC-001` through `SEC-008`), **6 Performance Rules** (`PERF-001` through `PERF-006`), and **3 Architectural Rules** (`ARCH-001` God Module `>220 LOC`, `ARCH-002` Circular Dependency Cycle, `ARCH-003` Upward Layer Inversion).
- **Live In-Browser Remediation & Score Delta Tracking**:
  - Inspect any module in the **Live Code Inspector**, apply a 1-click **"Simulate AI Fix & Re-Scan"** or edit code directly, and watch Architecture, Security, Performance, and Token Footprint deltas update in real time.
- **Persistent Pinned Projects (Two-Tier Browser Cache)**:
  - Pin any scanned repository to store lightweight metadata in `localStorage` and full file snapshots in **IndexedDB** (`repo-atlas-idb-v1`) for instant offline reload and baseline score comparison.
- **Zero-Trust Privacy & Private Repository Support**:
  - Fine-grained GitHub Personal Access Tokens (`github_pat_...` / `ghp_...`) are held strictly in volatile React memory (`credentials: 'omit'`), validated against strict format and outbound host allowlists (`api.github.com`, `raw.githubusercontent.com`, `ungh.cc`), and never persisted to disk.

---

## Local Development

```bash
# Install dependencies
bun install

# Start local development server
bun run dev

# Run the 14-suite forensic & self-audit test suite
bun test

# Build production bundle
bun run build
```

---

## Deploying to Cloudflare Pages

RepoAtlas is a pure static SPA with pre-configured Cloudflare Pages headers (`public/_headers`) and SPA routing (`public/_redirects`):

```bash
bun run build
bunx wrangler pages deploy dist --project-name repo-atlas
```
