"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export type PyodideStatus = "loading" | "ready" | "error" | "resetting";

interface UsePyodideWorkerOptions {
  onOutput?: (output: string) => void;
}

export function usePyodideWorker(options?: UsePyodideWorkerOptions) {
  const [status, setStatus] = useState<PyodideStatus>("loading");
  const [running, setRunning] = useState<boolean>(false);
  const [timeoutMs, setTimeoutMs] = useLocalStorage<number>("execution-timeout", 10000);

  const workerRef = useRef<Worker | null>(null);
  const currentReqIdRef = useRef<number>(0);
  const timeoutHandleRef = useRef<NodeJS.Timeout | null>(null);
  const runningRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Spawns or recreates the Pyodide Web Worker
  const spawnWorker = useCallback(() => {
    // Terminate existing worker if any
    if (workerRef.current) {
      try {
        workerRef.current.terminate();
      } catch (e) {
        console.error("Error terminating worker:", e);
      }
      workerRef.current = null;
    }

    setStatus("loading");

    try {
      const worker = new Worker("/pyodide-worker.js", { type: "module" });

      worker.onmessage = (event: MessageEvent) => {
        const { type, id, status: workerStatus, output, error } = event.data || {};

        if (type === "STATUS") {
          if (workerStatus === "ready") {
            setStatus("ready");
          } else if (workerStatus === "error") {
            setStatus("error");
          } else if (workerStatus === "loading") {
            setStatus("loading");
          }
          return;
        }

        // Only handle response if it matches the active request
        if (id === currentReqIdRef.current) {
          if (timeoutHandleRef.current) {
            clearTimeout(timeoutHandleRef.current);
            timeoutHandleRef.current = null;
          }

          runningRef.current = false;
          setRunning(false);

          if (type === "SUCCESS") {
            if (optionsRef.current?.onOutput) {
              optionsRef.current.onOutput(output ?? "");
            }
          } else if (type === "ERROR") {
            if (optionsRef.current?.onOutput) {
              optionsRef.current.onOutput(`Error: ${error ?? "Unknown error"}`);
            }
          }
        }
      };

      worker.onerror = (err: ErrorEvent) => {
        console.error("Pyodide Worker encountered an error:", err);
        setStatus("error");
        if (runningRef.current) {
          if (timeoutHandleRef.current) {
            clearTimeout(timeoutHandleRef.current);
            timeoutHandleRef.current = null;
          }
          runningRef.current = false;
          setRunning(false);
          if (optionsRef.current?.onOutput) {
            optionsRef.current.onOutput(
              `Worker Error: ${err.message || "Failed to execute in Web Worker"}`
            );
          }
        }
      };

      workerRef.current = worker;
    } catch (err: any) {
      console.error("Failed to spawn Web Worker:", err);
      setStatus("error");
    }
  }, []);

  // Initialize worker on mount
  useEffect(() => {
    spawnWorker();

    return () => {
      if (timeoutHandleRef.current) {
        clearTimeout(timeoutHandleRef.current);
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [spawnWorker]);

  // Execute Python code in worker with hard-timeout
  const runCode = useCallback(
    (code: string, stdin: string) => {
      if (runningRef.current) {
        return;
      }

      // If worker died or doesn't exist, revive it
      if (!workerRef.current) {
        spawnWorker();
      }

      const reqId = ++currentReqIdRef.current;
      runningRef.current = true;
      setRunning(true);

      // Start hard timeout timer to kill infinite loops
      const limitSeconds = Math.max(1, Math.round(timeoutMs / 1000));
      timeoutHandleRef.current = setTimeout(() => {
        if (!runningRef.current || currentReqIdRef.current !== reqId) {
          return;
        }

        // KILL THE WORKER TO STOP THE INFINITE LOOP IMMEDIATELY
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }

        runningRef.current = false;
        setRunning(false);
        setStatus("resetting");

        if (optionsRef.current?.onOutput) {
          optionsRef.current.onOutput(
            `⏱️ Execution timed out after ${limitSeconds}s limit.\n\n` +
              `The Python process was terminated to stop the infinite loop.\n` +
              `Pyodide runtime has been reset and is ready for your next run.`
          );
        }

        // Respawn fresh worker ready for subsequent runs
        spawnWorker();
      }, timeoutMs);

      // Send payload to worker
      try {
        workerRef.current?.postMessage({
          type: "RUN",
          id: reqId,
          code,
          stdin,
        });
      } catch (err: any) {
        if (timeoutHandleRef.current) {
          clearTimeout(timeoutHandleRef.current);
          timeoutHandleRef.current = null;
        }
        runningRef.current = false;
        setRunning(false);
        if (optionsRef.current?.onOutput) {
          optionsRef.current.onOutput(`Failed to send code to worker: ${err.message}`);
        }
      }
    },
    [timeoutMs, spawnWorker]
  );

  // User-initiated stop (kills worker and resets)
  const stopExecution = useCallback(() => {
    if (!runningRef.current) return;

    if (timeoutHandleRef.current) {
      clearTimeout(timeoutHandleRef.current);
      timeoutHandleRef.current = null;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    runningRef.current = false;
    setRunning(false);
    setStatus("resetting");

    if (optionsRef.current?.onOutput) {
      optionsRef.current.onOutput(
        "🛑 Execution stopped by user.\nPython process terminated and runtime reset."
      );
    }

    spawnWorker();
  }, [spawnWorker]);

  return {
    status,
    running,
    timeoutMs,
    setTimeoutMs,
    runCode,
    stopExecution,
    restartRuntime: spawnWorker,
  };
}
