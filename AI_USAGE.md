# AI Usage & Pair Programming Report

This document reports the AI tools used during development and details three specific instances where AI produced incorrect code or met execution environment failures, and how they were resolved.

## AI Tools & Prompts Used
* **AI Coding Assistant**: Antigravity, powered by Google Gemini 3.5.
* **Core Prompts**:
  * "Build a production-ready Shared Expenses Management Web Application..."
  * "Create database seed script..."
  * "Write unit tests for the CSV importer..."

---

## Technical Case Studies: AI Failures & Corrections

### Case 1: Parent PowerShell Quote Expansion Mismatch
* **Issue**: The AI attempted to run a multi-line PowerShell command download inline using `powershell -Command "..."`. Because of the double-quotes wrapper, the parent shell expanded variables starting with `$` (like `$url` and `$zip`) into empty strings *before* launching the subshell.
* **How Identified**: The execution failed with:
  ```
  = : The term '=' is not recognized as the name of a cmdlet...
  ```
* **Correction**: We wrote a dedicated PowerShell script (`download_node.ps1`) and executed it directly without quote wrapping, or wrapped paths inside batch files (`.bat`) which bypasses subshell string expansions.

---

### Case 2: Vite 9 Template Mismatch with Node v20.11.1
* **Issue**: The AI ran `npx create-vite@latest` to bootstrap the React frontend. Vite 9 requires Node v20.19.0+ or v22.12.0+ because it utilizes the `node:util` module's `styleText` function which is absent in our local Node `v20.11.1`.
* **How Identified**: The scaffolding aborted with:
  ```
  SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'
  ```
* **Correction**: We modified the setup command to target a compatible version: `npx -y create-vite@5 ./ --template react` which is designed for Vite 5, fully supporting Node v20.11.1.

---

### Case 3: Prisma CDN Transient Connection Resets
* **Issue**: During `npm install`, Prisma's post-installation script tries to download its native database engines from the Prisma CDN. This triggered a TCP socket close error (`ECONNRESET`) due to transient network latency on Windows.
* **How Identified**: The npm install failed with:
  ```
  npm ERR! path D:\placements\SPREETAIL\backend\node_modules\@prisma\engines
  npm ERR! Error: aborted (code: ECONNRESET)
  ```
* **Correction**: The AI wrote a batch installer script (`run_npm.bat`) to isolate path variables and ran it with automated command-level retries. The second execution successfully resumed download cache pipelines and succeeded.
