# TRMNL Plugin & Template Best Practices

This rule outlines template styling, layout constraints, and deployment guidelines for TRMNL E-Paper plugins to satisfy platform-specific validation checks.

## 1. Git Sync & Configuration Files
* **Issue**: The TRMNL developer portal has a native "Sync to GitHub" feature that performs bidirectional syncs. Because the portal only tracks files under `src/`, the sync bot will automatically delete root-level config files (`settings.yml` and `transform.js`) on push.
* **Guideline**: Disable/disconnect the GitHub integration in the TRMNL portal dashboard. Rely entirely on the CLI command `trmnlp push --force` or custom GitHub Actions workflows for deployments.

## 2. Strict CSS & Inline Style Limitations
* **Issue**: The TRMNL online validator completely forbids the HTML `style="..."` attribute.
* **Guideline**: 
  * Do not use the word `style` or write inline HTML style blocks (e.g., `<div style="...">`).
  * For SVG text sizing or styling, use native SVG presentation attributes directly (e.g., `font-size="12"` and `font-weight="bold"`).
  * Use TRMNL framework utility classes (e.g., `text--bold`, `items--center`) for all standard HTML layout containers.

## 3. Title Bar & View Structure
* **Issue**: The validator expects `title_bar` and `layout` components to be direct siblings inside the view container. They cannot be nested.
* **Guideline**: Structure templates using the following layout hierarchy:
  ```html
  <div class="view">
    {% render 'title_bar' %}
    <div class="layout layout--col">
      <!-- Layout content goes here -->
    </div>
  </div>
  ```
  *(Note: The outer `view` wrapper is platform-provided, but including `<div class="view">` at the root of the file is standard for local previewing, provided the platform's view is not closed twice at the end.)*

## 4. No Silent SVG Coordinate Collapses
* **Issue**: Using default filters on SVG coordinates (e.g., `x1="{{ tick.x1 | default: 0 }}"`) hides data parsing errors by rendering collapsed lines or elements silently at `(0,0)`.
* **Guideline**:
  * Do not use `default: 0` filters on critical SVG coordinates.
  * Instead, wrap the rendering loop blocks in strict Liquid conditional checks to ensure variables and their attributes exist before rendering:
    ```liquid
    {% if tick and tick.x1 and tick.y1 and tick.x2 and tick.y2 %}
      <line x1="{{ tick.x1 }}" y1="{{ tick.y1 }}" x2="{{ tick.x2 }}" y2="{{ tick.y2 }}" />
    {% endif %}
    ```

## 5. CSS Utility Constraints
* **Vertical Centering in Rows**: `layout--center-y` is only valid on column layout contexts (`flex--col`). For row layout contexts (`flex--row`), use `items--center` to center elements vertically.
* **Nesting Simplification**: Avoid deep flex column nesting inside row wrappers. If splitting a layout 50/50, use the native `grid grid--cols-2` class on the container instead of manual `w--[50%]` sizing.

## 6. JS Transform Reference Safety
* **Issue**: If the transform backend receives empty data, an early exit check might execute. If configuration constants (like layout maps) are defined at the bottom of the function, referencing them earlier causes a Temporal Dead Zone (TDZ) ReferenceError.
* **Guideline**: In `transform.js`, always declare all configuration objects and constants at the very top of the `run(input)` function, before any conditional logic or early exit checks are executed.
