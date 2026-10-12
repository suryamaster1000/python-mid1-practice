# Syllabus Study Lab

A study app that turns syllabus text into theory questions, multiple-choice practice, and Python coding exercises. The code challenge runner checks test cases in an isolated browser worker and reports incorrect output or Python errors with line information when available.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and add your OpenAI API key to `OPENAI_API_KEY`.
3. Run `npm start` and open http://localhost:3000.

Keep `.env` private. It is excluded by `.gitignore`. Never paste the key into the app page, chat, or a committed file.

## Deploy

Deploy this repository to a host that runs Node.js applications and uses `npm start` as the start command. Add `OPENAI_API_KEY` as a private environment variable in the hosting dashboard. You can optionally set `OPENAI_MODEL` and `PORT` there too. Do not deploy this as a static GitHub Pages site: the app needs a server to keep the API key private.

## What it supports

- Paste syllabus text or upload a `.txt`/`.md` file (up to 1 MB).
- Generate theory Q&A, multiple-choice quizzes, or one Python function challenge with edge-case tests.
- Reveal answers and explanations after attempting the question.
- Run generated Python tests in the browser with Pyodide. Student code is not sent to the app server.

PDF/DOCX uploads and execution for other programming languages are not included in this first version. The Python runtime is loaded from jsDelivr, so code challenges need an internet connection.
