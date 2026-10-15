import { IDE } from './IDE.js';

const host = document.getElementById('root');
const ide = new IDE(host);
// Export the instance for integrations and browser regression tests, not a framework global.
export { ide };
try {
  await ide.start();
} catch (error) {
  console.error('Forge IDE startup failed', error);
  const message = document.createElement('p');
  message.textContent = `Unable to start Forge IDE: ${error.message}. Serve this folder over HTTP, then reload.`;
  host.replaceChildren(message);
}
window.addEventListener('pagehide', event => { if (!event.persisted) ide.dispose(); });
