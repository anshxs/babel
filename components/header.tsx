import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import React from "react";
import { Separator } from "./ui/separator";
import { AnimatedGradientText } from "./ui/animated-gradient-text";
import { Clock, Type } from "lucide-react";

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];
const TIMEOUT_OPTIONS = [
  { label: "3s limit", value: 3000 },
  { label: "5s limit", value: 5000 },
  { label: "10s limit", value: 10000 },
  { label: "15s limit", value: 15000 },
  { label: "30s limit", value: 30000 },
];

interface HeaderProps {
  fontSize: number;
  setFontSize: (size: number) => void;
  timeoutMs: number;
  setTimeoutMs: (ms: number) => void;
}

function Header({ fontSize, setFontSize, timeoutMs, setTimeoutMs }: HeaderProps) {
  return (
    <div className="border-0 bg-[#f0f0f0] px-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-bold">Babel IDE</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Timeout Selector */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-0 rounded-xl">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Timeout:</span>
            <Select
              value={timeoutMs.toString()}
              onValueChange={(val) => setTimeoutMs(Number(val))}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font Size - Hidden on small mobile */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white px-2 py-0 rounded-xl">
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={fontSize.toString()}
              onValueChange={(val) => setFontSize(Number(val))}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size.toString()} className="text-xs">
                    {size}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
