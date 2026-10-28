# Tanyeri Lighting

Corporate website and admin panel for Tanyeri, a fictional lighting brand: a bilingual (Turkish and English) site with a product catalog, references and a contact form, and a panel to manage all of it.

## Status

I am rewriting this project from scratch in 2026 on a new architecture. Until the rewrite is complete, this repository holds its foundation: documentation, architecture decisions, and the tooling and CI that enforce the workflow. The demo on Vercel will be linked here when it is ready.

## Origin

This project started in 2023 as "Afra Lighting", a website I built for a client. I am closing its known security issues by rewriting it from the ground up and publishing the new version as open source that anyone can use. The old code and its history are not part of this repository.

## Planned stack

Next.js 16 (App Router), TypeScript, PostgreSQL (Neon) with Prisma, Better Auth, Tailwind CSS 4, next-intl and Vitest. The reasoning behind each choice is recorded as architecture decision records in `docs/adr/`.

## Documentation

Project documentation is written in Turkish and lives in `docs/`: vision, roadmap, plans, architecture decisions and a development journal.

## License

[MIT](LICENSE)
