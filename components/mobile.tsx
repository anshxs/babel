import { Badge, Loader2, Play, Square } from "lucide-react";
import React from "react";
import { Button } from "./ui/button";
import Monac from "./monaco";

interface MobileProps {
  getCurrentCode: () => string;
  setCurrentCode: (code: string) => void;
  fontSize: number;
  editorRef: any;
  runCode: () => void;
  stopExecution: () => void;
  running: boolean;
  pyodideStatus: string;
  stdin: string;
  setStdin: (val: string) => void;
  output: string;
  setOutput: (val: string) => void;
  minimap: boolean;
  wordWrap: boolean;
}

export default function Mobile({
  getCurrentCode,
  setCurrentCode,
  fontSize,
  editorRef,
  runCode,
  stopExecution,
  running,
  pyodideStatus,
  stdin,
  setStdin,
  output,
  setOutput,
  minimap,
  wordWrap,
}: MobileProps) {
  const isInitializing = pyodideStatus === "loading" || pyodideStatus === "resetting";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 bg-muted/30 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isInitializing
                  ? "bg-amber-500 animate-pulse"
                  : pyodideStatus === "error"
                  ? "bg-red-500"
                  : "bg-emerald-500"
              }`}
            ></div>
            <span className="text-sm font-medium text-muted-foreground">
              Python 3.14
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">main.py</span>
          </div>
          {running && (
            <span className="text-xs text-amber-500 animate-pulse font-mono">
              Running...
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-[45vh] rounded-t-xl overflow-hidden border-x border-t">
            <Monac
              getCurrentCode={getCurrentCode}
              setCurrentCode={setCurrentCode}
              fontSize={fontSize}
              editorRef={editorRef}
              minimap={minimap}
              wordWrap={wordWrap}
            />
          </div>
        </div>
      </div>

      {/* Terminal Panel - Always visible on mobile */}
      <div className="h-[45vh] border-t rounded-t-2xl">
        <div className="h-full p-2 flex flex-col bg-muted/20">
          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            {running ? (
              <Button
                onClick={stopExecution}
                className="flex-1"
                variant="destructive"
              >
                <Square className="h-4 w-4 mr-2 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={runCode}
                className="flex-1"
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading Runtime...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Input and Output combined for mobile */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2 h-20">
              <div className="flex-1 p-2 bg-background rounded border">
                <label className="text-xs font-medium mb-1 block text-muted-foreground">
                  Input (stdin)
                </label>
                <textarea
                  className="w-full h-12 p-1 rounded bg-background border text-xs resize-none"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Input..."
                />
              </div>
            </div>
            <div className="flex-1 p-2 bg-background rounded border flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Output
                </label>
                <Badge
                  className="cursor-pointer bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-0"
                  onClick={() => setOutput("")}
                >
                  Clear
                </Badge>
              </div>
              <div className="w-full flex-1 bg-black rounded p-2 text-green-400 text-xs overflow-auto font-mono whitespace-pre-wrap">
                {output || (
                  <span className="text-gray-500">
                    Output will appear here...
                    {"\n"}💡 Tip: Use Ctrl + Enter to run quickly
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
