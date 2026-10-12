let pyodidePromise;

async function getPython() {
  if (!pyodidePromise) {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");
    pyodidePromise = loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/" });
  }
  return pyodidePromise;
}

self.onmessage = async ({ data }) => {
  try {
    const pyodide = await getPython();
    pyodide.globals.set("student_source", data.code);
    pyodide.globals.set("test_cases_json", JSON.stringify(data.tests));
    pyodide.globals.set("target_function_name", data.functionName);
    const script = `
import json
import traceback

try:
    compiled = compile(student_source, "<student_code>", "exec")
except SyntaxError as error:
    output = {"error": f"SyntaxError on line {error.lineno}: {error.msg}"}
else:
    namespace = {}
    try:
        exec(compiled, namespace)
        function = namespace.get(target_function_name)
        if not callable(function):
            output = {"error": f"Could not find a function named {target_function_name}."}
        else:
            answers = []
            for case in json.loads(test_cases_json):
                try:
                    actual = function(*case.get("args", []))
                    try:
                        actual = json.loads(json.dumps(actual, sort_keys=True))
                    except (TypeError, ValueError):
                        actual = repr(actual)
                    expected = case.get("expected")
                    answers.append({
                        "passed": actual == expected,
                        "actual": actual,
                        "expected": expected,
                        "description": case.get("description", "case")
                    })
                except Exception as error:
                    trace = traceback.extract_tb(error.__traceback__)
                    line = next((frame.lineno for frame in reversed(trace) if frame.filename == "<student_code>"), None)
                    location = f" on line {line}" if line is not None else ""
                    answers.append({
                        "passed": False,
                        "actual": f"{type(error).__name__}{location}: {error}",
                        "expected": case.get("expected"),
                        "description": case.get("description", "case")
                    })
            output = {"results": answers}
    except Exception as error:
        output = {"error": f"{type(error).__name__}: {error}"}

json.dumps(output, ensure_ascii=False)
`;
    const result = await pyodide.runPythonAsync(script);
    self.postMessage(JSON.parse(String(result)));
  } catch (error) {
    self.postMessage({ error: error?.message || "Python could not start." });
  }
};
