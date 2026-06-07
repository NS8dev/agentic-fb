# Fabrixa Studio - Project Overview

Fabrixa Studio is a high-performance, web-based 3D garment and textile design platform. It enables users to create 2D patterns, apply them to 3D garment models in real-time, and utilize AI-driven tools for design generation.

## 🚀 Technology Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (Full-stack React 19)
- **Routing & Data:** [TanStack Router](https://tanstack.com/router) & [TanStack Query](https://tanstack.com/query)
- **3D Engine:** [Three.js](https://threejs.org/) via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) and [@react-three/drei](https://github.com/pmndrs/drei)
- **2D Editor:** [Fabric.js](http://fabricjs.com/) for canvas-based textile design
- **Backend & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Payments:** [Razorpay](https://razorpay.com/)
- **Runtime/Hosting:** Cloudflare Workers (via `wrangler`) & Bun

## 📂 Project Structure

- `src/components/fabrixa/`: Core application UI components (AI Studio, Fabric Editor, 3D Preview).
- `src/components/ui/`: Reusable primitive UI components based on Radix UI and Tailwind.
- `src/lib/fabrixa/`: Business logic, asset catalogs, state management, and utility functions.
- `src/routes/`: TanStack Router file-based routes.
- `src/assets/models/`: 3D garment assets (`.glb` files).
- `supabase/migrations/`: Database schema and migrations.
- `wrangler.jsonc`: Cloudflare Workers configuration.

## 🛠️ Building and Running

The project uses **Bun** as the primary package manager and runtime.

### Development

```bash
bun install
bun run dev
```

### Build & Production

```bash
bun run build
# Preview build
bun run preview
```

### Linting & Formatting

```bash
bun run lint
bun run format
```

## 📐 Development Conventions

### Coding Style

- **TypeScript:** Strict typing is preferred. Avoid `any`.
- **Components:** Functional components with Hooks. Use PascalCase for filenames.
- **Logic:** Business logic should reside in `src/lib/fabrixa/` to keep components clean.
- **State:** Use Zustand for global application state (subscriptions, credits). Use local state or TanStack Query for component-specific/server data.

### 3D Asset Management

- Garments are defined in `src/lib/fabrixa/garments.ts` and `src/lib/fabrixa/garmentCatalog.ts`.
- Each garment maps GLB mesh nodes to editable "parts" (e.g., body, sleeves).
- Procedural fallbacks should be handled in the loader if a model is missing.

### Authentication & Gating

- Authentication is handled via Supabase and managed through `src/lib/fabrixa/authStore.ts`.
- Feature gating (based on subscription tiers/credits) is enforced via `src/lib/fabrixa/runGated.ts` and `src/lib/fabrixa/planAccess.ts`.

### Styling

- Adhere to the established Tailwind 4 utility patterns.
- Theming is supported via `src/lib/fabrixa/themes.ts` and `next-themes`.

---

_This GEMINI.md file is a living document and should be updated as the project evolves._
