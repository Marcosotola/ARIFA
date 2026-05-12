# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run dev-safe     # Start dev server (Webpack fallback if Turbopack issues)
npm run build        # Production build
npm run lint         # ESLint
```

No test suite exists. Verify changes by running the dev server and testing in browser.

## Stack

- **Next.js 16.2.1** (App Router, "use client" everywhere in admin), React 19, TypeScript 5
- **Firebase 12**: Firestore, Auth (email/password + Google OAuth), Storage, FCM
- **Styling**: Inline styles as the default pattern + global utility classes in `src/app/globals.css`
- **PDF**: jsPDF + jspdf-autotable — all generators live in `src/lib/pdfGenerator.ts`, lazy-imported
- **Icons**: lucide-react
- **Charts**: recharts
- **Signatures**: react-signature-canvas

## Architecture

### Auth & Role Flow

`src/app/admin/layout.tsx` is the root guard for all `/admin/*` routes. On mount it:
1. Listens to `onAuthStateChanged` → redirects to `/login` if unauthenticated
2. Fetches `usuarios/{uid}` from Firestore → reads `rol` field
3. Subscribes to `configuracion/suscripcion` (real-time) → blocks expired accounts

Roles in ascending privilege: `cliente` → `tecnico` → `secretaria` → `admin` → `superadmin`.
The pattern `isAdmin = rol === "admin" || rol === "superadmin"` is used throughout pages.
`isReadOnly = rol === "cliente"` suppresses all write actions.

### Admin Panel Layout

The sidebar is built into `src/app/admin/layout.tsx` (not a separate component). It renders different nav items per role. All admin pages are full `"use client"` components — they fetch their own data inside `useEffect` on mount, not via server components or `getServerSideProps`.

### Firebase Access Pattern

```ts
import { db, auth, storage } from "@/lib/firebase";
```

`src/lib/firebase.ts` exports `auth`, `db`, `storage`, and `isFirebaseConfigured` (graceful degradation if env vars missing). Server-side operations use `src/lib/firebase-admin.ts`.

### Storage Cleanup Rule

**When deleting a Firestore document that has uploaded files, always delete the Storage files first.** Iterate the URL array field, call `deleteObject(ref(storage, url))` per file in a try/catch, then call `deleteDoc`. See `src/app/admin/certificados/page.tsx` `handleDelete` for the canonical example.

### PDF Generation

All PDF functions are named `generateXxxPDF` and exported from `src/lib/pdfGenerator.ts`. Pages lazy-import jsPDF to avoid SSR issues:
```ts
const { default: jsPDF } = await import("jspdf");
```

### CSS Conventions

CSS variables: `--primary-blue: #002244`, `--primary-red: #A31F1D`, `--text-muted: #777777`, `--border-light: #EEEEEE`.

Global utility classes: `.btn-red`, `.btn-blue`, `.grid-2`, `.grid-3`, `.grid-4`, `.admin-table-wrap`, `.section-padding`.

Prefer inline styles for component-specific layout. Use global classes only for recurring patterns (buttons, grids, table scroll wrapper).

### Key Firestore Collections

| Collection | Purpose |
|---|---|
| `usuarios` | All users; fields: `rol`, `sedes[]`, `perfilCompleto` |
| `configuracion/suscripcion` | Subscription state; `estado`, `vencimiento` |
| `configuracion/presupuestos` | `proximoNumero` auto-increment |
| `configuracion/recibos` | `proximoNumero` auto-increment |
| `ordenes_trabajo` | Inspection OTs; field `fotos[]` for Storage URLs |
| `certificados` | Field `fotos[]` for Storage URLs |
| `hys_documentos` | HyS records; field `imagenes[]` for Storage URLs |
| `productos` | Field `imagenes[]` for Storage URLs |
| `presupuestos`, `recibos`, `remitos` | Document hub |
| `remitos_matafuegos`, `mantenimiento_matafuegos`, `matafuegos_activos` | Fire extinguisher module |

### Auto-increment Numbers

Documents that need sequential numbering (presupuestos, recibos, etc.) store the next number in `configuracion/{colección}` → `proximoNumero`. Read it in a transaction before saving.

### Client Search Pattern

Pages with client pickers use a search input (minimum 2 characters) that queries the `usuarios` collection and renders a dropdown. The selected client's `id`, `nombre`, and `sedes[]` are stored in local state. New-client modals always include an inline Sedes section (add/remove rows).
