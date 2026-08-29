# Asteroids TRMNL Plugin Guidelines & Chef Verification Rules

Always follow these guidelines when editing or deploying files in this repository:

## 1. Title Bar Architecture & Sibling Placement
* **Rule**: Define the title bar template inside `templates/shared.liquid` (and `src/shared.liquid`) using:
  ```liquid
  {% template title_bar %}
    <div class="title_bar">
      <svg class="image image-stroke image-stroke--medium" width="24" height="24" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <path d="..." fill="#000"/>
      </svg>
      <span class="title">Asteroids</span>
      {% if trmnl.plugin_settings.instance_name and trmnl.plugin_settings.instance_name != "" %}
        <span class="instance">{{ trmnl.plugin_settings.instance_name }}</span>
      {% endif %}
    </div>
  {% endtemplate %}
  <!-- class="layout" -->
  ```
* In every view file (`full.liquid`, `half_horizontal.liquid`, `half_vertical.liquid`, `quadrant.liquid`), place `{% render 'title_bar' %}` at the very end of the file, directly after the closing `</div>` of the root `<div class="layout">`.
* **Icon Class**: The `<svg>` icon inside the title bar must always include `class="image image-stroke image-stroke--medium"` for clean 1-bit e-ink rendering.

## 2. SVG Text & Typography Styling
* **Rule**: Do not use framework HTML utility classes (such as `class="label label--small"`) directly on SVG `<text>` or `<g>` tags.
* **CSS Classes via `shared.liquid`**: Define centralized SVG text utility classes in a `<style>` block inside `shared.liquid`:
  ```html
  <style>
    .svg-text { fill: #000; font-family: sans-serif; font-size: 10px; }
    .svg-text--bold { font-weight: bold; }
    .svg-text--small { font-size: 9px; }
    .svg-text--tiny { font-size: 8px; }
    .svg-text--start { text-anchor: start; }
    .svg-text--end { text-anchor: end; }
    .svg-text--middle { text-anchor: middle; }
  </style>
  ```
* Apply these classes (`class="svg-text"`, `class="svg-text--bold"`, `class="svg-text--start"`, etc.) to SVG `<g>` and `<text>` elements.

## 3. Explicit 1-bit SVG Fills, Strokes, and Aspect Ratio
* **Rule**: Use explicit `#000` fills and strokes inside SVGs instead of `currentColor` for predictable 1-bit e-ink rendering:
  - Hazardous Asteroids: `<circle ... fill="#000" stroke="#000" />` (solid black)
  - Non-Hazardous Asteroids: `<circle ... fill="none" stroke="#000" />` (clean outline)
  - Axes & Gridlines: `stroke="#000"`
  - Text: `fill="#000"`
* **Aspect Ratio**: Every SVG must include `preserveAspectRatio="xMidYMid meet"` along with explicit `width`, `height`, and `viewBox` attributes.

## 4. Grid System & Column Spans
* **Rule**:
  - In a 2-column grid (`<div class="grid grid--cols-2 portrait:grid--cols-1 ...">`), do **NOT** use `col--span-1` on child `<div>` containers. Children automatically span 1 column each.
  - In a 12-column grid (`<div class="grid grid--cols-12 portrait:grid--cols-1 gap--small ...">`), use matching spans totaling 12 (e.g. `col--span-5 portrait:col--span-12` and `col--span-7 portrait:col--span-12`).
  - Use explicit `gap--*` utilities on `grid` containers for intentional column spacing.

## 5. Universal 1-bit Badge Classes
* **Rule**: Use TRMNL's universal monochrome badge classes that render reliably across all hardware generations:
  - **ALERT / HAZARD**: `label label--filled` (solid black badge with white text)
  - **NOMINAL / SAFE**: `label label--outline` (outlined badge with black text)
  - Avoid unverified color-only semantic classes like `label--primary` or `label--warning`.

## 6. Deterministic Alert Flag & Transform Ingestion
* **Rule**:
  - `radar_calculator.py` and `transform.js` must return an explicit boolean `"is_alert": bool(...)` and `"scan_completed": True`.
  - `shared.liquid` evaluates `is_alert` directly without fragile string-parsing (`status_lower contains "warning"`).
  - In `transform.js`, synthetic demo data must only flag `is_alert: true` when matching real hazard criteria (`warningActive`).
  - `transform.js` must support precalculated payloads (`input.chart_ticks_full`), direct NASA NeoWS JSON (`input.near_earth_objects`), and candidate lists (`input.candidates`).

## 7. Metadata & `settings.yml` Documentation Links
* **Rule**:
  - In `settings.yml` and `src/settings.yml`, the `learn_more_url` under `author_bio` must point specifically to the NeoWS API documentation (`https://api.nasa.gov/#neo`).
  - Keep the plugin description under 35 characters (`Near-Earth asteroid timeline`).

## 8. Dual File Synchronization
* **Rule**: Keep files in `src/` (`src/shared.liquid`, `src/full.liquid`, `src/half_horizontal.liquid`, `src/half_vertical.liquid`, `src/quadrant.liquid`, `src/transform.js`, `src/settings.yml`) identical to their counterparts in `templates/` and project root.

## 9. Automated Git Synchronization & Verification Workflow
* **Rule**: Whenever changes are made:
  1. Test locally: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp lint`
  2. Build previews: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp build`
  3. Push to TRMNL: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && echo "y" | /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp push`
  4. Deploy Firebase (when backend changes): `firebase deploy --project neo-radar-trmnl-2026 --only functions:neo_radar`
  5. Stage, commit, and push to git: `git add -A && git commit -m "..." && git push`
