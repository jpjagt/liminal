# AGENTS.md - Liminal Flowers

## Build Commands (run from `flowers/` directory)
- `pnpm dev` - Start dev server
- `pnpm build` - Type-check and build (`tsc -b && vite build`)
- `pnpm lint` - Run ESLint

## Code Style
- **Imports**: Use `@/` alias for src imports (e.g., `import { X } from "@/lib/foo"`). Avoid relative `../` paths.
- **Types**: Place types/interfaces in `src/types/*.ts` files. Exception: component Props can be inline.
- **Formatting**: Double quotes for JSX attributes, single quotes for imports. No semicolons.
- **Naming**: camelCase for variables/functions, PascalCase for components/types, SCREAMING_SNAKE for constants.

## Architecture
- `src/App.tsx` - Main config: layout, scroll behavior, 3D shape positioning, text content
- `src/ascii.tsx` - WebGL shader-based ASCII renderer (noise bg + text foreground layers)
- `src/components/` - React components (IsoShape for 3D, ShapeScene for scroll-synced shapes)
- `src/lib/` - Utilities (char-pickers for text layout, shaders, flowerwall patterns)

## Key Patterns
- Performance is critical: use `useRef` for animation state, `useMemo` for expensive computations
- Text content uses cell-based grid positioning with `TextItem` interface (x/y as number or {pct, px})
- 3D shapes use react-three-fiber with leva controls for runtime tweaking
- Stack: React 19, TypeScript, Vite (rolldown), Tailwind v4, Three.js
