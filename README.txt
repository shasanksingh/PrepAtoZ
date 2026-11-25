PrepAtoZ
========
A personal AI-engineering interview study desk with concepts, worked examples,
architecture incidents, detailed follow-ups, self-assessment and PDF guides.
19 tracks, 335 main questions, 769 answered follow-ups and 60 scenario drills.

Run
---
No dependencies or API key are required.
Run `npm start` in this folder and open http://127.0.0.1:4173.
For offline use, open dist/index.html directly.
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
They are not uploaded or synchronized. Export/import from My progress to move
between the file, localhost, a hosted origin or another browser.
The original storage key and question IDs were retained during the redesign.
There is no live AI judge or model endpoint; practice feedback is self-assessment.

Content
-------
Architecture examples and numbers are study exercises unless explicitly tied
to verified project evidence. Resume prep distinguishes evidence limitations.
Framework APIs and cloud service limits change; consult the linked primary docs.

Hosting
-------
netlify.toml publishes dist and runs the content check before building.
Use a PRIVATE GitHub repository. Configure Netlify project visibility as Private
before uploading/deploying this personalized library. robots.txt/noindex only
discourage indexing; they are not access control. Do not publish secrets or notes.
See DEPLOYMENT.txt for the remaining Netlify steps.
