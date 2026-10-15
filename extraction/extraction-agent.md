Plan to expand all zips in agent/* and all subdirectories. Because the zip file layouts may be inconsistent, verify with me before taking action. For each .zip, provide:
- The path
- Zip content and layout
- Default action based on the default workflow shown below

The default workflow is as follows:
1. Extract its contents into a directory named `<zip-file-name>/`.
2. Once safely extracted, delete the original `.zip` file.
3. Inspect the root of each extracted folder:
- If the folder contains plain HTML and standard static assets without a build system, leave the directory as-is.
- If the folder contains a React/Vite application: Build the project into a single, fully inlined HTML file (inline all CSS and JS chunks) located at `<zip-file-name>/dist/index.html`.
Some zip files may not follow the HTML/React convention. In this case, make an inference about default action based on the contents in the file. If I do not specify an alternative action in the next step, go with your provided default action.

Do not modify anything in this step.
