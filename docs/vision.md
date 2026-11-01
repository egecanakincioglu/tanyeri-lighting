# Vision

## What

A bilingual (Turkish and English) corporate website with a product catalog, and an admin panel to manage it, for a fictional lighting brand. The project is source-available under the PolyForm Noncommercial License 1.0.0 and has a live demo on Vercel.

## Why

The project started in 2023 as a website for a client. The rewrite takes the same idea and builds it again from scratch with current engineering standards. The goal is a project that developers can read and learn from, and that anyone can take and adapt for their own noncommercial use.

## Who it is for

- Developers who read the repository on GitHub.
- Visitors of the live demo.
- People who want to take the project and adapt it.

## Principles

- Security first: no known hole stays open, and no secret or personal data enters the repository.
- Code without tests does not reach `main`.
- Every change is traceable: atomic signed commits, a pull request and green CI.
- A simple architecture, without over-engineering.
- It runs on Vercel but does not depend on it.
- The interface is accessible, fast and pixel perfect on every device.
- The documentation stays current.

## Scope

- Public pages: home, products (categories and product pages), catalogs, services, projects, references, about (including the vision), contact, privacy and terms.
- Admin panel: content and product management, messages and visit statistics.
- A read-only demo admin.
- An optional Google Ads module.

## Out of scope

- Being the live site of a real company.
- E-commerce and payments.
- Multi-tenancy.
- Any content that belongs to the former client.

## More

See the [architecture overview](architecture.md) for how the application is built, and the [roadmap](roadmap.md) for the phases and the current status.
