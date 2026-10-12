# Syllabus Study Lab

A small study app that turns a syllabus into theory questions, practice questions, and Python coding exercises. It includes a browser-based Python runner that checks generated test cases and explains failures.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
3. Run `npm start` and open http://localhost:3000.

The API key stays in the local server environment. Syllabus text is sent to the configured OpenAI model to create study material. Python snippets run in an isolated browser worker using Pyodide; no student code is sent to the server.

Supports pasted syllabus text and .txt/.md uploads in this first version. PDFs, DOCX, and other programming-language runners are not included yet.
