---
name: Tonphueng Connect
description: Calm forest-trail app for the ผึ้งพาเดิน community — forest green on warm paper, honey marking where you are.
colors:
  paper: "#f7f3ea"
  paper-deep: "#efe8d9"
  surface: "#fffdf8"
  ink: "#1f2b22"
  muted: "#5a665b"
  line: "#e4dccb"
  line-strong: "#cbc1ab"
  forest: "#264830"
  forest-deep: "#1a3322"
  leaf: "#3f6939"
  leaf-soft: "#e6eedb"
  honey: "#f6b02e"
  honey-soft: "#fcefd0"
  honey-ink: "#694607"
  sky-soft: "#e1ecf1"
  sky-ink: "#1d4a5e"
  danger: "#a23b34"
typography:
  display:
    fontFamily: "Mitr, IBM Plex Sans Thai, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans Thai, Noto Sans Thai, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest}"
    rounded: "{rounded.md}"
    height: "48px"
  button-accent:
    backgroundColor: "{colors.honey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
---

# Design System: Tonphueng Connect

Tokens are implemented in `src/app/globals.css` (`:root`). Product rules: [PRODUCT.md](PRODUCT.md).

## Overview

Visual direction: a calm forest-trail app — deep forest green and warm paper, with real misty-mountain photography opening the story and honey amber marking only where you are and the way in. Operate-mode screens: familiar controls, brand lives in type, palette and photography.

## Colors

- **Forest** carries structure: headings, primary buttons, links, selected rows.
- **Paper / surface** are the ground and panels; **paper-deep** is the second neutral (totals, skeletons).
- **Honey** is rare: active bottom-nav indicator, hero entry button, current order step, pending status.
- State colours only where they mean something: honey-soft (pending payment), sky-soft (shipping), forest (delivered/paid), danger (errors).

## Typography

Two families via `next/font/google`: **Mitr** (500) for h1/h2, hero and card titles only; **IBM Plex Sans Thai** for everything else. Fixed rem scale (12–28px, hero up to 44px), Thai line-height 1.6–1.75. No eyebrow/kicker labels above headings.

## Layout

Single column `min(100% - 32px, 1040px)`; customer pages reserve space for the fixed bottom nav (`--nav-h` + safe area). The home hero is full-bleed with gutters on its content. Grids collapse at 959/660px; service detail becomes gallery | info at ≥900px. No horizontal overflow at 360px.

## Elevation & Depth

Declare elevation once: photo cards (offers, services, products) use `--shadow-card` → `--shadow-lift` on hover; static panels use a 1px `line` border and no shadow. The only gradient is the hero legibility scrim.

## Shapes

Panels and cards 16px, buttons/inputs 10–12px, pills only for chips, badges, filter tabs and small header links. Images keep fixed aspect ratios (4:3 cards, 16:9 phone offer cards, square product thumbs).

## Components

- **BottomNav** (`src/app/components/bottom-nav.tsx`): หน้าหลัก / My Trip / My Order with line icons; `aria-current` + honey top bar for the active tab.
- **AppHeader / Brand** (`src/app/components/app-header.tsx`): logo + name, or a back link; actions on the right.
- **Icon** (`src/app/components/icons.tsx`): authored 24px line icons, 1.75 stroke. No emoji or glyph icons.
- **action-bar**: wraps a screen's single main action so it stays sticky above the nav while its section is visible.
- **package-choice**: checkbox/radio rows as full-width selectable targets (checked = forest border + leaf-soft).
- **status-badge**: `status-<order status>`, `status-pending`, `status-paid-demo` (outline "ชำระเงินแล้ว").

## Do's and Don'ts

### Do:
- Reuse tokens and the components above; keep one primary action per screen.
- Let real photography tell the place; give each image a role and a fixed crop.

### Don't:
- Add decorative gradients, glass, glow, or cards that hold nothing.
- Add ratings, reviews, pagination, or content facts not present in data.
- Show จำลอง / ตัวอย่าง / เดโม in the UI.
