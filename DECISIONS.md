# Technical & Design Decisions

This document details major decisions made during the Spreetail Shared Expenses application design.

## 1. Monorepo Directory Structure
* **Problem**: How to organize frontend and backend codebases for ease of development and execution.
* **Options Considered**:
  1. Separate repositories.
  2. Single monorepo folder.
* **Chosen Solution**: Option 2. Both `backend` and `frontend` are contained within `D:\placements\SPREETAIL`.
* **Reason**: Single location matches the environment workspace constraints, simplifies running scripts with the portable Node path, and coordinates unified testing.

---

## 2. Using SQLite locally with PostgreSQL capability in production
* **Problem**: The host Windows environment did not have PostgreSQL or Docker installed, making a pure PostgreSQL setup impossible for local runs.
* **Options Considered**:
  1. Force user to install PostgreSQL.
  2. Use SQLite for local development and test, while keeping schema compatible with PostgreSQL.
* **Chosen Solution**: Option 2.
* **Reason**: SQLite is a zero-configuration, single-file database that runs out of the box with Prisma. We mapped models to be fully compatible with PostgreSQL so the user can easily swap the provider in `schema.prisma` and deploy to staging/production on Render.

---

## 3. Greedy Debt Simplification Algorithm
* **Problem**: How to minimize transactions (e.g. Rohan owes Aisha, Aisha owes Priya).
* **Options Considered**:
  1. Direct splits (no simplification; everyone pays back exactly what they owe per expense).
  2. Greedy match using min-heap/sorting on net balances.
* **Chosen Solution**: Option 2.
* **Reason**: Direct splitting generates high transaction counts and clutter. The greedy net balance matching algorithm minimizes the total number of transactions and simplifies settlements.

---

## 4. Dark Glassmorphism Visual Theme
* **Problem**: Default React/Vite templates look simple and basic.
* **Options Considered**:
  1. Vanilla Tailwind styling.
  2. Dark glassmorphism theme with Google fonts and interactive visual grids.
* **Chosen Solution**: Option 2.
* **Reason**: Dark glassmorphic panels, rich backdrop filters, radial gradients, and modern custom scrollbars create an exceptional premium visual aesthetic.
