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
const tabs = [...document.querySelectorAll(".mode-tab")];
let activeMode = "theory";
let currentProblem = null;
let currentTestToken = null;

async function syncAuth(session) {
  currentSession = session;
  const signedIn = Boolean(session?.user);
  authStatus.textContent = signedIn ? "Ready to study" : "Connecting securely…";
  authNote.textContent = signedIn ? "Temporary anonymous session ready. This session stays in this browser." : "Connecting to a temporary student session. No email or password is needed.";
  authNote.classList.remove("auth-note-error");
  generateBtn.disabled = !signedIn;
}
supabase.auth.onAuthStateChange((_event, session) => {
  queueMicrotask(() => syncAuth(session));
});
supabase.auth.getSession().then(async ({ data, error }) => { if (error) throw error; let session = data.session; if (!session) { const { data: anonymousData, error: anonymousError } = await supabase.auth.signInAnonymously(); if (anonymousError) throw anonymousError; session = anonymousData.session; } await syncAuth(session); }).catch(error => { authStatus.textContent = "Connection needed"; authNote.textContent = error.message || "Anonymous access is not available right now."; authNote.classList.add("auth-note-error"); generateBtn.disabled = true; });

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
  if (file.size > 1_000_000) {
    setMessage("That file is over 1 MB. Paste the text or choose a smaller .txt/.md file.", "error");
    fileInput.value = "";
    return;
  }
  try {
    const text = await file.text();
    if (!text.trim()) throw new Error("This file is empty.");
    syllabusInput.value = text.slice(0, 40_000);
    fileName.textContent = file.name;
    updateCount();
    setMessage("Syllabus loaded. Choose a practice type and generate your study set.");
  } catch (error) {
    setMessage(error.message || "Could not read that file.", "error");
  }
});
tabs.forEach(tab => tab.addEventListener("click", () => {
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
  results.replaceChildren();
  currentProblem = null;
  generateBtn.disabled = true;
  generateBtn.querySelector("span:first-child").textContent = "Generating…";
  resultBadge.textContent = "WORKING";
  setMessage("Reading your syllabus and preparing questions…");
  try {
    if (!currentSession?.access_token) throw new Error("Sign in before generating a study set.");
    const { data, error } = await supabase.functions.invoke("generate-study-set", {
      body: { syllabus, mode: activeMode, count: Number(countSelect.value) }
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
  const heading = el("div", "assessment-intro");
  heading.append(el("h3", "", test.title || "Written assessment"));
  heading.append(el("p", "", test.summary || "Answer all questions, then submit for AI evaluation."));
  heading.append(el("div", "assessment-meta", `${test.questions.length} questions · ${test.questions.reduce((sum, question) => sum + question.points, 0)} points · AI-evaluated practice`));
  results.append(heading);
  const answerFields = new Map();
  for (const [index, question] of test.questions.entries()) {
    const card = el("article", "question-card test-question");
    const top = el("div", "question-top");
    top.append(el("span", "question-num", String(index + 1).padStart(2, "0")));
    top.append(el("span", "topic-pill", question.topic || "Assessment"));
    top.append(el("span", "difficulty", `${question.points} points`));
    card.append(top, el("h3", "", question.question || ""));
    const answer = document.createElement("textarea");
    answer.className = "written-answer";
    answer.id = `test-answer-${question.id}`;
    answer.placeholder = "Write your answer here…";
    answer.maxLength = 8000;
    answer.setAttribute("aria-label", `Answer for question ${index + 1}`);
    answerFields.set(question.id, answer);
    card.append(answer);
    results.append(card);
  }
  const submit = el("button", "primary-btn submit-test", "Submit written test for AI evaluation");
  submit.type = "button";
  const gradePanel = el("section", "grade-panel");
  gradePanel.hidden = true;
  results.append(submit, gradePanel);
  submit.addEventListener("click", async () => {
    const answers = Object.fromEntries([...answerFields].map(([id, field]) => [id, field.value.trim()]));
    if (Object.values(answers).every(answer => !answer)) {
      setMessage("Write at least one answer before submitting your test.", "error");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Evaluating your answers…";
    setMessage("AI is checking your answers against the syllabus and grading criteria. This may take a few seconds.");
    try {
      const grade = await invokeFunction({ mode: "evaluate-test", testToken: currentTestToken, answers });
      for (const field of answerFields.values()) field.disabled = true;
      gradePanel.hidden = false;
      const score = el("div", "grade-score");
      score.append(el("strong", "", `${grade.score} / ${grade.totalPoints}`), el("span", "", `${grade.percent}% · AI practice estimate`));
      gradePanel.append(score, el("p", "grade-overall", grade.overallFeedback || "Review the feedback for each question."));
      for (const [index, question] of test.questions.entries()) {
        const item = grade.results.find(result => result.id === question.id) || {};
        const feedback = el("article", "grade-item");
        feedback.append(el("strong", "grade-item-title", `Q${index + 1} · ${item.awardedPoints ?? 0}/${item.points ?? question.points} points`));
        feedback.append(el("p", "", item.feedback || "Review the reference answer below."));
        if (item.missingConcepts?.length) feedback.append(el("p", "grade-missing", `Review: ${item.missingConcepts.join(", ")}`));
        if (item.referenceAnswer) feedback.append(el("p", "grade-reference", `Reference answer: ${item.referenceAnswer}`));
        gradePanel.append(feedback);
      }
      resultBadge.textContent = `${grade.percent}% · ${grade.score}/${grade.totalPoints}`;
      message.hidden = true;
      submit.textContent = "Test submitted";
    } catch (error) {
      setMessage(error.message || "Could not evaluate your test. Please try again.", "error");
      submit.disabled = false;
      submit.textContent = "Submit written test for AI evaluation";
    }
  });
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
