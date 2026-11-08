import * as THREE from 'three';

const canvas = document.getElementById('scene');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GREEN = 0x00ffa3;
const CYAN = 0x38bdf8;

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
    // On wide screens push the network to the right so the text sits on the left.
    world.position.x = w > 900 ? 2.2 : 0;
    world.scale.setScalar(w > 900 ? 1 : 0.8);
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

  const clock = new THREE.Clock();
  function frame() {
    const t = clock.getElapsedTime();
    core.rotation.x = t * 0.25;
    core.rotation.y = t * 0.35;
    inner.rotation.x = -t * 0.4;
    inner.rotation.y = -t * 0.3;
    core.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
    world.rotation.y = t * 0.08 + scrollT * Math.PI;
    stars.rotation.y = t * 0.01;

    // Ease the camera toward the pointer for a gentle parallax.
    camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 0.8 - camera.position.y) * 0.05;
    camera.position.z = 8 + scrollT * 2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (reduceMotion) renderer.render(scene, camera);
  });

  if (reduceMotion) {
    renderer.render(scene, camera); // one still frame, no animation
  } else {
    frame();
  }
}

function startTyping() {
  const el = document.getElementById('typed');
  if (!el) return;
  const roles = ['Cybersecurity enthusiast', 'AI builder', 'Threat detection', 'Open-source tinkerer'];
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

document.getElementById('year').textContent = new Date().getFullYear();
startTyping();
startReveal();
startScene();
