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
*   **Root Layout Class Wrapping**: Ensure that the very first HTML element in each view template file is a layout container class (e.g. `<div class="layout layout--col">`). Rendered components like `{% render 'title_bar' %}` must be placed inside this container, rather than before it, so the compiler immediately registers a layout class as the root of the file.

