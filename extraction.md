Process all `.zip` archives located in XXX according to the exact workflow below:
1. For each archive `<name>.zip` in that directory, extract its contents into a subdirectory named `<name>/`.
2. Once safely extracted, delete the original `.zip` file.
3. Iterate through all files across all newly extracted directories and print a report showing the total character count across all files.
4. Inspect the root of each extracted folder:
- **Static HTML:** If the folder contains plain `index.html` and standard static assets without a build system, leave the directory as-is.
- **React / Vite:** If the folder contains a `package.json` indicating a React/Vite application: Build the project into a **single, fully inlined HTML file** (inline all CSS and JS chunks) located at `<name>/dist/index.html`.
