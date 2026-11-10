# Nihongo Labs UI typography

This is the shared typography standard for all new and updated user-facing UI.

## Font families

- Use the global sans-serif stack (`--font-family-sans`) for navigation, headings, buttons, labels, forms and body copy.
- Use `--font-family-display` only for deliberate editorial emphasis or decorative Japanese study motifs. Do not use it for ordinary interface copy.

## Type scale

Use the shared CSS custom properties from `src/app/globals.css`:

| Token | Size | Intended use |
|---|---:|---|
| `--type-size-micro` | 11px | Dense metadata and tiny uppercase labels only |
| `--type-size-caption` | 12px | Secondary captions and compact metadata |
| `--type-size-secondary` | 13px | Supporting descriptions, helper text and card copy |
| `--type-size-body` | 14px | Standard UI text, compact paragraphs and controls |
| `--type-size-body-large` | 15px | Primary paragraphs and prominent supporting copy |
| `--type-size-card-title` | 14px | Titles inside feature cards and compact panels |

Use `--type-line-tight` for compact headings and `--type-line-body` for readable supporting copy.

## Hierarchy and usage rules

1. Keep a clear hierarchy: page heading, section heading, card title, body copy, then metadata.
2. Normal descriptions should not be reduced to 10–11px to fit a card. Prefer adjusting layout, spacing or copy length; use micro text only for genuinely secondary metadata.
3. Use the same font family and role token across equivalent components. Do not introduce one-off font sizes in a new CSS module when a shared role already fits.
4. Use weight to establish hierarchy: regular for body copy, 600–700 for card titles and primary controls, and heavier weights only for small overline labels.
5. Keep the scale readable on mobile. Do not shrink supporting copy below the secondary role to solve wrapping.
6. When a new type role is genuinely needed, add it to the global tokens and update this document rather than adding an isolated value.

Before shipping new UI, compare it with adjacent pages and existing components to confirm that font family, size, weight, line height and colour belong to the same visual system.
