# QWEN.md – Project Overview

## Project Overview

Fabrixa Studio is a **React‑TypeScript web application** built with Vite and the **TanStack Start** framework. The app leverages a rich UI component ecosystem (Radix UI, TailwindCSS, React‑Three‑Fiber, Fabric.js, Supabase, etc.) to provide an interactive design and editing experience for fashion or garment‑related workflows.

Key technologies include:

- **React 19** with functional components and hooks
- **TypeScript 5** for static typing
- **Vite** as the dev server / bundler
- **TanStack Router & React‑Query** for routing and data fetching
- **TailwindCSS** for styling and utility‑first CSS
- **Fabric.js** (via a custom alias) for canvas‑based editing
- **Supabase** client for backend services
- **Three.js** integration via `@react-three/fiber` and `@react-three/drei`
- **Netlify** deployment integration (`@netlify/vite-plugin-tanstack-start`)

The repository follows a monorepo‑style layout with most source files under `src/` (e.g., `src/components/fabrixa/`). The `package.json` defines scripts for development, building, previewing, linting, and formatting.

## Building, Running & Testing

| Action                       | Command                                        | Description                                                                                                             |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Start development server** | `npm run dev`                                  | Launches Vite dev server (accessible on the network – `--host`).                                                        |
| **Build for production**     | `npm run build`                                | Generates optimized production assets using Vite.                                                                       |
| **Preview production build** | `npm run preview`                              | Serves the built assets locally (useful for testing the final bundle).                                                  |
| **Lint**                     | `npm run lint`                                 | Runs ESLint over the entire codebase.                                                                                   |
| **Format**                   | `npm run format`                               | Formats all files with Prettier.                                                                                        |
| **Run tests**                | _(No test script defined – add one as needed)_ | Currently the repo does not ship a test runner; you may add a script such as `"test": "vitest"` if Vitest is installed. |

> **Note:** The `dev` script uses `vite dev --host`, which exposes the dev server to the local network. Ensure firewall rules allow this if you need remote access.

## Development Conventions

- **File Structure**: Source code lives under `src/`. UI components are grouped by feature, e.g., `src/components/fabrixa/`.
- **Styling**: TailwindCSS utilities are used throughout; custom classes are defined in `tailwind.config.js` (not shown here).
- **State Management**: The app relies on **React Query** for asynchronous data fetching and **Zustand** for client‑side state.
- **Form Handling**: `react-hook-form` together with `@hookform/resolvers` and `zod` for schema validation.
- **Linting/Formatting**: ESLint (`npm run lint`) and Prettier (`npm run format`) are enforced.
- **Aliases**: Vite config defines aliases for `fabric` and `firebase/firestore` to point directly at the bundled ESM builds.
- **Testing**: No test framework is currently configured; when adding tests, follow the project's TypeScript conventions and consider using **Vitest** or **Jest** with `tsx` support.

## Key Scripts (from `package.json`)

```json
"scripts": {
  "dev": "vite dev --host",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview --host",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

## Important Files & Directories

- `package.json` – project metadata, dependencies, and npm scripts.
- `vite.config.ts` – Vite configuration, including custom aliases and plugin setup.
- `tsconfig.json` – TypeScript compiler options.
- `src/` – Main application source (components, routes, hooks, utilities).
- `components.json` – Likely a catalog of UI components used by the editor.
- `admin.json`, `APP_DATA_0.json` – Application‑specific configuration/data files.
- `test_fabric.ts` – Simple sanity check that imports Fabric.js and logs an exported class.
- `.prettierrc`, `.prettierignore`, `.eslintrc*` – Formatting and linting configuration.

## How to Contribute

1. **Clone the repo** and run `npm install` (or `bun install` if you prefer Bun).
2. **Start the dev server** with `npm run dev`.
3. Follow the existing code style (Tailwind, ESLint, Prettier).
4. When adding new features, place related components under an appropriate feature folder in `src/components/`.
5. Run `npm run lint && npm run format` before committing.

---

_Generated by Qwen Code on 2026‑06‑06._
