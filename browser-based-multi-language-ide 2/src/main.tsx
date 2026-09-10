import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// StrictMode is intentionally not used: the IDE is an imperative, long-lived
// vanilla-DOM application mounted once; StrictMode's double effect invocation
// would create and tear down Monaco/IndexedDB connections twice on startup.
createRoot(document.getElementById("root")!).render(<App />);
