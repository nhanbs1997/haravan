---
name: haravan-settings-schema
description: "Create, annotate, and audit Haravan Theme config/settings_schema.json plus storefront setting-id/setting-type attributes. Use when creating or updating theme settings UI, visual editor bindings, missing images/defaults, dead settings, editor CSS conflicts, or when the user mentions settings_schema.json, schema giao diện, thiết lập theme, or setting-id. Scoped to Haravan Theme conventions; legacy themes with font-size/font_style types fail the audit by design."
---

# Haravan Settings Schema

Use `config/settings_schema.json` as the merchant-settings UI for the current theme. This skill creates and audits that file plus storefront editor bindings.

**Scope:** Haravan Theme schema conventions only. Supported types are `header, paragraph, text, textarea, checkbox, color, image_picker, select, radio, link_list, collection, blog, page`. Legacy themes using `font-size`/`font_style` types fail the audit by design.

Do not create new fields in `config/settings.html` for work covered by this skill. Leave an existing `settings.html` untouched unless the user asks to migrate or remove it.

## Safety

- Keep Vietnamese JSON and Liquid in UTF-8.
- Treat `config/settings_data.json` as read-only unless the user explicitly approves editing it in the current task.
- This skill does not fetch or push theme; after audit passes, follow `AGENTS.md` for `agent:push` of the changed files.
- Inspect the current theme and schema before changing IDs, types, order, or defaults.
- Do not auto-delete a setting from a direct-reference-only report.
- Hyphenated setting IDs use Liquid/SCSS dot notation. Keep existing theme code as `{{ settings.footer-bg-1 }}` chứ không phải `{{ settings['footer-bg-1'] }}`. Do not rewrite these to bracket notation. Bracket notation is only for dynamic keys from `capture`/`assign`.

## Workflow

1. Identify the theme root before editing:
   - Prefer `shopPath` in `.ticket-workflow/<ticket_id>/context.json` when a ticket is in progress.
   - Otherwise detect the shop in `shops/` via `_haravan-backup.json` or `.haravan-cli_local.json`.
   - Do not author schema against the workspace root unless that root is itself the theme.
2. Read `config/settings_schema.json`, Liquid consumers, and any existing audit/utility scripts in the theme.
3. Classify every value as Haravan object, merchant setting, or system label. Do not duplicate catalog data as settings.
4. Author schema using the contracts in [references/schema-and-editor-contract.md](references/schema-and-editor-contract.md).
5. Bind visible merchant content to the visual editor:
   - **Every setting key added to the schema MUST have both `setting-id="<schema id>"` and `setting-type="text|textarea|image"` on the corresponding rendered element.** No key is complete without both attributes.
   - Do not add `hrv-cf-*` classes unless existing CSS explicitly needs them.
   - For loop items, capture the setting key and use `setting-id="{{ key }}"` plus `setting-type` matching the resolved type.
   - Bind the visible text/image setting, not a link-only `href` setting.
6. Scope storefront CSS controls to owned forms/components. Never use bare `body.<theme> input`, `textarea`, `select`, `label`, or placeholder selectors because they style Haravan's injected quick-editor UI.
7. Run:

```powershell
node .cursor/skills/haravan-settings-schema/scripts/audit-settings-schema.mjs <theme-root>
```

8. If a preview editor is available, verify one text, textarea, image, loop item, and button binding. Check desktop/mobile storefront forms after any CSS selector change.

## Completion Gate

- JSON parses; section names and setting IDs are unique.
- Every static `settings.*` reference exists in schema.
- Every static editor attribute references an existing setting and matches its normalized editor type.
- Every added setting key has both `setting-id` and `setting-type` on its rendered element.
- Dynamic key families resolve to real schema IDs.
- No bare theme-wide form-control selector can leak into the Haravan editor.
- `settings_data.json` remains unchanged unless approved.
- Report browser/editor verification separately from source validation.
