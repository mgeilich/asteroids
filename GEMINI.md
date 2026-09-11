# Asteroids TRMNL Plugin Guidelines & Chef Verification Rules

Always follow these guidelines when editing or deploying files in this repository:

## 1. Zero Custom `<style>` Blocks Rule
* **Rule**: NEVER include `<style>` blocks or custom CSS anywhere in `templates/`, `src/`, or `shared.liquid`. The TRMNL framework forbids custom style tags.
* **SVG Rendering**: Rely on clean native SVG attributes (`fill="#000"`, `stroke="#000"`, `text-anchor="..."`, `font-weight="bold"`).

## 2. Flex Alignment & Margin Utilities
* **Rule**:
  - `layout--right` is NOT a valid TRMNL class. Never use `layout--right`.
  - For horizontal spacing between opposite ends, use `gap--space-between` on the parent flex container (e.g. `<div class="flex flex--row flex--center-y gap--space-between w--full">`).
  - To push a single flex item to the right edge, use `ml--auto` directly on that flex child inside a `<div class="flex flex--row ...">`.

## 3. Strict Offline & Error State Distinction in `transform.js`
* **Rule**:
  - When input is invalid, unreachable, or empty `{}`, return `scan_completed: false` with `last_error: "Telemetry feed unreachable. Checking for updates..."`.
  - When telemetry succeeds but 0 asteroids are in range, return `scan_completed: true` with `system_status: "SYSTEM STATUS: NOMINAL // CLEAR SPACE"`.
  - Render `last_error` conditionally in view offline screens so users know whether data is fetching or connection is offline.

## 4. Single-Gap Hierarchy (Avoid Double-Gap Layout Compounding)
* **Rule**: Root layout containers must use `p--0` without compounding `gap--*` utilities if the primary child container (e.g. `grid grid--cols-2 ...`) already manages internal `gap--*` and `p--*`. This prevents vertical clipping on 800×480 screens.

## 5. Title Bar Template & Sibling Placement
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

## 6. `settings.yml` Custom Fields & Backend Proxy Architecture
* **Rule**:
  - Do NOT expose an `api_key` custom field in `settings.yml`. All NASA API authentication, caching, rate-limiting, and coordinate calculations are securely managed by the Firebase backend (`https://neo-radar-t4xw3htxya-uc.a.run.app`).
  - Always include the `author_bio` custom field with `learn_more_url: https://api.nasa.gov/#neo`.
  - Keep `description` under 35 characters.

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

## 10. 1-Bit & 2-Bit Text Stroke on Grayscale Backgrounds
* **Rule**: Whenever text, titles, values, or labels are placed inside parent containers with `bg--gray-75` (or other gray background fills), always include `1bit:text-stroke 2bit:text-stroke` with the text classes (e.g. `<span class="label 1bit:text-stroke 2bit:text-stroke">` or `<div class="title title--small 1bit:text-stroke 2bit:text-stroke">`) to preserve crisp contrast against dithering patterns on 1-bit and 2-bit e-paper displays.

## 11. TRMNL X Responsive Scaling (`lg:`) & OG Overrun Prevention
* **Rule**:
  - **OG Screen Constraint**: On compact OG resolutions (especially `half_horizontal` 800×240), limit default items (e.g. display top 1 flyby) to avoid vertical overruns.
  - **TRMNL X Screen Scaling**: Avoid "OG in X screen" empty space on TRMNL X displays by utilizing `lg:` scaling utilities (e.g. `lg:title--base`, `lg:label--large`, `lg:value--xlarge`, `lg:gap--medium`, `lg:p--2`) and conditionally exposing additional data rows using `<div class="hidden lg:flex ...">` or `<div class="hidden lg:block ...">`.

