# Asteroids TRMNL Plugin Guidelines

Always follow these guidelines when editing or deploying files in this repository:

## 1. SVG Viewport Dimensions (Quadrant Layout)
* **Rule**: In `src/quadrant.liquid` and `templates/quadrant.liquid`, the SVG dimensions for the tiny radar must be kept at `120x120` (width="120" height="120") with `viewBox="0 0 150 150"`. 
* **Reasoning**: The target screen size is ~400×240. An SVG dimension of `140x140` is too large and will cause the radar to overflow its container and clip text labels. Do not increase it back to `140x140`.

## 2. No Dead Code in Templates
* **Rule**: Do not add or leave dead blocks (such as `{% if false %}<div class="layout layout--col"></div>{% endif %}`) at the end of templates (`shared.liquid`, etc.). Keep templates clean and minimal.

## 3. Deploying Templates to TRMNL
* **Rule**: When you modify any template/liquid file, make sure the changes are deployed to TRMNL.
* **Manual push command**: Use `/usr/local/lib/ruby/gems/4.0.0/bin/trmnlp push` (which runs `trmnlp push` with the correct Ruby gem path) to upload the updated templates directly to the TRMNL portal.

## 4. Automatically Commit and Push to Git
* **Rule**: Whenever you modify, create, or delete files in this repository (e.g. templates, rules, backend functions), automatically stage them (`git add`), commit them with a descriptive commit message (`git commit`), and push them to the remote repository (`git push`).
* **Reasoning**: This keeps the codebase in sync immediately without requiring explicit user prompts to commit/push.

## 5. Test Publishing and Chef Verification Process
* **Rule**: After making edits to the templates, follow the test publishing process to verify Chef checks:
  1. Validate templates locally if needed using the command: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && /usr/local/lib/ruby/gems/4.0.0/bin/trmnlp lint`.
  2. Push templates to the TRMNL server using: `/usr/local/lib/ruby/gems/4.0.0/bin/trmnlp push`.
  3. Navigate to the plugin settings edit page (e.g. `https://trmnl.com/plugin_settings/411563/edit`), click the "Publish" button (or "Publish plugin?"), check "Acknowledge best practices", and try to publish as a public plugin to trigger Chef's full validation.
  4. Inspect Chef's warnings or error messages, and iterate until validation is successful.

## 6. Strict Styling and Layout Class Guardrails
*   **No custom CSS or `<style>` blocks**: Do not include `<style>` tags anywhere in templates or shared components. Move all styling to standard HTML/SVG attributes (e.g. `fill`, `stroke`, `stroke-width`, `stroke-dasharray`).
*   **No inline `style` attributes**: Do not use inline `style="..."` attributes on any tags. Use native layout/sizing attributes (like `width="..."` and `height="..."` on images or SVGs) or TRMNL utility classes instead.
*   **Single Root Layout Wrapper**: Ensure that each individual view template (e.g. `full.liquid`) starts with exactly one root layout container class (e.g. `<div class="layout layout--col">`). Do not wrap shared library files (`shared.liquid` / `markup_shared`) in layout containers, as this results in nested layouts during compilation.
*   **Title Bar Rendering Placement**: Rendered components like `{% render 'title_bar' %}` must not be inside the root layout wrapper; instead, place them at the very end of the template file, after the closing `</div>` tag of the root layout, so it behaves as a sibling layout to the main view under the screen wrapper.
*   **Title Bar Linter Wrapper**: Avoid wrapping the template definition inside shared.liquid in layout divs. Instead, add a dummy layout comment (e.g. `<!-- class="layout" -->`) below the template definition to satisfy file-based compiler layout checks without polluting the outer namespace.
*   **Grid Nesting Separation**: Grid cells (`col--span-*` or auto-grid children) should be layout-agnostic and should not directly contain flex/container layout classes (e.g. `flex`, `flex--col`, `grow`, `p--*`). Nest a separate flex container `div` inside the grid cell.
*   **SVG Sizing & Aspect Ratio Consistency**: Match the SVG width/height display dimensions exactly to the viewBox coordinate aspect ratio (e.g., `width="280" height="260" viewBox="0 0 280 260"`) to prevent rendering engine distortions on e-ink.
*   **SVG Text Styles & Attributes**: Explicitly define SVG text elements using native attributes (e.g. `fill="..."`) alongside standard framework classes to ensure rendering engine compatibility. Do not use explicit `font-size="..."` attributes on SVG `<text>` tags as the parser flags them as inline style violations; rely on framework text helper classes instead.
*   **Inline SVG Title Bar Icons**: Do not use `base64_encode` filters or base64 data URIs inside `<img>` tags for title bar icons. Inline the `<svg>` element directly in the title bar markup using Liquid captures or raw HTML, applying the standard `image image-stroke image-stroke--medium` classes on the `<svg>` tag.
*   **Transform Array Key Safety**: Every return path inside `transform.js` (including input fallbacks, errors, or pass-through blocks) must return all layout variant arrays (e.g., `radar_ticks_full`, `radar_asteroids_full`, etc.) initialized to empty arrays `[]` rather than leaving them `undefined`. If input data is precalculated, detect and pass it through directly while defaulting missing arrays to `[]`.
*   **SVG Radar Height Budget**: The maximum safe display dimensions for SVG radars in `full` (landscape split) and `half_vertical` (stacked) templates is `280x260` (viewBox `0 0 280 260`) centered at `cx="140" cy="130"`. Do not exceed 260px height to prevent vertical page clipping and overflow on e-ink.
*   **No data-clamp on SVG text**: Do not use `data-clamp` on SVG `<text>` elements. Perform name truncation directly in the data engine (Python or JS) before rendering, enforcing an 8-character maximum limit (`name.substring(0, 6) + ".."`) for all radar asteroid labels.
*   **Pass-through Validation**: If `transform.js` supports precalculated payloads, validate that tick and asteroid arrays for all four layout sizes (`full`, `half_horizontal`, `half_vertical`, `quadrant`) are present and non-empty. If any key is missing or empty, fall back to calculating them dynamically from raw candidates.
*   **High Contrast Badges**: Avoid solid gray fills (like `bg--gray-70`) for nominal badges. Switch nominal statuses to outline badges using the framework `label--outline` class.
*   **Data Truncation Attributes**: Avoid `data-overflow="true"` on text elements; instead use `data-clamp="1"` for explicit line-clamping and text truncation.
*   **SVG Text Overflow Clipping**: Apply a `<clipPath>` containing the safe drawable bounds to all text elements in SVG charts to prevent text rendering overflow.
*   **Quadrant Hero Emphasis**: Do not render charts or complex details inside quadrant layouts. Focus on a single hero statistic (e.g. total counts) paired with minimal secondary indicators.
*   **SVG Viewport & Sizing Constraints**: SVGs must always include explicit `width` and `height` attributes matching their `viewBox` coordinates (e.g., `width="350" height="330"`), along with classes like `w--full max-w--full` to constrain them from stretching beyond their calculated coordinates in wide grid cells.
*   **Use `currentColor` inside SVGs**: Use `stroke="currentColor"` and `fill="currentColor"` (or parent context inheritance) instead of hardcoding `#000` hex colors. This allows the SVG to adapt to framework dither levels and light/dark theme switches.
*   **No SVG Text Squeezing**: Do not use `textLength` or `lengthAdjust="spacingAndGlyphs"` to compress labels inside SVG text blocks as it distorts glyphs on e-ink. Let text render naturally using appropriate positioning or sizing.
*   **Synchronize Dual Files**: Keep files in `src/` (e.g. `src/transform.js`, `src/settings.yml`) and their root counterparts (`transform.js`, `settings.yml`) identical. The TRMNL CLI deploys files from the root.
*   **Metadata Limits**: Keep the root `description` field in `settings.yml` under TRMNL's maximum limit of 35 characters.
*   **Sanitize Coordinate Computations**: Always validate math results inside transform scripts using `isFinite()` before passing coordinates to Liquid SVG templates, avoiding rendering breaks from `NaN` or `Infinity`.
*   **Layout Vertical Breathing Room**: Use explicit spacing classes (e.g., `gap--large` or `gap--space-between`) on root layout wrappers and grid rows to prevent stacked telemetry items from sitting too tight under SVGs during portrait column wrapping.
*   **Responsive SVG Quadrants**: Define portrait-specific width utilities (e.g., `portrait:w--1-2`) on quadrant views to prevent square SVGs from taking up excessive vertical screen space when columns stack vertically.
*   **No Inline Style Attributes**: Never use inline style attributes (like `style="..."`) on any layout or wrapper container. Use TRMNL framework layout classes instead, or let SVGs constrain themselves via native attributes.
*   **Valid Framework Typography**: Never use custom or invalid text utility classes (e.g. `text--black`, `text--white`, `text--bold`, `text--small`, `text--center`). Replace them with framework elements and sizes (`title`, `label`, `value`, `description` with modifiers like `title--small` or `value--small`) and container positioning (`layout--center-x`).
*   **Semantic Badge Classes**: Use `label--outline` for nominal state chips and `label--error` for ALERT/HAZARD badges.
*   **No User-Configurable API Keys**: Do not expose user configuration fields for third-party API keys (e.g. NASA) in `settings.yml`. Manage all API key secret configurations directly in the Firebase backend.
*   **Required Support Custom Field**: Always include a field with `field_type: author_bio` under `custom_fields` in `settings.yml` as it is strictly required by the TRMNL plugin validation engine for support details.
*   **Standardized Empty State**: Standardize empty state text inside the SVG radar face to `"NO ASTEROIDS IN RANGE"` centered at the exact radar coordinates.
*   **Unified Title Bar Rendering**: Ensure `{% render 'title_bar' %}` is included at the end of every layout template file, including quadrant layouts, as a direct sibling of the root layout container.
*   **Template Condition Nesting**: The root element of any layout template file must be the `div.layout` container. Wrap all conditional rendering blocks (`{% if scan_completed %}...{% endif %}`) *inside* the layout container to maintain correct AST sibling structure with the title bar.
*   **Enforce scan_completed in JavaScript Transforms**: In `transform.js`, ensure `scan_completed: true` is returned for all successful paths (including the precalculated layout block path) and `scan_completed: false` for catch/offline paths.

## 7. Direct Local Firebase Deployment
* **Rule**: Whenever deploying updates to Firebase (functions, rules, indexes), perform direct deployment from the local machine using the command: `firebase deploy --project neo-radar-trmnl-2026`.
* **Reasoning**: Your local authenticated session (`mgeilich9@gmail.com`) has full owner rights, which bypasses GitHub Actions setup complexity, service account credential configurations, and IAM propagation delays.
* **No automated GitHub Actions CI/CD**: Do not configure or maintain automated deployment workflows (such as `.github/workflows/deploy.yml`) that attempt to push assets or code to TRMNL or Firebase on Git commit. Perform all deployments locally via the CLI.
