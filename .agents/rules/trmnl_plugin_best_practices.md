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

## 7. SVG Text Wrapping
* **Issue**: SVG `<tspan>` tags with `dy` relative offsets are fragile, renderer-dependent, and fail when `<text>` lacks absolute positioning.
* **Guideline**: Avoid relative text offset elements. If text needs to wrap, pre-split the string in `transform.js` and calculate y-offsets there. Render them as two separate, stacked `<text>` elements in Liquid, each with absolute `x` and `y` attributes.

## 8. Display Candidate Prioritization
* **Issue**: On 1-bit displays, rendering unimportant or unnamed objects leads to clutter and obscures critical events (like hazardous encounters).
* **Guideline**: 
  * Filter out candidates that have no valid name: `.filter(c => c.name && c.name.trim() !== '')`.
  * Prioritize hazardous encounters first in the sorting before distance:
    ```javascript
    .sort((a, b) => {
      if (a.is_hazardous && !b.is_hazardous) return -1;
      if (!a.is_hazardous && b.is_hazardous) return 1;
      return a.miss_distance_ld - b.miss_distance_ld;
    })
    ```

## 9. Custom Server Proxies & Static Analysis
* **Issue**: The TRMNL online validator performs static code analysis on `transform.js`. If it detects references to a target API response format (e.g. NASA's `near_earth_objects`), it will assume a direct integration is intended and require corresponding credentials or a direct polling URL.
* **Guideline**: When utilizing a custom proxy server (such as a Firebase Cloud Function) that handles authentication and caching automatically, completely remove all direct target API parsing paths and keywords (like `near_earth_objects`) from `transform.js`. Let `transform.js` only expect the proxy server's returned structure.

## 10. Custom Fields Configuration
* **Issue**: Adding author/creator metadata fields inside the `custom_fields` section in `settings.yml` causes the platform to render them as empty input form fields on the plugin's configuration settings page.
* **Guideline**: Empty the `custom_fields` array (`custom_fields: []`) if no configuration parameters are required from the end-user. Do not place static metadata (like `author_bio` or documentation links) inside `custom_fields`.

## 11. HTML Wrapper Divs in SVGs
* **Issue**: Redundant wrapper divs (like `.radar-container` or `.text--black`) surrounding an `<svg>` element can introduce nesting bugs and cause platform template parsers to flag unclosed div errors during mock evaluation.
* **Guideline**: Avoid nested wrapper divs around SVGs. Instead, apply styling (like text colors) directly to the `<svg>` element (e.g. `class="text--black"`) and set the dimensions directly on the `<svg>`.

## 12. SVG Scaling and Mismatches
* **Issue**: A mismatch between the SVG `viewBox` coordinates (e.g., `0 0 150 150`) and the container `width`/`height` attributes (e.g., `140`) can cause clipping or pixel distortion on e-ink displays.
* **Guideline**: To ensure distortion-free scaling on e-paper screens, always set `preserveAspectRatio="xMidYMid meet"` directly on all `<svg>` elements.

## 13. SVG Text Font-Sizing & Color Safety
* **Issue**: Specifying raw inline `font-size="..."` attributes on parent `<svg>` elements is fragile on 1-bit e-paper, causing text labels to either disappear or render inconsistently.
* **Guideline**: 
  * Avoid raw `font-size` XML attributes on `<svg>` or `<g>` tags.
  * Instead, apply framework typography class utilities (e.g. `class="text--small"` or `class="text--xsmall text--bold"`) directly to all child `<text>` nodes.
  * Always set `fill="currentColor"` explicitly on `<text>` elements to guarantee proper contrast inheritance.

## 14. Responsive Prefixing for Main Titles
* **Issue**: Large section headers or titles (e.g., "PLANETARY DEFENSE") that use static, unqualified sizing classes (like `text--large`) can overflow the bounds of smaller layouts (like the `quadrant` viewport).
* **Guideline**: Always use responsive prefixing sizes on main layout titles (e.g., `class="title text--bold text--xsmall lg:text--large portrait:text--xsmall"`) so the typography scales down safely to fit smaller screens.

## 15. Standard Alignment Class Utilities
* **Issue**: Custom Tailwind-style alignment classes (e.g. `items--center`) are not supported by the TRMNL CSS framework.
* **Guideline**: Use standard framework layout alignment utilities: `layout--center` or `flex--center` to align/center elements.

## 16. Responsive SVG Scaling
* **Issue**: Explicit `width` and `height` pixel dimensions on large SVGs will cause horizontal overflow on smaller containers or 50% split columns.
* **Guideline**: Remove hardcoded dimensions from SVGs. Combine `preserveAspectRatio="xMidYMid meet"` with the framework's `image--contain` and `w--full` classes to scale the SVG dynamically.

## 17. No Layout Containers in Shared Partials
* **Issue**: Defining mock layout divs (e.g. `<div class="layout layout--col">`) in a shared partial (`shared.liquid`) will cause nesting errors when the file is prepended before the main layout file's `title_bar` rendering call.
* **Guideline**: Never define root layout container elements inside partial helper files. Keep layout containers isolated to main screen templates.

## 18. Render Tag for Custom Templates
* **Issue**: In TRMNL's Liquid, reusable template blocks defined inside shared partials (e.g. `{% template title_bar %}`) must be rendered using `{% render 'title_bar' %}` in the main layout templates. The `include` tag is deprecated and will fail to resolve.
* **Guideline**: Use `{% render 'template_name' %}` when referencing block templates defined via `{% template template_name %}`.


## 19. Variable Fallback Initialization
* **Issue**: During template-only validation runs on empty mock contexts, variables referenced by child loop scopes (like `closest_list`) will cause compiler errors if they are not explicitly initialized.
* **Guideline**: Always define and initialize array variables with fallback empty arrays in `shared.liquid` to prevent missing variable errors (e.g. `{% assign list = list | default: trmnl.data.list %}{% if list == nil %}{% assign list = "" | split: "," %}{% endif %}`).






