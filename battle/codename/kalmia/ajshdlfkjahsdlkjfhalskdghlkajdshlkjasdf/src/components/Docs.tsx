import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { Download, FileText, ListTree, ArrowLeft } from "lucide-react";
import { rawDocs, downloadDocs, downloadLibrary } from "../mpm";
import { cn } from "../utils/cn";

type TocItem = { id: string; text: string };

function slug(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
}

export default function Docs({ onHome }: { onHome: () => void }) {
  const [md, setMd] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [active, setActive] = useState("");
  const articleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rawDocs().then(setMd);
  }, []);

  const html = useMemo(() => {
    if (!md) return "";
    return marked.parse(md, { async: false }) as string;
  }, [md]);

  useEffect(() => {
    const el = articleRef.current;
    if (!el || !html) return;
    const h2s = Array.from(el.querySelectorAll("h2"));
    const items: TocItem[] = h2s.map((h) => {
      const id = slug(h.textContent || "");
      h.id = id;
      return { id, text: (h.textContent || "").replace(/^\d+\.\s*/, "") };
    });
    setToc(items);

    // copy buttons on code blocks
    const cleanups: (() => void)[] = [];
    el.querySelectorAll("pre").forEach((pre) => {
      const btn = document.createElement("button");
      btn.textContent = "Copy";
      btn.style.cssText =
        "position:absolute;top:8px;right:8px;font:600 10px 'IBM Plex Sans',sans-serif;padding:3px 9px;border-radius:6px;border:1px solid rgba(148,170,210,0.2);background:rgba(18,30,51,0.95);color:#93a3bf;cursor:pointer;";
      const onClick = () => {
        navigator.clipboard.writeText(pre.textContent?.replace(/Copy$/, "") || "").then(() => {
          btn.textContent = "Copied ✓";
          setTimeout(() => (btn.textContent = "Copy"), 1200);
        });
      };
      btn.addEventListener("click", onClick);
      pre.appendChild(btn);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive((e.target as HTMLElement).id);
        }
      },
      { rootMargin: "-90px 0px -70% 0px" }
    );
    h2s.forEach((h) => io.observe(h));
    return () => {
      io.disconnect();
      cleanups.forEach((c) => c());
    };
  }, [html]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onHome}
          className="flex items-center gap-2 text-[12.5px] font-semibold text-mut transition-colors hover:text-fg">
          <ArrowLeft size={14} /> Back to playground
        </button>
        <div className="flex gap-2">
          <button onClick={downloadDocs}
            className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/70 px-4 py-2 text-[12px] font-semibold text-fg transition-colors hover:border-coral/60 hover:text-coral">
            <FileText size={13} /> Download .md
          </button>
          <button onClick={downloadLibrary}
            className="flex items-center gap-2 rounded-lg bg-amber px-4 py-2 text-[12px] font-bold text-ink-950 transition-transform hover:scale-105">
            <Download size={13} /> mpm.js
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-mut">
              <ListTree size={12} /> On this page
            </p>
            <nav className="mt-3 space-y-0.5 border-l border-line">
              {toc.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={cn(
                    "block w-full border-l-2 py-1 pl-3 text-left text-[12px] leading-snug transition-colors -ml-px",
                    active === t.id
                      ? "border-amber font-semibold text-amber"
                      : "border-transparent text-mut hover:border-ink-600 hover:text-fg"
                  )}
                >
                  <span className="mr-1.5 font-mono text-[10px] text-mut/60">{String(i + 1).padStart(2, "0")}</span>
                  {t.text}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <article className="panel min-w-0 rounded-xl p-5 sm:p-8">
          {!html && <p className="text-[13px] text-mut">Loading documentation…</p>}
          <div ref={articleRef} className="docs-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
    </div>
  );
}
