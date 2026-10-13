# Syllabus Study Lab

Syllabus Study Lab is an interactive university-level assessment portal. Students upload a text-based PDF, TXT, or Markdown syllabus (or paste an outline), choose the question type, question count, difficulty, assessment standard, and duration, then take timed tests and review AI feedback inside the website. Students can start without an email or password; Supabase creates a temporary anonymous session in the current browser.

## Student activities

- **Theory Q&A:** revise concepts with reference explanations.
- **Written test:** write open-ended answers, submit them for criterion-based AI feedback, and review an estimated score, missing concepts, and reference answers. The answer key stays encrypted on the server until submission.
- **Practice quiz:** answer syllabus-based multiple-choice questions with immediate explanations.
- **Code practice:** generate a challenge in a language or markup topic found in the syllabus (Python, HTML, CSS, JavaScript, C, C++, Java, C#, PHP, or SQL). Submit code for rubric-based AI feedback with line references where possible. Python challenges can run generated examples in the browser; HTML challenges include an isolated preview.

AI scores are practice estimates, not official grades. Code review is model-based and does not compile or execute C++, Java, and other general-purpose languages. The separate Python example runner is the only code execution feature and runs in a browser worker.

## Requirements

- A Supabase project with anonymous sign-ins enabled. Text-based PDF syllabuses are extracted in the browser with PDF.js; scanned image-only PDFs require OCR or manual text input.
- An OpenRouter API key saved as a Supabase Edge Function secret named `OPENROUTER_API_KEY`. The current deployed function also accepts the existing secret name `openrutor key`. Never add the API key to this repository or browser code.
- GitHub Pages configured to deploy the `public/` directory through the included Actions workflow.

The Edge Function source is in `supabase/functions/generate-study-set/index.ts`. Deploy it to the connected Supabase project after changing it. The static site publishes from `main` automatically.

## Privacy and session behavior

Syllabus text, submitted test answers, and submitted code are sent to the Edge Function for AI generation or evaluation and are not saved by this app. Encrypted assessment and challenge tokens expire after one hour and are tied to the anonymous session that created them. Clearing browser data or switching browsers starts a new session.
