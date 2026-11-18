# Press configurator

Interactive 3D press configurator built with Three.js. No build step, no npm install.

## Features
- Add or remove flexo stations (1 to 10) and six add-on types (5 add-ons in total)
- Rearrange units by drag and drop, or with the arrow buttons
- Body color, accent color and finish
- Live press length in metres and feet
- Export a 3000 px PNG (white background with a summary, or transparent)
- Renders only when something changes, so it stays idle (no CPU or GPU use) when nobody is interacting

## Put it online (GitHub Pages)
1. Create a GitHub repository and upload all files from this folder to the root.
2. Go to Settings, then Pages. Under "Build and deployment", choose "Deploy from a branch", branch `main`, folder `/ (root)`, and save.
3. After a minute your site is live at `https://YOUR-USER.github.io/YOUR-REPO/`.

## Add it to Framer
1. In Framer, insert an **Embed** component.
2. Set it to **URL** and paste your GitHub Pages address.
3. Give the embed a height of at least 700 px on desktop and 900 px on mobile.

## Use your real press model later
Everything the machine looks like is in `parts.js`. Replace `buildModule`, `buildUnwinder` and `buildRewinder` so they return a clone of the matching object from your GLB (load it once with `GLTFLoader` and `DRACOLoader`). Module lengths live in `config.js`; keep them equal to the real model's lengths so units line up.

The three.js files load from jsDelivr (pinned to version 0.160.0), so visitors need an internet connection.
