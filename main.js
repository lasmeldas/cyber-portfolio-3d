import * as THREE from 'three';

document.documentElement.dataset.ready = '1'; // tells the page the 3D script loaded

const OWNER = 'lasmeldas';
const canvas = document.getElementById('scene');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GREEN = 0x00ffa3;
const CYAN = 0x38bdf8;

// Motion starts off for people who asked their system to reduce motion.
let paused = reduceMotion;

function setupMotionToggle() {
  const button = document.getElementById('motion-toggle');
  if (!button) return;
  const sync = () => {
    button.setAttribute('aria-pressed', String(!paused));
    button.textContent = paused ? 'Motion: off' : 'Motion: on';
  };
  button.addEventListener('click', () => {
    paused = !paused;
    sync();
  });
  sync();
}

function startScene() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    // No WebGL: the page still works, just without the 3D background.
    document.body.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const world = new THREE.Group();
  scene.add(world);

  // Glowing wireframe core: two counter-rotating icosahedrons.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: GREEN, wireframe: true, transparent: true, opacity: 0.85 })
  );
  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 0),
    new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.9 })
  );
  world.add(core, inner);

  // Network: nodes spread over a sphere (Fibonacci lattice), linked when close.
  const NODE_COUNT = 110;
  const RADIUS = 3.4;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const positions = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const jitter = 0.85 + Math.random() * 0.3;
    positions.push(
      new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).multiplyScalar(RADIUS * jitter)
    );
  }

  const nodes = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(positions),
    new THREE.PointsMaterial({ color: GREEN, size: 0.07, transparent: true, opacity: 0.95 })
  );
  world.add(nodes);

  const linkPoints = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[i].distanceTo(positions[j]) < 1.5) linkPoints.push(positions[i], positions[j]);
    }
  }
  const links = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linkPoints),
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.28 })
  );
  world.add(links);

  // Distant starfield for depth.
  const STAR_COUNT = 700;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < starPositions.length; i++) starPositions[i] = (Math.random() - 0.5) * 40;
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.03, transparent: true, opacity: 0.6 })
  );
  scene.add(stars);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Wide screens: network on the right, text on the left.
    // Narrow screens: a smaller network below the text so nothing is hard to read.
    const wide = w > 900;
    world.position.set(wide ? 2.2 : 0, wide ? 0 : -2.9, 0);
    world.scale.setScalar(wide ? 1 : 0.5);
  }

  const mouse = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  });

  let scrollT = 0;
  window.addEventListener(
    'scroll',
    () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollT = max > 0 ? window.scrollY / max : 0;
    },
    { passive: true }
  );

  // Animation time only advances while motion is on, so pausing never causes a jump.
  let animTime = 0;
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!paused) {
      animTime += dt;
      // Ease the camera toward the pointer for a gentle parallax.
      camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.05;
      camera.position.y += (-mouse.y * 0.8 - camera.position.y) * 0.05;
    }
    core.rotation.x = animTime * 0.25;
    core.rotation.y = animTime * 0.35;
    inner.rotation.x = -animTime * 0.4;
    inner.rotation.y = -animTime * 0.3;
    core.scale.setScalar(1 + Math.sin(animTime * 1.6) * 0.04);
    world.rotation.y = animTime * 0.08 + scrollT * Math.PI;
    stars.rotation.y = animTime * 0.01;
    camera.position.z = 8 + scrollT * 2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  frame();
}

function startTyping() {
  const el = document.getElementById('typed');
  if (!el) return;
  const roles = ['Software developer', 'Machine learning builder', 'Cybersecurity enthusiast', 'Open-source tinkerer'];
  if (reduceMotion) {
    el.textContent = roles[0];
    return;
  }
  let role = 0;
  let chars = 0;
  let deleting = false;
  function tick() {
    const word = roles[role];
    chars += deleting ? -1 : 1;
    el.textContent = word.slice(0, chars);
    let delay = deleting ? 35 : 70;
    if (!deleting && chars === word.length) {
      deleting = true;
      delay = 1400;
    } else if (deleting && chars === 0) {
      deleting = false;
      role = (role + 1) % roles.length;
      delay = 300;
    }
    setTimeout(tick, delay);
  }
  tick();
}

function startReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => observer.observe(el));
}

// ---- Live repositories from the public GitHub API -------------------------

const LANGUAGE_COLORS = {
  Python: '#3572A5',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#9aa4b2',
  Go: '#00ADD8',
  Rust: '#dea584',
  Shell: '#89e051',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Jupyter: '#DA5B0B',
};

const CACHE_KEY = 'repos-cache-v1';
const CACHE_MS = 10 * 60 * 1000; // the unauthenticated API allows only 60 requests/hour

function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.time < CACHE_MS) return cached.data;
  } catch (err) {
    /* storage unavailable: fall through to the network */
  }
  return null;
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
  } catch (err) {
    /* ignore */
  }
}

function repoCard(repo) {
  const card = document.createElement('article');
  card.className = 'card';

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = repo.language || 'Repository';

  const title = document.createElement('h3');
  const link = document.createElement('a');
  link.href = repo.html_url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = repo.name;
  title.appendChild(link);

  const description = document.createElement('p');
  description.textContent = repo.description || 'No description yet.';

  const meta = document.createElement('div');
  meta.className = 'repo-meta';
  if (repo.language) {
    const lang = document.createElement('span');
    const dot = document.createElement('span');
    dot.className = 'lang-dot';
    dot.style.background = LANGUAGE_COLORS[repo.language] || '';
    lang.append(dot, repo.language);
    meta.appendChild(lang);
  }
  const stars = document.createElement('span');
  stars.textContent = `★ ${repo.stargazers_count}`;
  const updated = document.createElement('span');
  updated.textContent = `Updated ${new Date(repo.pushed_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
  meta.append(stars, updated);

  card.append(tag, title, description, meta);
  return card;
}

async function loadRepos() {
  const grid = document.getElementById('repo-grid');
  const status = document.getElementById('repo-status');
  if (!grid || !status) return;
  try {
    let repos = readCache();
    if (!repos) {
      const response = await fetch(`https://api.github.com/users/${OWNER}/repos?per_page=100&sort=pushed`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
      repos = await response.json();
      writeCache(repos);
    }
    const shown = repos
      .filter((r) => !r.fork && !r.archived && r.name.toLowerCase() !== OWNER)
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
      .slice(0, 6);
    if (shown.length === 0) {
      status.textContent = 'No public repositories to show yet.';
      return;
    }
    shown.forEach((repo) => grid.appendChild(repoCard(repo)));
    status.textContent = '';
  } catch (err) {
    status.textContent = 'Could not load repositories right now. You can see them all on my GitHub profile.';
  }
}

document.getElementById('year').textContent = new Date().getFullYear();
setupMotionToggle();
startTyping();
startReveal();
startScene();
loadRepos();

// Project filter: show only the cards whose data-cat includes the chosen area.
(function () {
  const buttons = document.querySelectorAll('.filter');
  const cards = document.querySelectorAll('#project-grid .card');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const want = btn.dataset.filter;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      cards.forEach(function (card) {
        card.hidden = want !== 'all' && card.dataset.cat.split(' ').indexOf(want) === -1;
      });
    });
  });
})();
