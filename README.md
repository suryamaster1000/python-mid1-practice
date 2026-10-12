# Syllabus Study Lab

A browser-based study app that turns syllabus text into theory questions, multiple-choice practice, and beginner Python coding challenges. Supabase handles student sign-in and securely calls OpenAI from an Edge Function. Python code runs in the browser with Pyodide; it is not sent to the server.

## One-time setup

1. In Supabase, open **Edge Functions → Secrets** for project `psvqvwdaifieeohegqtd` and add `OPENAI_API_KEY`. The key must stay in Supabase secrets; never add it to GitHub or browser code.
2. In Supabase **Authentication → URL Configuration**, set the site URL to `https://suryamaster1000.github.io/python-mid1-practice/` and allow that URL for sign-up confirmation redirects.
3. In GitHub, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**. The workflow publishes the `public/` folder on pushes to `main`.

After the first workflow completes, the site is at https://suryamaster1000.github.io/python-mid1-practice/.

## Use the app

- Students create an account or sign in with email and password.
- Paste a syllabus or upload a `.txt`/`.md` file (up to 1 MB).
- Generate theory Q&A, a multiple-choice quiz, or one Python coding problem.
- Reveal answers after attempting questions. Coding exercises report failing cases and Python errors, including line numbers when available.

## Limits

PDF/DOCX uploads and runners for languages other than Python are not included yet. The Python runtime is loaded from jsDelivr, so coding questions need an internet connection. Question generation requires a valid OpenAI API key configured as a Supabase Edge Function secret.
