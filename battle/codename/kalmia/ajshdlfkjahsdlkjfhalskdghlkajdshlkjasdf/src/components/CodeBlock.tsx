import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

/* Featherweight JS tokenizer for display highlighting. */
function highlight(code: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|of|in|new|await|async|while|true|false|null|undefined|this|typeof)\b|\b(\d+(?:\.\d+)?(?:e-?\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(code))) {
    out += esc(code.slice(last, m.index));
    if (m[1]) out += `<span class="tok-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-k">${esc(m[3])}</span>`;
    else if (m[4]) out += `<span class="tok-n">${esc(m[4])}</span>`;
    else if (m[5]) out += `<span class="tok-f">${esc(m[5])}</span>`;
    last = pattern.lastIndex;
  }
  out += esc(code.slice(last));
  return out;
}

export default function CodeBlock({
  code,
  className = "",
  maxHeight,
}: {
  code: string;
  className?: string;
  maxHeight?: number;
}) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlight(code), [code]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div
      className={`group relative rounded-lg border border-line bg-[#0b1120] ${className}`}
    >
      <button
        onClick={copy}
        className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-md border border-line bg-ink-800/90 px-2 py-1 text-[11px] font-medium text-mut opacity-0 transition-all hover:text-fg group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? (
          <Check size={12} className="text-aqua" />
        ) : (
          <Copy size={12} />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre
        className="code-scroll overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-[#d7e3f8]"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
