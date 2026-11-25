PrepAtoZ
========
A personal AI-engineering interview study desk with concepts, worked examples,
architecture incidents, detailed follow-ups, self-assessment and PDF guides.
20 public study tracks with 332 questions, plus 23 protected project questions
for the administrator. The dedicated MCP quiz has 20 single-answer questions.

Run
---
Use Node 22.13 or later. Run `npm ci --omit=optional`, then `npm start` in this
folder and open http://127.0.0.1:4173. Local accounts use SQLite automatically.
For offline guest-only use, open dist/index.html directly.
Run `npm run check` to check the content contract and JavaScript syntax.
The editable bank is content/library.json. After changing it, run
`python tools/export-content.py` to regenerate dist/data.js. Existing question
titles determine stable IDs, so preserve titles when retaining saved progress.

Study
-----
Your desk: daily practice plus an interactive incident diagnosis exercise.
Study tracks: plain-language definitions, technical answers and worked examples.
Question bank: reveal an answer, then take each follow-up challenge.
Scenario lab: RAG, LLM, multi-agent, AWS, ML and development incidents.
Practice: a two-minute timer, your own draft, model answer and self-assessment.
Focus mode and light/dark themes support longer study sessions.

Progress
--------
Notes, bookmarks and self-assessments are stored in this browser's localStorage.
Guest progress expires 24 hours after the guest visit starts; this is not a
sliding expiration. Signing in syncs progress to the account database. Local
account caches are scoped per user and removed on sign-out. Export/import from
My progress is also available. Existing question IDs are preserved.
There is no live AI judge or model endpoint. Free-text interview rehearsal uses
self-assessment; the MCP quiz checks choices against an explained answer key.

Content
-------
Architecture examples and numbers are study exercises unless explicitly tied
to verified project evidence. Resume prep distinguishes evidence limitations.
Framework APIs and cloud service limits change; consult the linked primary docs.

Hosting
-------
netlify.toml publishes dist, bundles the API function and runs content checks.
General material can be public. SQL Copilot project questions and original
project PDFs are server-only and require an authenticated admin role. General
SQL basics and other project questions remain public. Memorae AI is unchanged.
Use a PRIVATE GitHub repository because it contains the private source bank.
Do not publish server/, private/, content/ or the repository root as static files.
See ACCOUNT-SETUP.txt for the database and administrator setup required online.
Without a cloud database, public guest learning and quizzes still work, but
online accounts and the administrator vault stay unavailable and fail closed.

Quiz room and daily practice (v1.2)
---------------------------------
106 multiple-choice questions cover all 20 public tracks. Mixed rounds sample
across tracks before repeating a track; choose 10, 20 or the full bank. Each
answer locks on checking and reveals the explanation and answered follow-ups.
The 379 public lessons retain every previous question and add 47 worked
definitions, numerical drills and production/domain scenarios.
Question of the day uses the device local calendar and the public bank only.
Streaks count quiz answers, daily practice and self-assessed learning actions,
not page visits. Account activity and topic scores sync with progress. Guest
progress retains its original fixed 24-hour expiry. Download PDFs include the
new explanations and formulas.
