#!/bin/bash
# Assemble the standalone MPM.js library from its parts.
cd "$(dirname "$0")"
cat src/01-engine.js src/02-scenes.js src/03-host.js src/04-renderer.js src/05-simulation.js src/06-data.js src/07-post.js > mpm.js
cp mpm.js ../public/lib/mpm.js
echo "Built lib/mpm.js ($(wc -c < mpm.js) bytes)"
