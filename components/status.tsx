import React from "react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface StatusProps {
  getCurrentCode: () => string;
  setMinimap: (val: boolean) => void;
  minimap: boolean;
  wordWrap: boolean;
  setWordWrap: (val: boolean) => void;
  pyodideStatus?: string;
  running?: boolean;
}

function Status({
  getCurrentCode,
  setMinimap,
  minimap,
  wordWrap,
  setWordWrap,
  pyodideStatus = "ready",
  running = false,
}: StatusProps) {
  const isInitializing = pyodideStatus === "loading" || pyodideStatus === "resetting";

  return (
    <div className="border-0 bg-[#f0f0f0] px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>Lines: {getCurrentCode().split("\n").length}</span>
        <span>Characters: {getCurrentCode().length}</span>
        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-border">
          <span
            className={`h-2 w-2 rounded-full ${running
              ? "bg-blue-500 animate-ping"
              : isInitializing
                ? "bg-amber-500 animate-pulse"
                : pyodideStatus === "error"
                  ? "bg-red-500"
                  : "bg-emerald-500"
              }`}
          />
          <span className="text-[11px]">
            {running
              ? "Executing..."
              : isInitializing
                ? "Initializing Pyodide..."
                : pyodideStatus === "error"
                  ? "Pyodide Load Error"
                  : "Pyodide WebAssembly (Ready)"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMinimap(!minimap)}
          className="h-6 px-2 hidden md:flex text-xs"
        >
          Minimap: {minimap ? "On" : "Off"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWordWrap(!wordWrap)}
          className="h-6 px-2 hidden md:flex text-xs"
        >
          Wrap: {wordWrap ? "On" : "Off"}
        </Button>
        <Separator orientation="vertical" className="h-6 hidden md:block" />
        <a href="https://www.buymeacoffee.com/anshxs"><img src="/bmc-button.png" className="w-auto h-7 rounded-2xl" /></a>
      </div>
    </div>
  );
}

export default Status;