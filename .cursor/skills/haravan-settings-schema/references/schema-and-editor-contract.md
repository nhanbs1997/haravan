# Schema and visual-editor contract

## Schema authority

Haravan Theme product themes use `config/settings_schema.json`. The top level is an array of groups:

```json
[
  {
    "name": "Trang chủ",
    "settings": [
      { "type": "header", "content": "Hero" },
      { "type": "checkbox", "id": "home_hero_enable", "label": "Hiển thị", "default": true },
      { "type": "text", "id": "home_hero_title", "label": "Tiêu đề", "default": "Thiết kế hồ thủy sinh" },
      { "type": "image_picker", "id": "home_hero_image", "label": "Hình nền (1920x1080)" }
    ]
  }
]
```

Supported project types: `header`, `paragraph`, `text`, `textarea`, `checkbox`, `color`, `image_picker`, `select` with `options`, `radio`, `link_list`, `collection`, `blog`, and `page`.

Rules:

- Prefer letters, numbers, and underscores. Existing legacy IDs may contain hyphens. Never add a file extension or a dot to a new ID.
- Hyphenated IDs in Liquid/SCSS use compact or spaced dot notation, matching the current file. Correct: `{{settings.footer-bg-1}}` or `{{ settings.footer-bg-1 }}` chứ không phải `{{ settings['footer-bg-1'] }}`. Do not convert existing hyphen IDs to bracket notation.
- IDs are globally unique.
- `header` and `paragraph` do not have IDs.
- Use `image_picker`, not an asset filename field.
- Use merchant-readable Vietnamese labels and exact recommended image dimensions.
- Place section toggle first, then primary content, media, buttons/links, items, and advanced controls.
- Every repeated child item has its own visibility checkbox when the item is optional.
- Do not add Shopify `theme_info`, section `{% schema %}`, blocks, or presets.

## Runtime binding

Prefer a merchant upload with a static asset only as fallback:

```liquid
{%- assign image_src = settings.home_hero_image -%}
{%- if image_src == blank -%}
  {%- assign image_src = 'home-hero.jpg' | asset_url -%}
{%- endif -%}
```

Do not pipe an uploaded CDN URL through `asset_url`.

Hyphenated color/CSS settings keep the theme's existing dot notation:

```scss
--footer-bg-color-1: {{settings.footer-bg-1}};
--footer-color-title: {{settings.footer-color-title}};
```

Do not rewrite that to `{{ settings['footer-bg-1'] }}`. Use `settings[variable]` only when the key itself is a captured/assigned variable.

## Visual-editor attributes

**Hard rule:** every setting key added to the schema MUST be bound to its rendered element with BOTH `setting-id` and `setting-type`. Neither attribute is optional; a key without both is incomplete.

Text:

```liquid
<h2 setting-id="home_hero_title" setting-type="text">
  {{ settings.home_hero_title | escape }}
</h2>
```

Textarea:

```liquid
<p setting-id="home_hero_description" setting-type="textarea">
  {{ settings.home_hero_description | escape }}
</p>
```

Image (`image_picker` in schema maps to `image` in the attribute):

```liquid
<img src="{{ image_src }}" setting-id="home_hero_image" setting-type="image" alt="">
```

Dynamic items:

```liquid
{%- capture title_key -%}home_category_{{ i }}_title{%- endcapture -%}
<h3 setting-id="{{ title_key }}" setting-type="text">{{ settings[title_key] | escape }}</h3>
```

Do not annotate hidden SEO copy, catalog objects, layout wrappers, data-only settings, or link-only settings. An element accepts one primary `setting-id`; choose the visible content or image the merchant clicked.

## Two-way audit

Runtime to schema:

- Resolve `settings.id`, `settings['id']`, `settings["id"]`, and dynamic keys produced by `capture`/`assign`.
- Every referenced ID or dynamic family must exist in schema.

Schema to output:

- A filename match does not prove a setting is used.
- Assignment to a variable does not prove it reaches rendered output.
- Trace image settings to `src`, `srcset`, `poster`, CSS URL, or metadata output.
- Trace text settings to rendered content or intentional data/ARIA attributes.
- Never auto-delete from a direct-only audit; manually resolve dynamic families and variable flow first.

## Editor CSS isolation

Bad:

```css
body.az-theme input,
body.az-theme textarea,
body.az-theme select { background: var(--surface); }
```

Acceptable baseline:

```css
body.az-theme form input,
body.az-theme form textarea,
body.az-theme form select { background: var(--surface); }
```

Prefer component classes when available. The quick editor injects controls inside the storefront document, so bare body-level selectors leak theme colors into its white panel.
