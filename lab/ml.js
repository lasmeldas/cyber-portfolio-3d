// k-nearest neighbours and k-means in JavaScript, following the same algorithms as ml-from-scratch.
// The k-NN predictions are checked against the Python implementation in tests/lab.test.mjs.

/** k-NN with Euclidean distance and uniform votes. Ties go to the smallest class, like numpy's argmax. */
export function knnPredict(X, y, k, queries) {
  const classes = [...new Set(y)].sort((a, b) => a - b);
  const kk = Math.min(k, X.length);
  return queries.map((q) => {
    const order = X.map((p, i) => [Math.hypot(p[0] - q[0], p[1] - q[1]), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); // stable on ties
    const votes = new Map(classes.map((c) => [c, 0]));
    for (let j = 0; j < kk; j++) votes.set(y[order[j][1]], votes.get(y[order[j][1]]) + 1);
    let best = classes[0];
    for (const c of classes) if (votes.get(c) > votes.get(best)) best = c;
    return best;
  });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function plusPlus(X, k, rand) {
  const centers = [X[Math.floor(rand() * X.length)]];
  while (centers.length < k) {
    const dist = X.map((p) => Math.min(...centers.map((c) => d2(p, c))));
    const total = dist.reduce((s, v) => s + v, 0);
    if (total === 0) { centers.push(X[Math.floor(rand() * X.length)]); continue; }
    let r = rand() * total;
    let idx = 0;
    for (; idx < dist.length - 1; idx++) { r -= dist[idx]; if (r <= 0) break; }
    centers.push(X[idx]);
  }
  return centers.map((c) => [...c]);
}

/** k-means: k-means++ starts, Lloyd's algorithm, best of nInit runs by inertia. Seeded, so repeatable. */
export function kmeans(X, k, { nInit = 10, maxIter = 100, seed = 0 } = {}) {
  if (X.length < k) return null;
  const rand = mulberry32(seed);
  let best = null;
  for (let run = 0; run < nInit; run++) {
    let centers = plusPlus(X, k, rand);
    let labels = new Array(X.length).fill(0);
    for (let it = 0; it < maxIter; it++) {
      labels = X.map((p) => { let b = 0; for (let c = 1; c < k; c++) if (d2(p, centers[c]) < d2(p, centers[b])) b = c; return b; });
      const next = centers.map((c, ci) => {
        const mine = X.filter((_, i) => labels[i] === ci);
        return mine.length ? [mine.reduce((s, p) => s + p[0], 0) / mine.length, mine.reduce((s, p) => s + p[1], 0) / mine.length] : c;
      });
      const moved = Math.max(...next.map((c, i) => Math.sqrt(d2(c, centers[i]))));
      centers = next;
      if (moved < 1e-6) break;
    }
    const inertia = X.reduce((s, p, i) => s + d2(p, centers[labels[i]]), 0);
    if (!best || inertia < best.inertia) best = { centers, labels, inertia };
  }
  return best;
}
