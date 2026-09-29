// Pyodide Web Worker for Babel IDE
// Executes Python in an isolated worker thread so the main UI never freezes,
// and supports immediate hard-termination on timeout or user cancellation.

let pyodide = null;
let pyodideReadyPromise = null;

async function initPyodide() {
  if (pyodide) return pyodide;

  self.postMessage({
    type: "STATUS",
    status: "loading",
    message: "Initializing Python runtime...",
  });

  try {
    // Attempt local load first
    const { loadPyodide } = await import("/pyodide/pyodide.mjs");
    pyodide = await loadPyodide({
      indexURL: "/pyodide/",
    });
  } catch (localErr) {
    console.warn("Failed to load local Pyodide, falling back to CDN:", localErr);
    try {
      const { loadPyodide } = await import(
        "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs"
      );
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/",
      });
    } catch (cdnErr) {
      console.error("Failed to load Pyodide from CDN:", cdnErr);
      self.postMessage({
        type: "STATUS",
        status: "error",
        error: cdnErr?.message || String(cdnErr),
      });
      throw cdnErr;
    }
  }

  self.postMessage({
    type: "STATUS",
    status: "ready",
    message: "Python runtime ready",
  });

  return pyodide;
}

// Start loading Pyodide immediately when worker is spawned
pyodideReadyPromise = initPyodide().catch(() => {});

// Listen for execution commands
self.onmessage = async (event) => {
  const { type, id, code, stdin } = event.data || {};

  if (type === "PING") {
    const isReady = pyodide !== null;
    self.postMessage({
      type: "STATUS",
      status: isReady ? "ready" : "loading",
    });
    return;
  }

  if (type === "RUN") {
    try {
      const p = await pyodideReadyPromise;
      if (!p) {
        throw new Error("Pyodide failed to initialize.");
      }

      // Pass user code and stdin safely into Python global scope without template injection
      p.globals.set("__user_code__", code ?? "");
      p.globals.set("__user_stdin__", stdin ?? "");

      // Execute with stdout, stderr, and stdin redirection
      const runnerCode = `
import sys, io, traceback
sys.stdin = io.StringIO(__user_stdin__)
_stdout = io.StringIO()
_stderr = io.StringIO()
_old_stdout, _old_stderr, _old_stdin = sys.stdout, sys.stderr, sys.stdin
sys.stdout, sys.stderr = _stdout, _stderr
try:
    exec(__user_code__, {'__name__': '__main__'})
except SystemExit:
    pass
except BaseException:
    traceback.print_exc()
finally:
    sys.stdout, sys.stderr, sys.stdin = _old_stdout, _old_stderr, _old_stdin

_out = _stdout.getvalue()
_err = _stderr.getvalue()
_out + (_err if _err else '')
`;
      const result = await p.runPythonAsync(runnerCode);

      self.postMessage({
        type: "SUCCESS",
        id,
        output: String(result ?? ""),
      });
    } catch (err) {
      self.postMessage({
        type: "ERROR",
        id,
        error: err?.message || String(err),
      });
    }
  }
};
