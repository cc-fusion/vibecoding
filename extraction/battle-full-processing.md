Process all `.zip` archives located in battle + all subdirectories according to the exact workflow below:
1. For each archive `<name>.zip` in that directory/subdirectory, extract its contents into a subdirectory named `<name>/`.
2. Once safely extracted, delete the original `.zip` file.
3. Iterate through all files across all newly extracted directories and print a report showing the total character count across all files.
4. Inspect the root of each extracted folder:
- **Static HTML:** If the folder contains plain `index.html` and standard static assets without a build system, leave the directory as-is.
- **React / Vite:** If the folder contains a `package.json` indicating a React/Vite application: Build the project into a **single, fully inlined HTML file** (inline all CSS and JS chunks) located at `<name>/dist/index.html`.
Modify or create the index.html file in the directory. Ensure it follows this format:
Given a layout
battle/
  model-name/
    file1.html
    subdirectory/
      file2.html
  model-2-name/
    file3.html
  index.html
  ...
Resulting index.html file:
```
<style>div a{display:block}</style>
<h3>Title</h3>
<p>N total characters used</p>

<div>
<h4>Model name (N characters used)</h4>
<a href="model-name/file1.html">Title</a>
<a href="model-name/subdirectory/file2.html">Title</a>
<h4>Model 2 name (N characters used)</h4>
<a href="model-2-name/file3.html">Title</a>
</div>
```
