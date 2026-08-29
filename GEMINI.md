# Asteroids TRMNL Plugin Guidelines & Chef Verification Rules

Always follow these guidelines when editing or deploying files in this repository:

## 1. Zero Custom `<style>` Blocks Rule
* **Rule**: NEVER include `<style>` blocks or custom CSS anywhere in `templates/`, `src/`, or `shared.liquid`. The TRMNL framework forbids custom style tags.
* **SVG Text Styling**: Use standard SVG `<text>` and `<tspan>` attributes (`fill="#000"`, `text-anchor="..."`, `font-weight="bold"`, `dy="3"`, `font-size="..."` if necessary) or let default SVG rendering handle font families.

## 2. Strict Offline / Empty Data Handling in `transform.js`
* **Rule**: If `input` is empty `{}` or lacks `chart_ticks_full` (precomputed), `near_earth_objects` (NASA raw), or `candidates` (static demo list), `transform.js` MUST return `emptyPayload` with `scan_completed: false`.
* Never synthesize fake asteroids when the API fails or returns `{}` — show the offline message so users know telemetry is unreachable.

## 3. Title Bar Template & Sibling Placement
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

## 4. `settings.yml` Custom Fields & `learn_more_url`
* **Rule**:
  - Always include `api_key` custom field under `custom_fields` for optional user-provided NASA API keys.
  - Always include `author_bio` custom field with `learn_more_url: https://api.nasa.gov/#neo`.
  - Keep `description` under 35 characters.

## 5. Grid System & Flex Placement
* **Rule**:
  - In a 2-column grid (`grid--cols-2`), do NOT use `col--span-1`.
  - In a 12-column grid (`grid--cols-12`), use matching spans (`col--span-5` and `col--span-7`) with explicit `gap--*` utilities.
  - Use `ml--auto` only inside flex containers (`flex flex--row`).

## 6. Universal 1-bit Badge Classes
* **Rule**: Use TRMNL's universal monochrome badge classes:
  - **ALERT / HAZARD**: `label label--filled`
  - **NOMINAL / SAFE**: `label label--outline`

## 7. Dual File Synchronization
* **Rule**: Keep files in `src/` identical to their counterparts in `templates/` and root.

## 8. Verification Workflow
* **Rule**: Whenever changes are made:
  1. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp lint`
  2. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp build`
  3. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && echo "y" | /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp push`
  4. Deploy Firebase if backend changed: `firebase deploy --project neo-radar-trmnl-2026 --only functions:neo_radar`
  5. Commit and push to git: `git add -A && git commit -m "..." && git push`
