# RepoAtlas — Architecture, Security & AI Context Intelligence

**RepoAtlas** is a zero-server, 100% client-side static repository intelligence workspace that transforms any GitHub repository (public or private) or local workspace folder into an interactive **AST Dependency Graph**, **16-Rule Forensic Security & Performance Audit**, and **1-Click `AGENTS.md` + Master Refactoring Blueprint**.

---

## Key Capabilities

- **Multi-Language Dependency Graph**:
  - Resolves cross-file dependencies across **TypeScript / JavaScript** (ESM, CommonJS, tsconfig aliases, `.js` → `.ts`, barrel re-exports), **Python** (relative and absolute imports, submodule vs. package `__init__`), **Go** (`go.mod` module paths plus symbol-level links between files of one package), **Rust** (`mod`, grouped `use crate::{…}`, `super::` / `self::`), **C / C++** (`#include`), **Chrome Extensions (MV3)** (`manifest.json` → service worker & content scripts) and **Tauri v2** (`invoke('cmd')` → `#[tauri::command]`).
  - Type-only imports (explicit `import type` *and* bindings TypeScript erases because they are only used as types) are kept out of cycle detection, so reported cycles are runtime cycles.
  - Large repositories are sampled by directory, then the sample is completed with the hub modules it imports (shared headers, utils, base classes) so the graph stays connected.
  - Interactive SVG map with zoom, layer lanes that wrap busy layers into columns, 1-hop dependency spotlight and cycle highlighting (Tarjan SCC).
- **Static Analysis Engine**:
  - Comment-aware scanning with **8 Security Rules** (`SEC-001`–`SEC-008`), **6 Performance Rules** (`PERF-001`–`PERF-006`) and **3 Architecture Rules** (`ARCH-001` oversized module — 220 code lines for UI components, 400 for logic modules, 800 for C/C++/Rust/Go; `ARCH-002` circular dependency; `ARCH-003` upward layer inversion).
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

# Run the analyzer test suite
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
