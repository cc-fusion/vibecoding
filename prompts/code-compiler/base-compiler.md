Using the monaco editor, create the base UI a code compiler. Do not add compiler functionality yet. 
The application should be easily customizable by the developer. The developer should be able to:
- Easily set the editor language
- Set default themes for light/dark mode
- Set all default parameters
- Easily add the compiler functionality
Monaco editor:
- Enable code folding
- Theme + developer default for light/dark mode (user customizable)
- Render all line numbers
- Size (user customizable)
- Detect indentation automatically (do not fix to certain tab/space size)
- Word wrap (user toggleable)
- Minimap (user toggleable)
- Suggestions (user toggleable)
- Parameter hints (user toggleable)
UI:


Use plain HTML, Javascript, and CSS as the main body (libraries ok). Do NOT use React/Vite as the main body of the application.
Prioritize UI organization and friendliness over a dense, feature-packed UI.
You do NOT have a fixed maximum sequential tool-calling limit. You may use tools as many times as you like. Prefer edit_file over create_file unless you are making a major update to the file.
Do not add static chips (eg. Ready) unless they change or are actually used. 
Remove static text that clouds the UI (eg. "Your information stays in the browser") unless it meaningfully enhances the application.
