import simHtml from "./planet.html?raw";

export default function App() {
  return (
    <iframe
      title="Planet Forge — Tectonic Planet Builder"
      srcDoc={simHtml}
      style={{ width: "100vw", height: "100vh", border: "none", display: "block", background: "#101311" }}
    />
  );
}
