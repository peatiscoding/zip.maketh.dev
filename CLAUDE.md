# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is zip.maketh.dev - a Thailand postal code lookup website. It provides a searchable web interface and JSON endpoint for Thai postal code data. The project consists of two main parts:

1. **Website**: Svelte 5 (with Runes) + SvelteKit SPA hosted as static site on CloudFlare
2. **Data Cruncher**: TypeScript scripts running on Bun to process postal code data from multiple sources

## Development Commands

```bash
# Development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking and Svelte validation
npm run check

# Watch mode for type checking
npm run check:watch

# Format code with Prettier
npm run format

# Check formatting (lint)
npm run lint

# Sync SvelteKit (prepare)
npm run prepare
```

## Architecture

### Tech Stack
- **Frontend**: Svelte 5 with Runes API, SvelteKit, TypeScript
- **Styling**: Tailwind CSS v4 + DaisyUI components
- **Build**: Vite 7 with SvelteKit adapter-auto
- **Runtime**: Node.js 22 (for development), static deployment (production)
- **Data Processing**: Bun runtime for data cruncher scripts

### Key Directories
- `src/` - Main application source
  - `routes/` - SvelteKit pages (+page.svelte, +layout.svelte)
  - `lib/` - Reusable components and utilities
    - `components/` - Svelte components (nav-bar, search-bar, footer)
    - `data/` - Data models and binding logic
    - `assets/` - Static assets like favicon
- `data-cruncher/` - Data processing scripts and source files
  - `sources/` - Raw data files (PDF, Excel) for postal codes
- `static/` - Static files served directly

### Data Models
The application uses a hierarchical data structure for Thai postal codes:

- **Raw interfaces**: `RawProvince`, `RawDistrict`, `RawSubDistrict`, `RawZipCode`
- **Bound interfaces**: `BoundProvince`, `BoundDistrict`, `BoundSubDistrict`, `BoundZipCode`

Each level contains references to child levels, with bound interfaces establishing relationships between provinces, districts, sub-districts, and postal codes.

### Component Architecture
- Uses Svelte 5 Runes for reactivity
- DaisyUI component library for consistent styling
- Modular component structure with clear separation of concerns
- TypeScript throughout for type safety

### Data Flow
Thai postal codes follow a hierarchical structure: Province (2 digits) + Branch (3 digits) = 5-digit postal code. Multiple sub-districts/districts can share the same postal code within a province.

## Development Notes

- Uses strict TypeScript configuration with comprehensive checking
- Prettier for code formatting with Svelte and Tailwind plugins
- SvelteKit handles routing and builds as SPA
- Static deployment target (no server-side rendering)
- Data cruncher processes raw governmental data into structured JSON