import { useCallback, useEffect, useState } from "react";
import { Download, BookOpen, GitBranch } from "lucide-react";
import Home from "./components/Home";
import Docs from "./components/Docs";
import { downloadLibrary } from "./mpm";
import { cn } from "./utils/cn";

type Route = "home" | "docs";

function routeFromHash(): Route {
  return window.location.hash.startsWith("#/docs") ? "docs" : "home";
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  const goDocs = useCallback(() => {
    window.location.hash = "#/docs";
  }, []);
  const goHome = useCallback((anchor?: string) => {
    if (routeFromHash() !== "home") {
      window.location.hash = "#/";
      setTimeout(() => {
        if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    } else if (anchor) {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const navLinks: [string, string][] = [
    ["Playground", "playground"],
    ["Quick start", "quickstart"],
    ["Recipes", "live"],
    ["Materials", "materials"],
    ["API", "api"],
  ];

  return (
    <div className="min-h-screen">
      <div className="bg-rig" />
      <div className="bg-grid" />

      {/* ============================ NAV ============================ */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <button onClick={() => goHome()} className="flex items-center gap-2.5">
            <span className="relative flex h-7 w-8 items-center justify-center">
              <span className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full bg-amber shadow-[0_0_10px_rgba(255,178,36,0.7)]" />
              <span className="absolute right-0.5 top-0 h-2.5 w-2.5 rounded-full bg-aqua shadow-[0_0_8px_rgba(62,214,196,0.7)]" />
              <span className="absolute bottom-0 right-1.5 h-3 w-3 rounded-full bg-coral shadow-[0_0_8px_rgba(255,107,129,0.7)]" />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight">
              MPM<span className="text-amber">.js</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map(([label, anchor]) => (
              <button
                key={anchor}
                onClick={() => goHome(anchor)}
                className="rounded-md px-3 py-1.5 text-[12.5px] font-medium text-mut transition-colors hover:bg-ink-800/70 hover:text-fg"
              >
                {label}
              </button>
            ))}
            <button
              onClick={goDocs}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                route === "docs" ? "bg-ink-800 text-amber" : "text-mut hover:bg-ink-800/70 hover:text-fg"
              )}
            >
              <BookOpen size={13} /> Docs
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-mut sm:block">
              v1.0.0
            </span>
            <a
              href="https://github.com/taichi-dev/taichi_mpm"
              target="_blank"
              rel="noreferrer"
              title="Solver source: taichi_mpm"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-line text-mut transition-colors hover:text-fg sm:flex"
            >
              <GitBranch size={15} />
            </a>
            <button
              onClick={downloadLibrary}
              className="flex items-center gap-1.5 rounded-lg bg-amber px-3.5 py-2 text-[12px] font-bold text-ink-950 transition-transform hover:scale-105 active:scale-95"
            >
              <Download size={13} /> <span className="hidden sm:inline">Download</span> mpm.js
            </button>
          </div>
        </div>
      </header>

      {/* =========================== CONTENT ========================= */}
      <main className="pb-24">
        {route === "home" ? <Home onDocs={goDocs} /> : <Docs onHome={() => goHome()} />}
      </main>

      {/* ============================ FOOTER ========================= */}
      <footer className="border-t border-line bg-ink-900/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          <div>
            <p className="font-display text-[14px] font-bold">
              MPM<span className="text-amber">.js</span>
            </p>
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-mut">
              The taichi_mpm full solver — MLS-MPM, CPIC, MPR rigid contacts and
              articulations — ported to WebAssembly and packaged as one
              dependency-free JavaScript file.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mut">Explore</p>
            <ul className="mt-3 space-y-2 text-[12.5px]">
              {navLinks.map(([label, anchor]) => (
                <li key={anchor}>
                  <button onClick={() => goHome(anchor)} className="text-mut transition-colors hover:text-amber">
                    {label}
                  </button>
                </li>
              ))}
              <li>
                <button onClick={goDocs} className="text-mut transition-colors hover:text-amber">
                  Full documentation
                </button>
              </li>
              <li>
                <a href="example.html" target="_blank" rel="noreferrer" className="text-mut transition-colors hover:text-amber">
                  Standalone example.html ↗
                </a>
              </li>
              <li>
                <a href="mpm-js-library.zip" className="text-mut transition-colors hover:text-amber">
                  Converted source (.zip)
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mut">Credits</p>
            <ul className="mt-3 space-y-2 text-[12.5px] text-mut">
              <li>
                Solver:{" "}
                <a className="text-aqua hover:underline" href="https://github.com/taichi-dev/taichi_mpm" target="_blank" rel="noreferrer">
                  taichi_mpm
                </a>{" "}
                by Yuanming Hu
              </li>
              <li>MLS-MPM & CPIC — SIGGRAPH / TOG papers</li>
              <li>Snow: Stomakhin 2013 · Sand: Klár 2016</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line/60">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[10.5px] text-mut/70 sm:px-6 lg:px-8">
            <span>MIT license · this site runs on the library it documents</span>
            <span>window.MPM · one global · zero deps</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
