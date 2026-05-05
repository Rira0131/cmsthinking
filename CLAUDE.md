# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Semini** — CMS 사고력 세미나 교안 관리 웹앱. CMS 수학 세미나 센터 교사들이 교안을 작성·공유·발표하고 학기 일정을 관리하는 단일 HTML 파일 SPA.

## Architecture

**No build pipeline.** The entire app is a single file: `index.html` (~5100 lines of HTML + vanilla JS + inline CSS). There is no package.json, bundler, or transpiler. All dependencies are loaded from CDN.

**Key CDN dependencies:**
- `@supabase/supabase-js@2` — real-time backend (PostgreSQL)
- `KaTeX@0.16.11` — LaTeX math rendering
- `MathLive@0.101.0` — interactive math formula editor
- `DOMPurify@3.1.6` — HTML sanitization for research content

**Backend:** Supabase project at `glnpiclivptwqvopujpe.supabase.co`. Tables: `seminar_schedule`, `custom_lessons`, `week_status`, `lesson_comments`, `teachers`.

**Real-time sync:** Supabase Realtime channels watch all four main tables and update the UI automatically when other users make changes.

## Running the App

Open `index.html` directly in a browser, or serve it via any static file server:
```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```
No login credentials are embedded — users log in with their center email (domain → center mapping is hardcoded: `@mjcms.com`, `@drcms.com`, `@dbcms.com`, `@sbcms.com`).

## Code Structure (inside index.html)

The file is organized into clearly delimited sections:

1. **`<head>`** — CDN imports, CSS custom properties (theming), component styles
2. **`<body>`** — All HTML markup: sidebar, modals, section panels, math editor modal
3. **`<script>` block** — All JavaScript, structured as:
   - Constants (`_SB_URL`, `_SB_KEY`, `TEACHERS_FALLBACK`, `_MATH_LATEX_MAX`)
   - Supabase client init + auth
   - Teacher loading (Supabase → fallback)
   - Section rendering functions (`renderDashboard()`, `renderSchedule()`, etc.)
   - Lesson CRUD (`saveLessonToSupabase()`, `loadLessons()`, etc.)
   - Math formula functions (`renderMathIn()`, `_scheduleMathRender()`, math editor modal handlers)
   - Real-time subscription setup
   - Background pagination loader (200 lessons per batch)

## Math Formula Feature (수식 기능)

Formulas are stored as `<span class="math" data-latex="...">` inside lesson research content. On render, `renderMathIn(element)` calls KaTeX to display them. The math editor modal provides:
- MathLive virtual keyboard
- Preset buttons (fraction, square root, sigma, integral, Greek letters, comparison operators)
- Direct LaTeX input
- Max formula length: `_MATH_LATEX_MAX = 800` characters

**Security:** Research content is sanitized via DOMPurify before display. Allowed tags: `b`, `strong`, `i`, `em`, `u`, `br`, `span`, `div`, `p`, `mark`, `font`. Script injection and external resource loading are blocked.

## Key Development Notes

- **Backup pattern:** Before significant changes, save `index.html` as `index_YYYYMMDD_HHMM.html`. The `index.backup.html` in this directory is the pre-수식추가 version.
- **Teacher list:** Managed via Supabase `teachers` table (see `teachers_DB_가이드.md` in adjacent directory). The `TEACHERS_FALLBACK` array in the script is the offline fallback — update both when adding teachers.
- **Adding a new center:** Requires updating the hardcoded domain-to-center mapping object in the script section.
- **Curriculum levels:** Defined as a hardcoded array (`Pre-IG`, `IG-V/O/N/K`, `Pre-A/R/C/H/E/S`, levels `1`–`15`). Update the array to add new levels.
- **Lesson pagination:** Initial load is 20 lessons; background loader fetches in batches of 200 with `requestAnimationFrame` yields to avoid UI blocking.
