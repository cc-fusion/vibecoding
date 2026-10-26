Using the monaco editor, create the base UI a code compiler. Do not add compiler functionality yet. 
The application should be easily customizable by the developer. The developer should be able to:
- Easily set the editor language
- Set default themes for light/dark mode
- Set all default parameters
- Easily add the compiler functionality
- Add/remove buttons
## Monaco editor
- Enable code folding
- Theme (user customizable)
- Render all line numbers
- Size (user customizable)
- Detect indentation automatically (do not fix to certain tab/space size)
- Word wrap (user toggleable)
- Minimap (user toggleable)
- Suggestions (user toggleable)
- Parameter hints (user toggleable)
## UI
- Desktop: Code editor on left, result on right.
- Mobile: Code editor on top, result on bottom
- Resize bar in between code editor and result.
- Top bar contains buttons to run, open result in new tab, toggle dark/light mode, open editor settings, developer can add new buttons.
- Never auto-run code
## Functionality
- Save code in localStorage, never execute on page load
- When dragging, ensure mousemove events do not stop when the mouse goes into the result/code; change pointer events
- Do not add a custom title, a logo, or branding. This is a generic code editor. Title with "Code Editor"
- Set theme based on system theme
- Write everything in a single HTML file.

Use plain HTML, Javascript, and CSS as the main body (libraries ok). Do NOT use React/Vite as the main body of the application.
Prioritize UI organization and friendliness over a dense, feature-packed UI.
You do NOT have a fixed maximum sequential tool-calling limit. You may use tools as many times as you like. Prefer edit_file over create_file unless you are making a major update to the file.
Do not add static chips (eg. Ready) unless they change or are actually used. 
Remove static text that clouds the UI (eg. "Your information stays in the browser") unless it meaningfully enhances the application.
