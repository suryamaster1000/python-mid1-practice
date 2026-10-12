import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const supabase = createClient(
  "https://wewoaiuxnagmzkbhlsyt.supabase.co",
  "sb_publishable_TfwYeoDBS9LZyHRckOvfrA_fEiOkDrH",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authStatus = document.querySelector("#authStatus");
const authNote = document.querySelector("#authNote");
const signInBtn = document.querySelector("#signInBtn");
const signUpBtn = document.querySelector("#signUpBtn");
const signOutBtn = document.querySelector("#signOutBtn");
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

async function syncAuth(session) {
  currentSession = session;
  const signedIn = Boolean(session?.user);
  authStatus.textContent = signedIn ? "Ready to study" : "Connecting securely…";
  authNote.textContent = signedIn ? "Temporary anonymous session ready. This session stays in this browser." : "Connecting to a temporary student session. No email or password is needed.";
  authNote.classList.remove("auth-note-error");
  authEmail.hidden = signedIn;
  authPassword.hidden = signedIn;
  signInBtn.hidden = signedIn;
  signUpBtn.hidden = signedIn;
  signOutBtn.hidden = !signedIn;
  generateBtn.disabled = !signedIn;
}

async function authenticate(action) {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    authNote.textContent = "Enter your email and password.";
    authNote.classList.add("auth-note-error");
    return;
  }
  signInBtn.disabled = true;
  signUpBtn.disabled = true;
  try {
    const result = action === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (action === "signup" && !result.data.session) {
      authNote.textContent = "Account created. Check your email to confirm it, then sign in.";
    } else {
      await syncAuth(result.data.session);
    }
  } catch (error) {
    authNote.textContent = error.message || "Could not sign in. Check your details and try again.";
    authNote.classList.add("auth-note-error");
  } finally {
    signInBtn.disabled = false;
    signUpBtn.disabled = false;
  }
}

signInBtn.addEventListener("click", () => authenticate("signin"));
signUpBtn.addEventListener("click", () => authenticate("signup"));
authPassword.addEventListener("keydown", event => {
  if (event.key === "Enter") authenticate("signin");
});
signOutBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    authNote.textContent = error.message;
    authNote.classList.add("auth-note-error");
  }
});
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
  results.replaceChildren();
  resultBadge.textContent = "READY WHEN YOU ARE";
  setMessage(activeMode === "code"
    ? "Generate a Python challenge from the programming topics in your syllabus."
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
    resultBadge.textContent = activeMode === "code" ? "CHALLENGE READY" : `${data.questions?.length ?? 0} QUESTIONS`;
    if (activeMode === "code") renderCode(data);
    else if (activeMode === "theory") renderTheory(data);
    else renderQuiz(data);
    if (!results.childElementCount) throw new Error("The response did not contain questions. Try generating again.");
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
  if (!problem || problem.language !== "python" || !/^[A-Za-z_]\w*$/.test(problem.functionName || "")) {
    throw new Error("The generated challenge had an unsupported language or function name. Please try again.");
  }
  const card = el("article", "code-card");
  const head = el("div", "code-card-head");
  head.append(el("h3", "", problem.title || "Python challenge"), el("span", "topic-pill", problem.topic || "Python"));
  card.append(head, el("div", "code-prompt", problem.prompt || ""));
  const testList = el("div", "test-list");
  (problem.tests || []).forEach((test, i) => testList.append(el("span", "test-chip", `Test ${i + 1} · ${test.description || "case"}`)));
  card.append(testList);
  const label = el("div", "editor-label", "main.py");
  const editor = document.createElement("textarea");
  editor.className = "code-editor";
  editor.id = "codeEditor";
  editor.spellcheck = false;
  editor.autocapitalize = "off";
  editor.autocomplete = "off";
  editor.setAttribute("aria-label", "Python code editor");
  editor.value = problem.starterCode || `def ${problem.functionName}():\n    # Write your solution here\n    pass\n`;
  const actions = el("div", "editor-actions");
  const run = el("button", "run-btn", "▶  Run test cases");
  run.type = "button";
  const note = el("span", "editor-note", "Runs in your browser");
  actions.append(run, note);
  const output = el("pre", "run-output");
  const hintRow = el("div", "hint-row");
  hintRow.hidden = true;
  const hintBtn = el("button", "small-action", "Show a hint");
  hintBtn.type = "button";
  let hintIndex = 0;
  hintBtn.addEventListener("click", () => {
    hintRow.replaceChildren();
    const hints = problem.hints || [];
    if (!hints.length) { hintRow.hidden = false; hintRow.append(el("div", "hint", "Think about the input and output for the simplest case.")); return; }
    hintRow.hidden = false;
    hintRow.append(el("div", "hint", hints[Math.min(hintIndex, hints.length - 1)]));
    hintIndex = Math.min(hintIndex + 1, hints.length);
  });
  const solution = el("details", "solution-block");
  solution.append(el("summary", "", "Reveal sample solution"));
  const solutionCode = el("pre", "", problem.solution || "No solution was included.");
  solution.append(solutionCode);
  const extraActions = el("div", "editor-actions");
  extraActions.append(hintBtn);
  card.append(label, editor, actions, output, extraActions, hintRow, solution);
  run.addEventListener("click", () => runCode(editor.value, problem, run, output));
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
