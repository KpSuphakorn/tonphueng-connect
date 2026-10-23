# Product

<!-- impeccable:product-schema 1 -->

Requirements live in the approved spec: [.scratch/tonphueng-connect/spec.md](.scratch/tonphueng-connect/spec.md). Terms: [CONTEXT.md](CONTEXT.md). Repo rules: [AGENTS.md](AGENTS.md). This file only records the product facts design work must respect.

## Platform

web (mobile-first; opened mainly inside LINE through LIFF)

## Users

- Customer: visitors from outside Ban Ton Phueng browsing on a phone inside LINE — packages, community products, services, My Trip, My Order.
- Staff: approved community business owners managing their own profile, products and orders.
- Admin: project caretakers approving Staff, defining packages, viewing bookings, adding Admins.

## Product Purpose

Tonphueng Connect is the LINE OA web app of the "ผึ้งพาเดิน" community nature-tourism project at Ban Ton Phueng, Chiang Mai: discover, order or book, and follow up in one place (spec: Problem Statement / Solution).

## Capabilities and Constraints

- Customer bottom navigation is fixed to Main Page / My Trip / My Order; Main Page shows Package, Product Order and บริการของเรา (spec stories 3–4).
- No ratings, reviews or service pagination (spec stories 13, Out of Scope).
- UI never shows the words จำลอง / ตัวอย่าง / เดโม (spec "UI labelling update"); payments read as normal QR steps without claiming bank verification.
- Business content (distances, durations, prices) comes only from stored data — never invent it in UI copy.

## Brand Commitments

- Name and mascot: "ผึ้งพาเดิน" bee logo, owner asset copied to `public/images/logo.jpeg`.
- Photography credited on `/credits` (CC licences from Wikimedia Commons).

## Evidence on Hand

Demo business data and photos: `scripts/demo-data/`. No testimonials, ratings or statistics exist; do not fabricate them.

## Accessibility & Inclusion

Thai-first copy, phone-sized touch targets (≥44px), visible focus, reduced-motion respected, legible at 360px width.
