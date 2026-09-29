import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20 text-muted-foreground text-xs font-mono">
      Loading editor...
    </div>
  ),
});

function Monac({getCurrentCode, setCurrentCode, fontSize, editorRef, minimap, wordWrap}: any) {
  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="python"
      language="python"
      defaultValue={getCurrentCode()}
      value={getCurrentCode()}
      onChange={(val) => setCurrentCode(val ?? "")}
      theme={"light"}
      onMount={(editor) => (editorRef.current = editor)}
      options={{
        fontSize: Math.max(12, fontSize - 2), // Smaller font on mobile
        minimap: minimap ? { enabled: true } : { enabled: false },
        automaticLayout: true,
        wordWrap: wordWrap ? "on" : "off",
        scrollBeyondLastLine: false,
        renderLineHighlight: "none",
        lineNumbers: "on",
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: true,
        roundedSelection: true,
        padding: { top: 10, bottom: 10 },
      }}
    />
  );
}

export default Monac;