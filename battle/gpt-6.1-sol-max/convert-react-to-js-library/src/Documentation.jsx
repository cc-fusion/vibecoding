import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Download,
  FileText,
  Info,
} from "lucide-react";
import { allDocs, articles, runnableCode } from "./docs.js";
import {
  CodeBlock,
  Header,
  MaterialsList,
  NextPage,
  PageFooter,
  SearchDialog,
  Sidebar,
} from "./components.jsx";
import Playground from "./Playground.jsx";
import { scenes as originalScenes } from "../library/src/mpm.js";

const fadeIn = {
  initial: { opacity: 0, y: 9 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.2, 0.7, 0.3, 1] },
};

function Breadcrumb({ page, navigate }) {
  const title = allDocs.find((item) => item.id === page)?.title ?? "Overview";
  return (
    <div className="breadcrumb">
      <button onClick={() => navigate("overview")}>Documentation</button>
      <ChevronRight size={12} />
      <span>{title}</span>
    </div>
  );
}

function Overview({ navigate, openPlayground }) {
  const [installTab, setInstallTab] = useState("script");
  const moduleCode = `import { create, demoScene } from './mpm.esm.js';

const sim = await create({
  canvas: '#world',
  scene: demoScene('sand'),
  interactions: { material: 'sand' }
});`;
  return (
    <>
      <motion.section className="overview-hero" {...fadeIn}>
        <div className="hero-title-row">
          <h1>
            mpm<span>.</span>js
          </h1>
          <span className="hero-version">v1.0.0</span>
        </div>
        <h2>Real physics. Pure JavaScript.</h2>
        <p>
          A little library for a world of sand, water, and everything in
          between.
          <br className="desktop-break" /> Create, interact, and make it your
          own. No framework required.
        </p>
        <div className="hero-actions">
          <button
            className="primary-button"
            onClick={() => navigate("quick-start")}
          >
            Start building
            <ArrowRight size={16} />
          </button>
          <button className="text-button" onClick={() => navigate("api")}>
            Explore the API
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <svg viewBox="0 0 200 180">
            <defs>
              <pattern
                id="particle-pattern"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="#d69d73" />
              </pattern>
            </defs>
            <ellipse
              cx="100"
              cy="90"
              rx="75"
              ry="32"
              transform="rotate(-34 100 90)"
              fill="none"
              stroke="#d8dbcc"
              strokeWidth="1"
            />
            <ellipse
              cx="100"
              cy="90"
              rx="75"
              ry="32"
              transform="rotate(32 100 90)"
              fill="none"
              stroke="#d8dbcc"
              strokeWidth="1"
            />
            <circle cx="100" cy="90" r="48" fill="url(#particle-pattern)" />
            <circle cx="158" cy="47" r="6" fill="#e08058" />
            <circle cx="53" cy="136" r="4" fill="#b7beab" />
          </svg>
        </div>
      </motion.section>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        <Playground />
      </motion.div>
      <section className="overview-quickstart" id="quickstart">
        <div className="section-kicker">
          <span>01</span> THE SIMPLEST WAY IN
        </div>
        <div className="section-heading-row">
          <div>
            <h2>
              One script.
              <br />A world of possibilities.
            </h2>
            <p>From a blank canvas to something worth playing with.</p>
          </div>
          <a
            href="/examples/index.html"
            target="_blank"
            rel="noreferrer"
            className="subtle-link"
          >
            Open a working example
            <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="quickstart-layout">
          <div>
            <div
              className="install-tabs"
              role="tablist"
              aria-label="Installation method"
            >
              <button
                role="tab"
                aria-selected={installTab === "script"}
                className={installTab === "script" ? "active" : ""}
                onClick={() => setInstallTab("script")}
              >
                <Code2 size={14} />
                Script tag
              </button>
              <button
                role="tab"
                aria-selected={installTab === "module"}
                className={installTab === "module" ? "active" : ""}
                onClick={() => setInstallTab("module")}
              >
                ES module
              </button>
              <span>No npm install needed.</span>
            </div>
            <CodeBlock
              code={installTab === "script" ? runnableCode : moduleCode}
              language={installTab === "script" ? "HTML" : "JavaScript"}
            />
          </div>
          <div className="quickstart-notes">
            <div>
              <span className="note-number">01 /</span>
              <h3>Just JavaScript.</h3>
              <p>
                No React. No TypeScript. No build step standing between you and
                your idea.
              </p>
            </div>
            <div>
              <span className="note-number">02 /</span>
              <h3>Entirely yours.</h3>
              <p>
                Build your scenes with a plain object. No diving into library
                internals.
              </p>
            </div>
            <div>
              <span className="note-number">03 /</span>
              <h3>Alive at runtime.</h3>
              <p>
                Add a wheel, pour some water, change gravity. Keep the world
                running.
              </p>
            </div>
          </div>
        </div>
        <div className="inline-note">
          <Info size={15} />
          <span>
            Powered by the original MLS-MPM + CPIC WebAssembly solver. Real
            materials, not just moving dots.
          </span>
        </div>
      </section>
      <section className="build-section">
        <div className="section-kicker">
          <span>02</span> FOLLOW YOUR CURIOSITY
        </div>
        <h2>What will you set in motion?</h2>
        <div className="discovery-links">
          <button onClick={() => navigate("scenes")}>
            <span className="discovery-index">01</span>
            <h3>Create a scene</h3>
            <p>
              Your materials, your geometry.
              <br />A world that starts with you.
            </p>
            <span>
              Build your first scene
              <ArrowRight size={15} />
            </span>
          </button>
          <button onClick={() => navigate("interactions")}>
            <span className="discovery-index">02</span>
            <h3>Make it interactive</h3>
            <p>
              Bring your world a little closer.
              <br />
              Mouse, pen, or fingertips.
            </p>
            <span>
              Explore interactions
              <ArrowRight size={15} />
            </span>
          </button>
          <button
            onClick={() => openPlayground({ material: "sand", wheel: true })}
          >
            <span className="discovery-index">03</span>
            <h3>Keep things moving</h3>
            <p>
              A spinning wheel. A falling stream.
              <br />A little organized chaos.
            </p>
            <span>
              Try an automatic wheel
              <ArrowRight size={15} />
            </span>
          </button>
        </div>
      </section>
      <NextPage navigate={navigate} />
      <PageFooter navigate={navigate} />
    </>
  );
}

function Article({ page, navigate, openPlayground }) {
  const article = articles[page];
  const [helpful, setHelpful] = useState(null);
  useEffect(() => setHelpful(null), [page]);
  return (
    <>
      <motion.div className="article-intro" {...fadeIn} key={page}>
        <span className="section-kicker">{article.eyebrow}</span>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
      </motion.div>
      <div className="article-layout">
        <article className="article-body">
          {article.sections.map((section) => (
            <section key={section.id} id={section.id} className="doc-section">
              <h2>
                {section.title && <span>{section.title}</span>}
                {section.heading}
              </h2>
              <p>{section.text}</p>
              {section.download && (
                <div className="download-links">
                  <a
                    className="primary-button"
                    href="/downloads/mpm-js-1.0.0.zip"
                    download
                  >
                    <Download size={16} />
                    Download mpm.js
                    <ArrowDownToLine size={15} />
                  </a>
                  <a className="subtle-link" href="/downloads/mpm.js" download>
                    Just the JavaScript
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              )}
              {section.code && (
                <CodeBlock code={section.code} language={section.language} />
              )}{" "}
              {section.note && (
                <div className="inline-note">
                  <Info size={15} />
                  <span>{section.note}</span>
                </div>
              )}
              {section.table && (
                <div className="reference-table-wrap">
                  <table className="reference-table">
                    <thead>
                      <tr>
                        {section.table[0].map((cell) => (
                          <th key={cell}>{cell}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.slice(1).map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, i) => (
                            <td key={i}>
                              {i === 0 ? <code>{cell}</code> : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.materials && (
                <MaterialsList
                  onTry={(id) => openPlayground({ material: id })}
                />
              )}{" "}
              {section.list && (
                <ul className="release-list">
                  {section.list.map((line) => (
                    <li key={line}>
                      <Check size={14} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.example && (
                <a
                  href="/examples/index.html"
                  className="subtle-link section-inline-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  Run the complete HTML example
                  <ArrowUpRight size={15} />
                </a>
              )}
              {section.wheelDemo && (
                <button
                  className="subtle-link section-inline-link"
                  onClick={() =>
                    openPlayground({ material: "sand", wheel: true })
                  }
                >
                  Try a live automatic wheel
                  <ArrowRight size={15} />
                </button>
              )}
              {section.migration && (
                <a
                  className="subtle-link section-inline-link"
                  href="/downloads/DOCUMENTATION.md"
                  download
                >
                  Read the full Markdown guide
                  <FileText size={15} />
                </a>
              )}
            </section>
          ))}
          <div className="article-feedback">
            <span>Was this a helpful little read?</span>
            <div>
              {helpful ? (
                <span className="feedback-thanks">
                  <Check size={14} />
                  {helpful === "yes"
                    ? "Thanks for the feedback."
                    : "Thanks. The full Markdown guide has more detail."}
                </span>
              ) : (
                <>
                  <button onClick={() => setHelpful("yes")}>
                    <Check size={14} />
                    Yes, thanks
                  </button>
                  <button onClick={() => setHelpful("no")}>Not quite</button>
                </>
              )}
            </div>
          </div>
          <NextPage
            navigate={navigate}
            title={
              page === "installation"
                ? "Quick start"
                : page === "api"
                  ? "Examples"
                  : "Explore the playground"
            }
            page={
              page === "installation"
                ? "quick-start"
                : page === "api"
                  ? "examples"
                  : "playground"
            }
            description={
              page === "installation"
                ? "Let us make something move."
                : "A little experimentation goes a long way."
            }
          />
        </article>
        <aside className="table-of-contents">
          <span>ON THIS PAGE</span>
          {article.sections.map((section) => (
            <button
              key={section.id}
              onClick={() =>
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {section.heading}
            </button>
          ))}
          <div className="toc-offline">
            <FileText size={17} />
            <strong>Take it with you.</strong>
            <p>
              The whole guide, in a<br />
              simple Markdown file.
            </p>
            <a href="/downloads/DOCUMENTATION.md" download>
              Download .md
              <ArrowDownToLine size={13} />
            </a>
          </div>
        </aside>
      </div>
      <PageFooter navigate={navigate} />
    </>
  );
}

function ExampleVisual({ type, index = 0 }) {
  const palette = ["#dca76b", "#7bb4cc", "#ab96d0", "#d6dbce"];
  const color = palette[index % palette.length];
  return (
    <svg className="example-visual" viewBox="0 0 180 100" aria-hidden="true">
      <defs>
        <pattern
          id={`dots-${type}`}
          width="3.4"
          height="3.4"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.7" fill={color} />
        </pattern>
      </defs>
      <rect width="180" height="100" fill="#252922" />
      {type === "sand" ? (
        <>
          <path d="M12 85 68 21 126 85Z" fill={`url(#dots-${type})`} />
          <path d="m78 85 42-43 45 43Z" fill="#b87c4c" opacity="0.8" />
        </>
      ) : type === "water" ? (
        <path
          d="M12 84V60q22-30 45-5t52-5 59-5v39Z"
          fill={`url(#dots-${type})`}
        />
      ) : type === "jelly" ? (
        <>
          <rect
            x="27"
            y="37"
            width="46"
            height="46"
            rx="8"
            transform="rotate(-12 50 60)"
            fill={`url(#dots-${type})`}
          />
          <circle cx="118" cy="47" r="28" fill={`url(#dots-${type})`} />
        </>
      ) : (
        <>
          <path d="M15 85 60 37 105 85Z" fill={`url(#dots-${type})`} />
          <path d="m80 85 42-58 45 58Z" fill={`url(#dots-${type})`} />
        </>
      )}
      <path d="M12 87h156" stroke="#656c58" strokeWidth="0.5" />
    </svg>
  );
}

function Examples({ openPlayground, navigate }) {
  const demos = [
    {
      material: "sand",
      name: "A little granular magic",
      description:
        "A few dunes, a little gravity, and thousands of possibilities.",
      label: "Sand / 2D",
    },
    {
      material: "water",
      name: "Go with the flow",
      description: "Pour, splash, and find a new shape for your ideas.",
      label: "Water / 2D",
    },
    {
      material: "jelly",
      name: "Room for a little wobble",
      description:
        "Elastic materials that never take themselves too seriously.",
      label: "Jelly / 2D",
    },
    {
      material: "snow",
      name: "Leave an impression",
      description:
        "Soft forms, lasting deformations, and a very gentle landing.",
      label: "Snow / 2D",
    },
  ];
  return (
    <>
      <motion.div className="article-intro" {...fadeIn}>
        <span className="section-kicker">A FEW PLACES TO START</span>
        <h1>
          Small experiments.
          <br />
          Big what-ifs.
        </h1>
        <p>A little inspiration for the world you are about to make.</p>
      </motion.div>
      <div className="example-list">
        {demos.map((demo, i) => (
          <button
            className="example-row"
            key={demo.material}
            onClick={() => openPlayground({ material: demo.material })}
          >
            <ExampleVisual type={demo.material} index={i} />
            <span className="example-description">
              <span>{demo.label}</span>
              <h2>{demo.name}</h2>
              <p>{demo.description}</p>
            </span>
            <span className="example-open">
              Play
              <ArrowUpRight size={19} />
            </span>
          </button>
        ))}
      </div>
      <section className="original-examples">
        <div className="section-kicker">THE ORIGINAL COLLECTION</div>
        <h2>Same engine. Another dimension.</h2>
        <p>
          All ten scenes from the original solver, converted to JavaScript and
          ready to explore.
        </p>
        <div className="original-example-list">
          {originalScenes.map((scene, i) => (
            <button
              key={scene.id}
              onClick={() => openPlayground({ nativeScene: scene.id })}
            >
              <span className="original-example-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{scene.name}</strong>
                <small>{scene.features.slice(0, 3).join(" / ")}</small>
              </span>
              <span className="dimension-label">{scene.dim}D</span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </section>
      <div className="example-source-link">
        <Code2 size={24} />
        <div>
          <h3>Nothing hidden behind the canvas.</h3>
          <p>Open the plain HTML example. Read it, change it, make it yours.</p>
        </div>
        <a
          href="/examples/index.html"
          target="_blank"
          rel="noreferrer"
          className="subtle-link"
        >
          Open example
          <ArrowUpRight size={15} />
        </a>
      </div>
      <PageFooter navigate={navigate} />
    </>
  );
}

export default function Documentation() {
  const validPage = (value) =>
    allDocs.some((item) => item.id === value) ? value : "overview";
  const [page, setPage] = useState(() =>
    validPage(window.location.hash.slice(1)),
  );
  const [search, setSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playSelection, setPlaySelection] = useState({ material: "sand" });

  useEffect(() => {
    const hashChange = () => {
      setPage(validPage(window.location.hash.slice(1)));
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const key = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch((open) => !open);
      }
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("hashchange", hashChange);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("hashchange", hashChange);
      window.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    document.title = `mpm.js | ${allDocs.find((item) => item.id === page)?.title ?? "Documentation"}`;
  }, [page]);

  const navigate = (id) => {
    setSidebarOpen(false);
    setSearch(false);
    if (page === id) window.scrollTo({ top: 0, behavior: "smooth" });
    else {
      window.location.hash = id;
      setPage(id);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };
  const openPlayground = (selection) => {
    setPlaySelection(selection);
    navigate("playground");
  };

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header
        page={page}
        navigate={navigate}
        onSearch={() => setSearch(true)}
        onMenu={() => setSidebarOpen(!sidebarOpen)}
      />
      <Sidebar
        page={page}
        navigate={navigate}
        onSearch={() => setSearch(true)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main
        id="main-content"
        className={`main-content ${page === "overview" ? "overview-page" : ""}`}
      >
        <div className="content-inner">
          <Breadcrumb page={page} navigate={navigate} />
          {page === "overview" ? (
            <Overview navigate={navigate} openPlayground={openPlayground} />
          ) : page === "playground" ? (
            <>
              <motion.div
                className="article-intro playground-intro"
                {...fadeIn}
              >
                <span className="section-kicker">
                  LESS THEORY. MORE TINKERING.
                </span>
                <h1>Make a little room for play.</h1>
                <p>Pour something. Spin something. See what happens.</p>
              </motion.div>
              <Playground
                key={JSON.stringify(playSelection)}
                expanded
                initialMaterial={playSelection.material ?? "sand"}
                initialWheel={playSelection.wheel}
                initialScene={playSelection.nativeScene}
              />
              <div className="playground-tip">
                <Code2 size={18} />
                <p>
                  This is the real library, running live. Open{" "}
                  <strong>View code</strong> to take your setup with you.
                  <br />
                  The console exposes <code>window.mpmDemo</code> and{" "}
                  <code>window.MPM</code> for your own experiments.
                </p>
              </div>
              <PageFooter navigate={navigate} />
            </>
          ) : page === "examples" ? (
            <Examples navigate={navigate} openPlayground={openPlayground} />
          ) : (
            <Article
              page={page}
              navigate={navigate}
              openPlayground={openPlayground}
            />
          )}
        </div>
      </main>
      <AnimatePresence>
        {search && (
          <SearchDialog navigate={navigate} onClose={() => setSearch(false)} />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
