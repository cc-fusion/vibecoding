import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  Copy,
  Download,
  FileText,
  Grid2X2,
  Layers,
  Menu,
  MousePointer2,
  Orbit,
  Play,
  Search,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { allDocs, DOC_GROUPS, materialRows } from "./docs.js";

export const iconMap = {
  overview: Orbit,
  download: Download,
  zap: Zap,
  box: Box,
  layers: Layers,
  sliders: SlidersHorizontal,
  pointer: MousePointer2,
  wheel: Orbit,
  play: Play,
  code: Code2,
  grid: Grid2X2,
  clock: Clock3,
};

function Github({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .8a11.3 11.3 0 0 0-3.57 22.02c.57.1.77-.25.77-.55v-2.1c-3.15.68-3.82-1.34-3.82-1.34-.51-1.3-1.26-1.65-1.26-1.65-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.16 1.74 1.16 1.02 1.75 2.67 1.25 3.33.96.1-.74.4-1.25.73-1.54-2.52-.29-5.16-1.26-5.16-5.6 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.11 1.16a10.8 10.8 0 0 1 5.67 0c2.16-1.46 3.1-1.16 3.1-1.16.62 1.56.24 2.71.12 3a4.35 4.35 0 0 1 1.16 3.02c0 4.35-2.65 5.3-5.18 5.59.41.35.77 1.04.77 2.1v3.11c0 .3.2.66.78.55A11.3 11.3 0 0 0 12 .8Z" />
    </svg>
  );
}

export function Logo({ small = false }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <svg viewBox="0 0 32 34" aria-hidden="true">
        <circle cx="16" cy="7" r="5.5" />
        <circle cx="7" cy="23" r="5.5" />
        <circle cx="25" cy="23" r="5.5" />
        <path
          d="m13.3 11.7-3.6 6.5m12.6 0-3.6-6.5M12.5 23h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
        />
      </svg>
      <span>
        mpm<span className="brand-dot">.</span>js
      </span>
    </span>
  );
}

export function Header({ page, navigate, onSearch, onMenu }) {
  const [downloads, setDownloads] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setDownloads(false);
    };
    const key = (event) => {
      if (event.key === "Escape") setDownloads(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <header className="site-header">
      <div className="header-brand">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={21} />
        </button>
        <button
          className="logo-button"
          onClick={() => navigate("overview")}
          aria-label="mpm.js home"
        >
          <Logo />
        </button>
        <span className="docs-mark">docs</span>
      </div>
      <nav className="top-nav" aria-label="Main navigation">
        <button
          className={!["playground", "examples"].includes(page) ? "active" : ""}
          onClick={() => navigate("overview")}
        >
          Documentation
        </button>
        <button
          className={page === "playground" ? "active" : ""}
          onClick={() => navigate("playground")}
        >
          Playground
        </button>
        <button
          className={page === "examples" ? "active" : ""}
          onClick={() => navigate("examples")}
        >
          Examples
          <ArrowUpRight size={12} />
        </button>
      </nav>
      <div className="header-actions">
        <span className="header-version">
          v1.0.0
          <ChevronDown size={12} />
        </span>
        <span className="header-divider" />
        <button
          className="icon-button header-search"
          aria-label="Search documentation"
          onClick={onSearch}
        >
          <Search size={18} />
        </button>
        <a
          className="icon-button github-link"
          href="https://github.com/cc-fusion/vibecoding/blob/main/battle/claude-opus-5.5-max/i-opus-55-max.zip"
          target="_blank"
          rel="noreferrer"
          aria-label="View original source on GitHub"
        >
          <Github size={20} />
        </a>
        <div className="download-menu" ref={menuRef}>
          <button
            className="download-button"
            onClick={() => setDownloads(!downloads)}
            aria-expanded={downloads}
          >
            <Download size={15} />
            <span>Download</span>
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {downloads && (
              <motion.div
                className="download-popover"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <span className="popover-heading">TAKE IT FROM HERE</span>
                <a
                  href="/downloads/mpm-js-1.0.0.zip"
                  download
                  onClick={() => setDownloads(false)}
                >
                  <Box size={18} />
                  <span>
                    Complete package<small>JavaScript, examples & source</small>
                  </span>
                  <ArrowDownToLine size={15} />
                </a>
                <a
                  href="/downloads/mpm.js"
                  download
                  onClick={() => setDownloads(false)}
                >
                  <Code2 size={18} />
                  <span>
                    JavaScript library<small>One file. No dependencies.</small>
                  </span>
                  <ArrowDownToLine size={15} />
                </a>
                <a
                  href="/downloads/DOCUMENTATION.md"
                  download
                  onClick={() => setDownloads(false)}
                >
                  <FileText size={18} />
                  <span>
                    Markdown guide<small>The complete documentation</small>
                  </span>
                  <ArrowDownToLine size={15} />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export function Sidebar({ page, navigate, onSearch, open, onClose }) {
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            className="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Close navigation"
          />
        )}
      </AnimatePresence>
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <button className="search-trigger" onClick={onSearch}>
          <Search size={15} />
          <span>Search documentation</span>
          <kbd>
            <Command size={10} />K
          </kbd>
        </button>
        <nav aria-label="Documentation navigation">
          {DOC_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-title">{group.label}</div>
              {group.items.map((item) => {
                const Icon = iconMap[item.icon];
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`sidebar-link ${page === item.id ? "selected" : ""}`}
                    aria-current={page === item.id ? "page" : undefined}
                  >
                    <Icon size={16} strokeWidth={1.65} />
                    <span>{item.title}</span>
                    {item.isNew && <span className="new-label">NEW</span>}
                    {page === item.id && <span className="active-dot" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <span className="small-live-dot" />A little code. A lot of
            possibility.
          </div>
          <a href="/downloads/DOCUMENTATION.md" download>
            <FileText size={14} />
            Download as Markdown
            <ArrowUpRight size={12} />
          </a>
          <div className="sidebar-version">
            mpm.js v1.0.0<span>Made for the web.</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function highlight(line) {
  const pattern =
    /(\/\/.*$|<!--.*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|await|async|new|return|if|else|import|from|export|true|false|function)\b|\b\d+(?:\.\d+)?\b|\b(?:MPM|createScene|create|addParticles|addWheel|setSpeed|demoScene|enableInteractions|setGravity)\b)/g;
  const pieces = [];
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index > last) pieces.push(line.slice(last, match.index));
    const token = match[0];
    const cls =
      token.startsWith("//") || token.startsWith("<!--")
        ? "token-comment"
        : /^["']/.test(token)
          ? "token-string"
          : /^\d/.test(token)
            ? "token-number"
            : /^(MPM|create|add|set|demo|enable)/.test(token)
              ? "token-function"
              : "token-keyword";
    pieces.push(
      <span key={match.index} className={cls}>
        {token}
      </span>,
    );
    last = match.index + token.length;
  }
  if (last < line.length) pieces.push(line.slice(last));
  return pieces;
}

export function CodeBlock({
  code,
  language = "JavaScript",
  filename,
  compact = false,
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(code);
      else {
        const field = document.createElement("textarea");
        field.value = code;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.append(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={`code-block ${compact ? "code-compact" : ""}`}>
      <div className="code-header">
        <span>
          <span className="code-file-dot" />
          {filename ??
            (language === "HTML"
              ? "index.html"
              : language === "Terminal"
                ? "Terminal"
                : "scene.js")}
        </span>
        <div>
          <span className="code-language">{language}</span>
          <button
            onClick={copy}
            aria-label={copied ? "Code copied" : "Copy code"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      </div>
      <pre tabIndex={0} aria-label={`${language} example`}>
        <code>
          {code.split("\n").map((line, i) => (
            <span className="code-line" key={i}>
              <span className="line-number" aria-hidden="true">
                {i + 1}
              </span>
              <span>{highlight(line) || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function SearchDialog({ onClose, navigate }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const dialog = useRef(null);
  const results = allDocs
    .filter((item) =>
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 7);
  useEffect(() => {
    setSelected(0);
  }, [query]);
  useEffect(() => {
    const previous = document.activeElement;
    document.body.style.overflow = "hidden";
    dialog.current.querySelector("input")?.focus();
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  const open = (id) => {
    onClose();
    navigate(id);
  };
  return (
    <motion.div
      className="search-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        ref={dialog}
        initial={{ opacity: 0, scale: 0.98, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelected((n) => Math.min(results.length - 1, n + 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelected((n) => Math.max(0, n - 1));
          }
          if (event.key === "Enter" && results[selected]) {
            event.preventDefault();
            open(results[selected].id);
          }
          if (event.key === "Tab") {
            const items = [...dialog.current.querySelectorAll("input,button")];
            const first = items[0],
              last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="search-input-row">
          <Search size={21} />
          <input
            placeholder="What would you like to make?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search documentation"
          />
          <button onClick={onClose} aria-label="Close search">
            <kbd>esc</kbd>
          </button>
        </div>
        <div className="search-result-label">
          {query ? "SEARCH RESULTS" : "JUMP INTO SOMETHING"}
        </div>
        <div className="search-results">
          {results.map((item, i) => {
            const Icon = iconMap[item.icon];
            return (
              <button
                className={i === selected ? "search-result-selected" : ""}
                key={item.id}
                onClick={() => open(item.id)}
                onMouseEnter={() => setSelected(i)}
              >
                <Icon size={19} />
                <span>
                  {item.title}
                  <small>{item.description}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            );
          })}
          {!results.length && (
            <div className="no-results">
              <CircleHelp size={25} />
              <strong>No worlds found for "{query}"</strong>
              <span>Try "scenes", "wheel", or "touch".</span>
            </div>
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>up</kbd>
            <kbd>down</kbd> to navigate
          </span>
          <span>
            <kbd>enter</kbd> to explore
          </span>
          <Logo small />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MaterialsList({ onTry }) {
  return (
    <div className="materials-list">
      {materialRows.map(([id, description, color]) => (
        <button key={id} onClick={() => onTry(id)}>
          <span className="material-swatch" style={{ "--swatch": color }} />
          <span>
            <strong>
              {id === "von_mises"
                ? "Von Mises"
                : id[0].toUpperCase() + id.slice(1)}
            </strong>
            <small>{description}</small>
          </span>
          <span className="material-try">
            Try it
            <ArrowUpRight size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}

export function PageFooter({ navigate }) {
  return (
    <footer className="page-footer">
      <div>
        <Logo small />
        <span>Small library. A world of possibilities.</span>
      </div>
      <div>
        <a href="/downloads/DOCUMENTATION.md" download>
          Read offline
          <FileText size={13} />
        </a>
        <button onClick={() => navigate("changelog")}>
          v1.0.0
          <ArrowUpRight size={13} />
        </button>
      </div>
    </footer>
  );
}

export function NextPage({
  navigate,
  title = "Installation",
  page = "installation",
  description = "One script. Then you are off.",
}) {
  return (
    <button className="next-page" onClick={() => navigate(page)}>
      <span>
        <small>UP NEXT</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <ArrowRight size={23} />
    </button>
  );
}
