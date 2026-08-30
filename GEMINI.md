# Asteroids TRMNL Plugin Guidelines & Chef Verification Rules

Always follow these guidelines when editing or deploying files in this repository:

## 1. Zero Custom `<style>` Blocks Rule
* **Rule**: NEVER include `<style>` blocks or custom CSS anywhere in `templates/`, `src/`, or `shared.liquid`. The TRMNL framework forbids custom style tags.
* **SVG Text Presentation Attributes**: Use standard SVG presentation attributes directly on `<text>` or `<g>` tags:
  - Axis and Gridline labels: `font-size="10" fill="#000" dy="3" text-anchor="end"`
  - Header labels: `font-size="11" font-weight="bold" fill="#000"`
  - Asteroid name labels: `font-size="9" fill="#000"` (or `font-size="8"` on smaller views)
  - Time tick labels: `font-size="10" fill="#000" text-anchor="middle"`

## 2. Strict Offline & Error State Distinction in `transform.js`
* **Rule**:
  - When input is invalid, unreachable, or empty `{}`, return `scan_completed: false` with `last_error: "Telemetry feed unreachable. Checking for updates..."`.
  - When telemetry succeeds but 0 asteroids are in range, return `scan_completed: true` with `system_status: "SYSTEM STATUS: NOMINAL // CLEAR SPACE"`.
  - Render `last_error` conditionally in view offline screens so users know whether data is fetching or connection is offline.

## 3. Avoid Double-Gap Layout Compounding
* **Rule**: Root layout containers must use `p--0` without compounding `gap--*` utilities if the primary child container (e.g. `grid grid--cols-2 ...`) already manages internal `gap--*` and `p--*`. This prevents vertical clipping on 800×480 screens.

## 4. Title Bar Template & Sibling Placement
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

## 5. `settings.yml` Custom Fields & `learn_more_url`
* **Rule**:
  - Always include `api_key` custom field under `custom_fields` for optional user-provided NASA API keys.
  - Always include `author_bio` custom field with `learn_more_url: https://api.nasa.gov/#neo`.
  - Keep `description` under 35 characters.

## 6. Right-Alignment, Flex Layouts & Margin Utilities
* **Rule**:
  - Use `layout--right` on flex children (e.g. `<div class="layout--right flex flex--row flex--center-y gap--small">`) instead of `ml--auto` for robust right-justification across 1-bit devices.
  - Use `gap--space-between` on parent flex containers (e.g. flyby list rows `<div class="flex flex--row flex--center-y gap--space-between w--full">`) to naturally push children to opposite edges.
  - In a 2-column grid (`grid--cols-2`), do NOT use `col--span-1`.
  - In a 12-column grid (`grid--cols-12`), use matching spans (`col--span-5` and `col--span-7`) with explicit `gap--*` utilities.
  - Multi-column metric subgrids must include `portrait:grid--cols-1` to reflow cleanly when outer columns stack.

## 7. Universal 1-bit Badge Classes
* **Rule**: Use TRMNL's universal monochrome badge classes:
  - **ALERT / HAZARD**: `label label--filled`
  - **NOMINAL / SAFE**: `label label--outline`

## 8. Dual File Synchronization
* **Rule**: Keep files in `src/` identical to their counterparts in `templates/` and root.

## 9. Verification Workflow
* **Rule**: Whenever changes are made:
  1. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp lint`
  2. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp build`
  3. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && echo "y" | /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp push`
  4. Deploy Firebase if backend changed: `firebase deploy --project neo-radar-trmnl-2026 --only functions:neo_radar`
  5. Commit and push to git: `git add -A && git commit -m "..." && git push`
