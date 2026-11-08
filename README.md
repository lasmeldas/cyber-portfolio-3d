# cyber-portfolio-3d

An interactive 3D portfolio built with **Three.js**: a glowing network of nodes that reacts to your mouse and scroll, with a typed intro and project cards. No framework, no build step.

![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=threedotjs)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-green)

**Live demo:** https://lasmeldas.github.io/cyber-portfolio-3d/ (after enabling GitHub Pages, see below)

## Features

- **3D hero scene:** a counter-rotating wireframe core, a linked node network and a starfield, all drawn with WebGL.
- **Interactive:** the camera follows the pointer, and scrolling rotates the network.
- **Accessible:** respects `prefers-reduced-motion` (shows one still frame and static text), keyboard focus styles, and readable contrast.
- **Graceful fallback:** if WebGL isn't available, the page still works without the 3D background.
- **Responsive:** laid out for phones, tablets and desktops.
- **Zero build:** three small files and one CDN import.

## Project structure

```
cyber-portfolio-3d/
├── index.html   # page content and import map
├── style.css    # theme, layout, animations
├── main.js      # Three.js scene, typing effect, scroll reveal
├── LICENSE
└── README.md
```

## Run locally

ES modules need a web server, so opening the file directly won't work. From the project folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Open the repo's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and the `/ (root)` folder, then save.
4. After a minute the site is live at `https://<your-username>.github.io/cyber-portfolio-3d/`.

## Customize

- **Content:** edit the text and links in `index.html`.
- **Colors:** change the CSS variables at the top of `style.css`.
- **Scene:** adjust node count, radius and colors at the top of `main.js` (`NODE_COUNT`, `RADIUS`, `GREEN`, `CYAN`).
- **Typed roles:** edit the `roles` array in `startTyping()` in `main.js`.

## Tech

[Three.js](https://threejs.org/) r160 loaded from jsDelivr through an import map. Plain HTML, CSS and JavaScript.

## License

[MIT](LICENSE)
