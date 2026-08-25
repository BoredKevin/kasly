# kasly

**Author:** [BoredKevin](https://github.com/boredkevin)  
**License:** AGPL-3.0
**Repository:** [https://github.com/boredkevin/kasly](https://github.com/boredkevin/kasly)

---

A modern full-stack web application built with:

- **Frontend:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend & Database:** [Convex](https://convex.dev/)
- **Authentication:** [Convex Auth](https://labs.convex.dev/auth)
- **Icons & UI:** [Lucide Icons](https://lucide.dev/) + [@boredkevin/ui](https://www.npmjs.com/package/@boredkevin/ui)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/boredkevin/kasly.git
   cd kasly
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

   This will start both the Convex backend dev server and Vite frontend.

---

## Available Scripts

- `npm run dev` - Start Convex development environment and Vite dev server.
- `npm run build` - Run type-checking (`tsc -b`) and bundle the frontend for production with Vite.
- `npm run typecheck` - Run TypeScript project build type-check.
- `npm run lint` - Run ESLint checks across TypeScript files.
- `npm run preview` - Preview the production build locally.

---

## Documentation & Guides

- **[Deployment Guide (Cloudflare Pages + Convex)](./docs/DEPLOYMENT.md)** — Production setup, environment variables, SPA routing, and CI/CD.
- **[Backend Architecture & Guides](./docs/backend/README.md)** — RBAC, zero-trust cryptographic treasury ledger, schema, and API reference.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 or later** ([AGPL-3.0](LICENSE)).  
Copyright (C) 2026 BoredKevin.
