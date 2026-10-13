// React is used ONLY as an outer deployment wrapper.
// The entire Swarm Intelligence Lab simulation is implemented in
// standard HTML/CSS/JavaScript inside swarm.html (imported as raw text).
// @ts-ignore - raw HTML import handled by Vite
import simHtml from "./swarm.html?raw";

export default function App() {
  return (
    <iframe
      title="Swarm Intelligence Lab"
      srcDoc={simHtml as unknown as string}
      style={{ width: "100vw", height: "100vh", border: "none", display: "block", background: "#0b100e" }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
