# Contributing a Theme to massCode

Thank you for contributing a theme to the massCode community!

## Fastest Way: Submit in 30 Seconds (No Git Required)

1. In massCode, open **Settings → Appearance** and click **Create Theme Template**.
2. Edit your theme JSON in `~/.massCode/themes/` (live reload applies changes instantly) and select it in the Theme dropdown.
3. Click **Submit to Community** — massCode validates your theme and opens a pre-filled file in GitHub Web UI.
4. Click **Commit changes → Propose changes → Create pull request**.

Prefer submitting manually from the browser? Open the [GitHub Web Theme Editor](https://github.com/massCodeIO/masscode-themes/new/main/themes), enter `<your-theme-id>.json` (kebab-case), paste your JSON, and open a Pull Request.

## Alternative: Local Git Workflow

1. Fork and clone this repository.
2. Add your theme JSON file to `themes/<your-theme-id>.json` (kebab-case `a-z`, `0-9`, `-`; reserved IDs `light`, `dark`, `auto` are not allowed).
3. Validate locally:
   ```bash
   node scripts/build-registry.mjs --check
   ```
4. Open a Pull Request. Do **not** edit `registry.json` — GitHub Actions rebuilds it automatically on merge.

## Theme JSON Format

```json
{
  "$schema": "https://raw.githubusercontent.com/massCodeIO/masscode-themes/main/schema/theme.schema.json",
  "name": "My Theme",
  "author": "your-handle",
  "authorUrl": "https://github.com/your-handle",
  "type": "dark",
  "colors": {
    "primary": "hsl(220, 90%, 66%)",
    "primary-foreground": "hsl(0, 0%, 100%)",
    "background": "hsl(232, 23%, 14%)",
    "foreground": "hsl(227, 68%, 88%)",
    "accent": "hsl(234, 22%, 22%)",
    "accent-hover": "hsl(234, 22%, 26%)",
    "accent-foreground": "hsl(227, 68%, 88%)",
    "muted": "hsl(233, 22%, 19%)",
    "muted-foreground": "hsl(228, 24%, 56%)",
    "card": "hsl(233, 24%, 17%)",
    "popover": "hsl(233, 24%, 17%)",
    "popover-foreground": "hsl(227, 68%, 88%)",
    "border": "hsl(233, 22%, 24%)",
    "scrollbar": "hsla(228, 24%, 56%, 0.35)"
  },
  "editorColors": {
    "editor-keyword": "hsl(267, 84%, 81%)",
    "editor-string": "hsl(115, 54%, 76%)",
    "editor-comment": "hsl(228, 24%, 50%)",
    "editor-number": "hsl(23, 92%, 75%)",
    "editor-atom": "hsl(23, 92%, 75%)",
    "editor-variable": "hsl(227, 68%, 88%)",
    "editor-def": "hsl(217, 92%, 76%)",
    "editor-property": "hsl(189, 71%, 73%)",
    "editor-tag": "hsl(343, 81%, 75%)",
    "editor-attribute": "hsl(217, 92%, 76%)",
    "editor-operator": "hsl(189, 71%, 73%)",
    "editor-bracket": "hsl(228, 24%, 64%)"
  }
}
```

## Validation Rules

- Required fields: `name`, `type` (`"light"` or `"dark"`), `colors` (minimum: `background`, `foreground`, `primary`, `card`, `border`).
- Optional fields: `$schema`, `author`, `authorUrl` (`https://github.com/...`), `license` (SPDX ID, e.g. `"MIT"`), `copyright` (upstream or author notice), `editorColors` (keys must start with `editor-`).
- Supported CSS color formats: `#hex`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, `oklch(...)`.
- Legacy `color-*` tokens (such as `color-bg`, `color-primary`) are not allowed.

## Porting Third-Party Themes

If your theme is a port of an existing open-source theme, you may include `license` and `copyright` fields in your theme JSON (they are preserved verbatim when installed through massCode) and add an entry to [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
