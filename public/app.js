import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const supabase = createClient(
  "https://wewoaiuxnagmzkbhlsyt.supabase.co",
  "sb_publishable_TfwYeoDBS9LZyHRckOvfrA_fEiOkDrH",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
const authStatus = document.querySelector("#authStatus");
const authNote = document.querySelector("#authNote");
let currentSession = null;

const syllabusInput = document.querySelector("#syllabusInput");
const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const charCount = document.querySelector("#charCount");
const countSelect = document.querySelector("#countSelect");
const generateBtn = document.querySelector("#generateBtn");
const message = document.querySelector("#message");
const results = document.querySelector("#results");
const resultBadge = document.querySelector("#resultBadge");
const durationSelect = document.querySelector("#durationSelect");
const levelSelect = document.querySelector("#levelSelect");
const topSessionLabel = document.querySelector("#topSessionLabel");
const dashboardTestCount = document.querySelector("#dashboardTestCount");
const dashboardLatestScore = document.querySelector("#dashboardLatestScore");
const dashboardScoreNote = document.querySelector("#dashboardScoreNote");
const tabs = [...document.querySelectorAll(".mode-tab")];
const navItems = [...document.querySelectorAll(".nav-item[data-view]")];
let activeMode = "theory";
let currentProblem = null;
let currentTestToken = null;
let examTimerInterval = null;
let sessionTestsCompleted = 0;
let latestScorePercent = null;

async function syncAuth(session) {
  currentSession = session;
  const signedIn = Boolean(session?.user);
  authStatus.textContent = signedIn ? "Student session ready" : "Connecting securely…";
  authNote.textContent = signedIn ? "Temporary anonymous session ready. This session stays in this browser." : "Connecting to a temporary student session. No email or password is needed.";
  if (topSessionLabel) topSessionLabel.textContent = signedIn ? "Session active" : "Connecting…";
  authNote.classList.remove("auth-note-error");
  generateBtn.disabled = !signedIn;
}
supabase.auth.onAuthStateChange((_event, session) => {
  queueMicrotask(() => syncAuth(session));
});
supabase.auth.getSession().then(async ({ data, error }) => { if (error) throw error; let session = data.session; if (!session) { const { data: anonymousData, error: anonymousError } = await supabase.auth.signInAnonymously(); if (anonymousError) throw anonymousError; session = anonymousData.session; } await syncAuth(session); }).catch(error => { authStatus.textContent = "Connection needed"; authNote.textContent = error.message || "Anonymous access is not available right now."; authNote.classList.add("auth-note-error"); generateBtn.disabled = true; });


function openPortalView(view, requestedMode = null) {
  const dashboard = document.querySelector("#dashboardView");
  const workspace = document.querySelector("#workspaceView");
  if (dashboard) dashboard.hidden = view !== "dashboard";
  if (workspace) workspace.hidden = view === "dashboard";
  navItems.forEach(item => item.classList.toggle("active", item.dataset.view === view));
  if (view === "dashboard") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const heading = document.querySelector("#workspaceTitle");
  const subtitle = document.querySelector("#workspaceSubtitle");
  const breadcrumb = document.querySelector("#workspaceBreadcrumb");
  const config = {
    "test-center": ["Test Center", "ASSESSMENTS / TEST CENTER", "Configure a session from your syllabus and attempt it like an online assessment."],
    "syllabus": ["My Syllabus", "MY LEARNING / SYLLABUS", "Upload or paste the course outline your practice questions should be based on."],
    "results": ["Results & Review", "ASSESSMENTS / RESULTS & REVIEW", "Review the assessment or practice set currently open in this session."],
    "practice-lab": ["Practice Lab", "PRACTICE / PRACTICE LAB", "Build focused practice sessions and get feedback on your attempt."]
  };
  const settings = config[view] || config["test-center"];
  if (heading) heading.textContent = settings[0];
  if (subtitle) subtitle.textContent = settings[2];
  if (breadcrumb) breadcrumb.textContent = settings[1];
  if (requestedMode) {
    const targetTab = tabs.find(tab => tab.dataset.mode === requestedMode);
    if (targetTab) targetTab.click();
  } else if (view === "test-center") {
    const targetTab = tabs.find(tab => tab.dataset.mode === "test");
    if (targetTab && activeMode !== "test") targetTab.click();
  } else if (view === "practice-lab") {
    const targetTab = tabs.find(tab => tab.dataset.mode === "code");
    if (targetTab && activeMode !== "code") targetTab.click();
  } else if (view === "results" && !results.childElementCount) {
    setMessage("No results yet. Start a written test or practice activity to see feedback here.");
  }
  if (view === "syllabus") {
    setTimeout(() => syllabusInput.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  } else if (view === "results") {
    setTimeout(() => document.querySelector("#resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
navItems.forEach(item => item.addEventListener("click", () => openPortalView(item.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach(button => {
  button.addEventListener("click", () => openPortalView(button.dataset.openView));
});
document.querySelectorAll("[data-open-mode]").forEach(button => {
  button.addEventListener("click", () => {
    const mode = button.dataset.openMode;
    const view = mode === "code" ? "practice-lab" : "test-center";
    openPortalView(view, mode);
  });
});

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = "message" + (kind ? " " + kind : "");
  message.hidden = false;
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function updateCount() {
  charCount.textContent = `${syllabusInput.value.length.toLocaleString()} / 40,000`;
}
syllabusInput.addEventListener("input", updateCount);
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (file.size > 10_000_000) {
    setMessage("That file is over 10 MB. Choose a smaller syllabus file.", "error");
    fileInput.value = "";
    return;
  }
  try {
    let text = "";
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      setMessage("Reading selectable text from your PDF…");
      const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      if (pdf.numPages > 120) throw new Error("This PDF has more than 120 pages. Upload the relevant syllabus pages only.");
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => ("str" in item ? item.str : "")).join(" "));
      }
      text = pages.join("\n");
      if (!text.trim()) throw new Error("No selectable text was found. This may be a scanned PDF; paste its text or upload a text-based PDF/TXT/Markdown file.");
    } else {
      text = await file.text();
    }
    if (!text.trim()) throw new Error("This file is empty.");
    syllabusInput.value = text.slice(0, 40_000);
    fileName.textContent = file.name;
    updateCount();
    setMessage("Syllabus loaded into the portal. Choose the assessment type and click Generate assessment.");
  } catch (error) {
    setMessage(error.message || "Could not read that file.", "error");
    if (!syllabusInput.value.trim()) fileName.textContent = "No file selected";
  }
});
tabs.forEach(tab => tab.addEventListener("click", () => {
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  activeMode = tab.dataset.mode;
  tabs.forEach(item => item.classList.toggle("selected", item === tab));
  currentProblem = null;
  currentTestToken = null;
  results.replaceChildren();
  resultBadge.textContent = "READY WHEN YOU ARE";
  setMessage(activeMode === "code"
    ? "Generate a coding challenge in a language found in your syllabus, then submit your solution for AI feedback."
    : activeMode === "test"
      ? "Take a written assessment, submit your answers, and get criterion-based AI feedback."
    : activeMode === "practice"
      ? "Generate a multiple-choice quiz. Check each answer to see an explanation."
      : "Generate short-answer questions for active recall.");
}));

generateBtn.addEventListener("click", async () => {
  const syllabus = syllabusInput.value.trim();
  if (syllabus.length < 30) {
    setMessage("Paste or upload at least a few lines of syllabus first.", "error");
    syllabusInput.focus();
    return;
  }
  if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  results.replaceChildren();
  currentProblem = null;
  generateBtn.disabled = true;
  generateBtn.querySelector("span:first-child").textContent = "Generating…";
  resultBadge.textContent = "WORKING";
  setMessage("Reading your syllabus and preparing questions…");
  try {
    if (!currentSession?.access_token) throw new Error("Sign in before generating a study set.");
    const { data, error } = await supabase.functions.invoke("generate-study-set", {
      body: { syllabus, mode: activeMode, count: Number(countSelect.value), level: levelSelect?.value || "university" }
    });
    if (error) {
      let reason = error.message || "Could not generate questions.";
      try {
        const details = await error.context?.json();
        if (details?.error) reason = details.error;
      } catch {}
      throw new Error(reason);
    }
    message.hidden = true;
    resultBadge.textContent = activeMode === "code" ? (data.available === false ? "NO CODE TOPICS" : `${String(data.language || "CODE").toUpperCase()} CHALLENGE`) : `${data.questions?.length ?? 0} QUESTIONS`;
    if (activeMode === "code") {
      if (data.available === false) setMessage(data.reason || "No coding topic was found in this syllabus.", "error");
      else renderCode(data);
    }
    else if (activeMode === "test") renderTest(data);
    else if (activeMode === "theory") renderTheory(data);
    else renderQuiz(data);
    if (!results.childElementCount && !(activeMode === "code" && data.available === false)) throw new Error("The response did not contain questions. Try generating again.");
  } catch (error) {
    results.replaceChildren();
    resultBadge.textContent = "NEEDS ATTENTION";
    setMessage(error.message || "Something went wrong.", "error");
  } finally {
    generateBtn.disabled = false;
    generateBtn.querySelector("span:first-child").textContent = "Generate study set";
  }
});

function renderTheory(data) {
  for (const [index, item] of (data.questions || []).entries()) {
    const card = el("article", "question-card");
    const top = el("div", "question-top");
    top.append(el("span", "question-num", String(index + 1).padStart(2, "0")));
    top.append(el("span", "topic-pill", item.topic || "Review"));
    top.append(el("span", "difficulty", item.difficulty || "medium"));
    card.append(top, el("h3", "", item.question || ""));
    const toggle = el("button", "answer-toggle", "Show answer");
    toggle.type = "button";
    const answer = el("div", "answer-box");
    answer.hidden = true;
    const heading = el("strong", "", "Answer  ");
    answer.append(heading, document.createTextNode(item.answer || ""));
    if (item.explanation) {
      const extra = el("p", "", item.explanation);
      extra.style.margin = "7px 0 0";
      answer.append(extra);
    }
    toggle.addEventListener("click", () => {
      answer.hidden = !answer.hidden;
      toggle.textContent = answer.hidden ? "Show answer" : "Hide answer";
    });
    card.append(toggle, answer);
    results.append(card);
  }
}

async function invokeFunction(body) {
  const { data, error } = await supabase.functions.invoke("generate-study-set", { body });
  if (error) {
    let reason = error.message || "Could not complete this request.";
    try {
      const details = await error.context?.json();
      if (details?.error) reason = details.error;
    } catch {}
    throw new Error(reason);
  }
  return data;
}

function renderTest(test) {
  currentTestToken = test.testToken;
  if (!Array.isArray(test.questions) || !test.questions.length) throw new Error("The test did not include any questions. Please try again.");

  const heading = el("div", "assessment-intro");
  heading.append(el("h3", "", test.title || "Written assessment"));
  heading.append(el("p", "", test.summary || "Answer the questions below, keep an eye on the timer, then submit for feedback."));
  heading.append(el("div", "assessment-meta", test.questions.length + " questions · " + test.questions.reduce((sum, question) => sum + question.points, 0) + " points · AI-evaluated practice"));
  results.append(heading);

  const toolbar = el("div", "test-toolbar");
  const toolbarLabel = el("div", "test-toolbar-label");
  toolbarLabel.append(el("span", "", "TIMED ASSESSMENT"), el("strong", "", "Answer every question you can"));
  const timer = el("div", "test-timer");
  timer.id = "testTimer";
  timer.setAttribute("role", "timer");
  timer.setAttribute("aria-live", "off");
  const durationMins = Math.max(1, Number(durationSelect?.value) || 30);
  let secondsLeft = durationMins * 60;
  let timeExpired = false;
  const updateTimer = () => {
    const mins = Math.floor(Math.max(0, secondsLeft) / 60);
    const secs = Math.max(0, secondsLeft) % 60;
    timer.textContent = "◷ " + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    timer.classList.toggle("warning", secondsLeft <= 300 && secondsLeft > 0);
    timer.classList.toggle("expired", secondsLeft <= 0);
  };
  updateTimer();
  toolbar.append(toolbarLabel, timer);
  results.append(toolbar);

  const answerFields = new Map();
  const palette = el("nav", "question-palette");
  palette.setAttribute("aria-label", "Question navigation");
  palette.append(el("span", "palette-title", "JUMP TO"));
  const questionCards = [];

  for (const [index, question] of test.questions.entries()) {
    const number = index + 1;
    const card = el("article", "question-card test-question");
    card.id = "test-question-" + number;
    const top = el("div", "question-top");
    top.append(el("span", "question-num", "QUESTION " + String(number).padStart(2, "0")));
    top.append(el("span", "topic-pill", question.topic || "Assessment"));
    top.append(el("span", "difficulty", question.points + " points"));
    card.append(top, el("h3", "", question.question || ""));
    const answer = document.createElement("textarea");
    answer.className = "written-answer";
    answer.id = "test-answer-" + String(question.id || number).replace(/[^a-zA-Z0-9_-]/g, "-");
    answer.placeholder = "Write your answer here…";
    answer.maxLength = 8000;
    answer.setAttribute("aria-label", "Answer for question " + number);
    answerFields.set(question.id, answer);
    card.append(answer);

    const markReview = el("button", "mark-review-btn", "☆ Mark for review");
    markReview.type = "button";
    markReview.setAttribute("aria-pressed", "false");
    markReview.addEventListener("click", () => {
      const isMarked = markReview.getAttribute("aria-pressed") !== "true";
      markReview.setAttribute("aria-pressed", String(isMarked));
      markReview.textContent = isMarked ? "★ Marked for review" : "☆ Mark for review";
      paletteButton.classList.toggle("review", isMarked);
    });
    card.append(markReview);
    answer.addEventListener("input", () => {
      paletteButton.classList.toggle("answered", Boolean(answer.value.trim()));
    });
    results.append(card);
    questionCards.push(card);

    const paletteButton = el("button", "palette-item", String(number));
    paletteButton.type = "button";
    paletteButton.setAttribute("aria-label", "Go to question " + number);
    paletteButton.addEventListener("click", () => {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      answer.focus({ preventScroll: true });
    });
    palette.append(paletteButton);
  }
  const legend = el("span", "palette-legend");
  legend.append(el("span", "", "● Answered"), el("span", "", "● Review"));
  legend.children[0].prepend(el("i", "legend-key"));
  legend.children[1].prepend(el("i", "legend-key review-key"));
  palette.append(legend);
  results.insertBefore(palette, questionCards[0]);

  const submitRow = el("div", "test-submit-row");
  const submit = el("button", "primary-btn submit-test", "Submit written test");
  submit.type = "button";
  const submitNote = el("span", "test-submit-note", "Submission ends the timer. AI feedback appears after evaluation.");
  submitRow.append(submit, submitNote);
  const gradePanel = el("section", "grade-panel");
  gradePanel.hidden = true;
  results.append(submitRow, gradePanel);

  submit.addEventListener("click", async () => {
    const timedOut = submit.dataset.autoSubmit === "true" || timeExpired;
    submit.dataset.autoSubmit = "false";
    const answers = Object.fromEntries([...answerFields].map(([id, field]) => [id, field.value.trim()]));
    if (!timedOut && Object.values(answers).every(answer => !answer)) {
      setMessage("Write at least one answer before submitting your test.", "error");
      return;
    }
    if (!timedOut && !window.confirm("Submit this test now? You will not be able to edit your answers after successful evaluation.")) return;
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
    submit.disabled = true;
    submit.textContent = timedOut ? "Time ended · evaluating…" : "Evaluating your answers…";
    setMessage(timedOut ? "Time is up. Your answers are being submitted for evaluation." : "AI is checking your answers against the syllabus and grading criteria. This may take a few seconds.");
    try {
      const grade = await invokeFunction({ mode: "evaluate-test", testToken: currentTestToken, answers });
      for (const field of answerFields.values()) field.disabled = true;
      for (const card of questionCards) {
        card.querySelector(".mark-review-btn")?.setAttribute("disabled", "true");
      }
      gradePanel.replaceChildren();
      gradePanel.hidden = false;
      const score = el("div", "grade-score");
      score.append(el("strong", "", grade.score + " / " + grade.totalPoints), el("span", "", grade.percent + "% · AI practice estimate"));
      gradePanel.append(score, el("p", "grade-overall", grade.overallFeedback || "Review the feedback for each question."));
      for (const [index, question] of test.questions.entries()) {
        const item = (grade.results || []).find(result => result.id === question.id) || {};
        const feedback = el("article", "grade-item");
        feedback.append(el("strong", "grade-item-title", "Q" + (index + 1) + " · " + (item.awardedPoints ?? 0) + "/" + (item.points ?? question.points) + " points"));
        feedback.append(el("p", "", item.feedback || "Review the reference answer below."));
        if (item.missingConcepts?.length) feedback.append(el("p", "grade-missing", "Review: " + item.missingConcepts.join(", ")));
        if (item.referenceAnswer) feedback.append(el("p", "grade-reference", "Reference answer: " + item.referenceAnswer));
        gradePanel.append(feedback);
      }
      resultBadge.textContent = grade.percent + "% · " + grade.score + "/" + grade.totalPoints;
      if (message) message.hidden = true;
      submit.textContent = "Test submitted";
      submitRow.append(el("span", "test-submit-note", "Completed · review your score and question-wise feedback below."));
      sessionTestsCompleted += 1;
      latestScorePercent = Number(grade.percent);
      if (dashboardTestCount) dashboardTestCount.textContent = String(sessionTestsCompleted);
      if (dashboardLatestScore) dashboardLatestScore.textContent = Number.isFinite(latestScorePercent) ? latestScorePercent + "%" : "—";
      if (dashboardScoreNote) dashboardScoreNote.textContent = "Latest written test · session only";
    } catch (error) {
      setMessage(error.message || "Could not evaluate your test. Please try again.", "error");
      submit.disabled = false;
      submit.textContent = timeExpired ? "Retry evaluation" : "Submit written test";
    }
  });

  examTimerInterval = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      secondsLeft = 0;
      timeExpired = true;
      updateTimer();
      clearInterval(examTimerInterval);
      examTimerInterval = null;
      submit.dataset.autoSubmit = "true";
      setMessage("Time is up. The portal is submitting your current answers.", "error");
      submit.click();
      return;
    }
    updateTimer();
  }, 1000);
  window.setTimeout(() => questionCards[0]?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}

function renderQuiz(data) {
  for (const [index, item] of (data.questions || []).entries()) {
    const card = el("article", "question-card");
    const top = el("div", "question-top");
    top.append(el("span", "question-num", String(index + 1).padStart(2, "0")));
    top.append(el("span", "topic-pill", item.topic || "Practice"));
    top.append(el("span", "difficulty", item.difficulty || "medium"));
    card.append(top, el("h3", "", item.question || ""));
    const options = el("div", "options");
    const group = `question-${index}`;
    (item.options || []).forEach((option, optionIndex) => {
      const label = el("label", "option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = group;
      input.value = String(optionIndex);
      label.append(input, el("span", "", option));
      options.append(label);
    });
    const check = el("button", "answer-toggle", "Check answer");
    check.type = "button";
    const feedback = el("div", "quiz-feedback");
    feedback.hidden = true;
    check.addEventListener("click", () => {
      const chosen = card.querySelector(`input[name="${group}"]:checked`);
      if (!chosen) { feedback.textContent = "Choose an option first."; feedback.hidden = false; return; }
      const correctIndex = Number(item.answerIndex);
      const correct = Number(chosen.value) === correctIndex;
      feedback.textContent = `${correct ? "Correct." : "Not quite."} ${item.explanation || ""}`;
      feedback.style.color = correct ? "#396c43" : "#a44c31";
      feedback.hidden = false;
      card.querySelectorAll(".option").forEach((option, optionIndex) => option.classList.toggle("correct", optionIndex === correctIndex));
    });
    card.append(options, check, feedback);
    results.append(card);
  }
}

function renderCode(problem) {
  currentProblem = problem;
  if (!problem || !problem.challengeToken || !problem.language) throw new Error("The generated challenge is incomplete. Please try again.");
  const card = el("article", "code-card");
  const head = el("div", "code-card-head");
  head.append(el("h3", "", problem.title || `${problem.language.toUpperCase()} challenge`), el("span", "topic-pill", `${problem.language.toUpperCase()} · ${problem.topic || "Practice"}`));
  card.append(head, el("div", "code-prompt", problem.prompt || ""));
  const testList = el("div", "test-list");
  (problem.tests || []).forEach((test, i) => testList.append(el("span", "test-chip", `Example ${i + 1} · ${test.description || "case"}`)));
  if (testList.childElementCount) card.append(testList);
  const label = el("div", "editor-label", problem.fileName || "solution.txt");
  const editor = document.createElement("textarea");
  editor.className = "code-editor";
  editor.id = "codeEditor";
  editor.spellcheck = false;
  editor.autocapitalize = "off";
  editor.autocomplete = "off";
  editor.setAttribute("aria-label", `${problem.language} code editor`);
  editor.maxLength = 30000;
  editor.value = problem.starterCode || "";
  const actions = el("div", "editor-actions");
  const evaluate = el("button", "run-btn", "✳  Submit code for AI evaluation");
  evaluate.type = "button";
  actions.append(evaluate);
  const note = el("span", "editor-note", problem.language === "python" ? "Run examples or ask AI for feedback" : "AI checks your solution against the challenge rubric");
  actions.append(note);
  card.append(label, editor, actions);

  if (problem.language === "python" && problem.tests?.length) {
    const localActions = el("div", "editor-actions");
    const run = el("button", "answer-toggle", "▶ Run example tests");
    run.type = "button";
    const output = el("pre", "run-output");
    localActions.append(run, el("span", "editor-note", "Runs locally in this browser"));
    card.append(localActions, output);
    run.addEventListener("click", () => runCode(editor.value, problem, run, output));
  }

  if (problem.language === "html") {
    const preview = el("details", "html-preview");
    preview.append(el("summary", "", "Preview your HTML"));
    const frame = document.createElement("iframe");
    frame.className = "html-preview-frame";
    frame.title = "Isolated HTML preview";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.srcdoc = "<p style='font:14px sans-serif;color:#68766e;padding:12px'>Your page preview appears here.</p>";
    preview.append(frame);
    const refresh = el("button", "answer-toggle", "Refresh preview");
    refresh.type = "button";
    refresh.addEventListener("click", () => { frame.srcdoc = editor.value; });
    card.append(preview, refresh);
  }

  const status = el("div", "message", "AI feedback is an estimate for practice, not an official exam grade.");
  const evaluation = el("section", "grade-panel code-grade");
  evaluation.hidden = true;
  card.append(status, evaluation);
  evaluate.addEventListener("click", async () => {
    if (!editor.value.trim()) { setMessage("Write some code before submitting it for feedback.", "error"); editor.focus(); return; }
    evaluate.disabled = true;
    evaluate.textContent = "AI is reviewing your solution…";
    status.textContent = "Checking your work against the challenge, rubric, and syllabus level…";
    status.className = "message";
    evaluation.hidden = true;
    evaluation.replaceChildren();
    try {
      const review = await invokeFunction({ mode: "evaluate-code", challengeToken: problem.challengeToken, source: editor.value });
      evaluation.hidden = false;
      const score = el("div", "grade-score");
      score.append(el("strong", "", `${review.score}/100`), el("span", "", `${review.verdict} · AI practice estimate`));
      evaluation.append(score, el("p", "grade-overall", review.overallFeedback || "Review the findings below."));
      for (const item of review.findings || []) {
        const finding = el("article", `code-finding ${item.severity || "suggestion"}`);
        finding.append(el("strong", "", `${item.severity || "Feedback"}${item.line ? ` · Line ${item.line}` : ""}`));
        finding.append(el("p", "", item.issue || "Review this part of the solution."), el("p", "finding-fix", item.fix || ""));
        evaluation.append(finding);
      }
      if (review.strengths?.length) evaluation.append(el("p", "grade-strengths", `Working well: ${review.strengths.join(" · ")}`));
      if (review.sampleSolution) {
        const solution = el("details", "solution-block");
        solution.append(el("summary", "", "View a sample solution after your attempt"), el("pre", "", review.sampleSolution));
        evaluation.append(solution);
      }
      status.hidden = true;
      resultBadge.textContent = `${review.score}/100 · AI FEEDBACK`;
    } catch (error) {
      status.textContent = error.message || "The AI could not review your code. Please try again.";
      status.className = "message error";
      status.hidden = false;
    } finally {
      evaluate.disabled = false;
      evaluate.textContent = "✳  Submit code for AI evaluation";
    }
  });
  results.append(card);
}

function runCode(code, problem, button, output) {
  button.disabled = true;
  output.className = "run-output";
  output.textContent = "Starting the Python runner… first launch can take a few seconds.";
  const worker = new Worker("runner-worker.js");
  const timeout = setTimeout(() => {
    worker.terminate();
    button.disabled = false;
    output.className = "run-output fail";
    output.textContent = "Stopped after 25 seconds. Check for an infinite loop or try simpler code.";
  }, 25_000);
  worker.onmessage = event => {
    clearTimeout(timeout);
    worker.terminate();
    button.disabled = false;
    const result = event.data;
    if (result.error) {
      output.className = "run-output fail";
      output.textContent = result.error;
      return;
    }
    const passed = result.results.filter(item => item.passed).length;
    output.className = `run-output ${passed === result.results.length ? "pass" : "fail"}`;
    output.textContent = result.results.map((item, index) =>
      `${item.passed ? "✓ PASS" : "✗ FAIL"} Test ${index + 1}: ${item.description}\n${item.passed ? "" : `  expected: ${JSON.stringify(item.expected)}\n  got:      ${JSON.stringify(item.actual)}\n`}`
    ).join("\n") + `\n${passed}/${result.results.length} tests passed.`;
  };
  worker.onerror = () => {
    clearTimeout(timeout);
    worker.terminate();
    button.disabled = false;
    output.className = "run-output fail";
    output.textContent = "The browser Python runner could not start. Check your internet connection and reload.";
  };
  worker.postMessage({ code, functionName: problem.functionName, tests: problem.tests || [] });
}
