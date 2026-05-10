const TWO_PI = Math.PI * 2;
const SAMPLE_COUNT = 240;
const ITERATION_COUNT = 16;

const citations = [
  {
    label: "Cai, Zhang, Bai, Li (2018)",
    href: "https://doi.org/10.1137/17M115935X",
    note:
      "This paper studies nonlinear eigenvalue problems with eigenvector dependency and explains why self-consistent iterations can converge, slow down, or become delicate.",
  },
  {
    label: "Chiappinelli (2018)",
    href: "https://doi.org/10.3390/axioms7020039",
    note:
      "This article gives a broader view of what a nonlinear eigenvalue problem can mean across different mathematical settings.",
  },
];

const presets = {
  balanced: {
    label: "Balanced Mode",
    baseGap: 1.1,
    anisotropy: 0.7,
    coupling: 0.55,
    feedback: 0.85,
    twist: 0.45,
    mix: 0.3,
    seedAngle: 0.4,
  },
  sticky: {
    label: "Sticky Case",
    baseGap: 0.6,
    anisotropy: 1.0,
    coupling: 0.35,
    feedback: 1.15,
    twist: 0.8,
    mix: 0.38,
    seedAngle: 1.55,
  },
  almostLinear: {
    label: "Almost Linear",
    baseGap: 1.4,
    anisotropy: 0.12,
    coupling: 0.12,
    feedback: 0.18,
    twist: 0.1,
    mix: 0.7,
    seedAngle: -0.8,
  },
};

const sliderHelp = {
  baseGap: "Controls the natural separation between the matrix's two main directions. Larger values make some directions more dominant.",
  anisotropy: "Controls how differently directions on the unit circle are treated. Larger values make the geometry less even.",
  coupling: "Controls how strongly the two coordinate axes pull on each other. Larger values rotate arrows more toward diagonal directions.",
  feedback: "Controls how strongly the vector changes the matrix. Larger values make the NEPv feedback more visible.",
  twist: "Controls the rotational twist between directions. Larger values can bend the iteration path or make it loop around.",
  mix: "Controls how far each update moves. Too small is slow; too large can overshoot the target.",
  seedAngle: "Controls which direction on the unit circle is used as the first guess. It shows whether the initial value matters.",
};

let state = { ...presets.balanced };
let trailPlaybackId = 0;
let derivationStep = 0;
let isAutoPlaying = false;
let playbackTimerId = null;
let pageMotionObserver = null;
let scrollEffectsBound = false;

function stopAutoPlayback() {
  isAutoPlaying = false;
  if (playbackTimerId) {
    window.clearTimeout(playbackTimerId);
    playbackTimerId = null;
  }
}

function normalizeAngle(angle) {
  let value = angle;
  while (value <= -Math.PI) value += TWO_PI;
  while (value > Math.PI) value -= TWO_PI;
  return value;
}

function angleToUnit(angle) {
  return [Math.cos(angle), Math.sin(angle)];
}

function operatorAt(angle, params) {
  const [x, y] = angleToUnit(angle);
  return {
    a:
      -params.baseGap +
      params.anisotropy * (x * x - y * y) +
      0.35 * params.feedback * x,
    b: params.coupling + params.twist * x * y,
    d:
      params.baseGap -
      params.anisotropy * (x * x - y * y) -
      0.35 * params.feedback * x,
  };
}

function eigenSystem2x2({ a, b, d }) {
  const traceHalf = (a + d) / 2;
  const radius = Math.sqrt(((a - d) / 2) ** 2 + b ** 2);
  const lambdaSmall = traceHalf - radius;
  const lambdaLarge = traceHalf + radius;
  const vectorRaw =
    Math.abs(b) > 1e-8 ? [b, lambdaSmall - a] : a <= d ? [1, 0] : [0, 1];
  const norm = Math.hypot(vectorRaw[0], vectorRaw[1]) || 1;
  const vector = [vectorRaw[0] / norm, vectorRaw[1] / norm];

  return {
    lambdaSmall,
    lambdaLarge,
    smallAngle: Math.atan2(vector[1], vector[0]),
    smallVector: vector,
  };
}

function alignedAngle(target, reference) {
  const alternate = normalizeAngle(target + Math.PI);
  const directGap = Math.abs(normalizeAngle(target - reference));
  const alternateGap = Math.abs(normalizeAngle(alternate - reference));
  return alternateGap < directGap ? alternate : target;
}

function stepState(angle, params) {
  const matrix = operatorAt(angle, params);
  const eig = eigenSystem2x2(matrix);
  const targetAngle = alignedAngle(eig.smallAngle, angle);
  const residual = normalizeAngle(targetAngle - angle);
  const nextAngle = normalizeAngle(angle + params.mix * residual);
  const [x, y] = angleToUnit(angle);
  const rayleigh = x * (matrix.a * x + matrix.b * y) + y * (matrix.b * x + matrix.d * y);

  return {
    angle,
    targetAngle,
    residual,
    nextAngle,
    matrix,
    rayleigh,
    ...eig,
  };
}

function computeSeries(params) {
  const series = [];
  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const angle = -Math.PI + (index / SAMPLE_COUNT) * TWO_PI;
    series.push(stepState(angle, params));
  }
  return series;
}

function dedupeAngles(points) {
  return points.filter((point, index) => {
    return !points.slice(0, index).some((entry) => {
      return Math.abs(normalizeAngle(entry.angle - point.angle)) < 0.08;
    });
  });
}

function findFixedPoints(series, params) {
  const points = [];
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1];
    const current = series[index];
    if (Math.abs(current.residual) < 0.015) {
      points.push(current);
      continue;
    }
    if (previous.residual === 0 || previous.residual * current.residual > 0) {
      continue;
    }
    const ratio =
      Math.abs(previous.residual) /
      (Math.abs(previous.residual) + Math.abs(current.residual));
    const angle = previous.angle + ratio * (current.angle - previous.angle);
    points.push(stepState(angle, params));
  }
  return dedupeAngles(points);
}

function runIteration(params) {
  const states = [];
  let angle = params.seedAngle;
  for (let index = 0; index < ITERATION_COUNT; index += 1) {
    const snapshot = stepState(angle, params);
    states.push(snapshot);
    angle = snapshot.nextAngle;
  }
  return states;
}

function formatAngle(angle) {
  return `${(angle / Math.PI).toFixed(2)}π`;
}

function formatNumber(value) {
  return value.toFixed(3);
}

function formatVectorFromAngle(angle) {
  const [x, y] = angleToUnit(angle);
  return `[${formatNumber(x)}, ${formatNumber(y)}]`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPath(points, xFn, yFn) {
  return points
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${xFn(point).toFixed(2)} ${yFn(point).toFixed(2)}`;
    })
    .join(" ");
}

function iterationCircleSvg(iteration, fixedPoints, focusIndex = 0) {
  const width = 480;
  const height = 360;
  const center = { x: width / 2, y: 158 };
  const radius = 88;
  const focusStep = iteration[clamp(focusIndex, 0, iteration.length - 1)];
  const point = (angle, scale = radius) => {
    return {
      x: center.x + Math.cos(angle) * scale,
      y: center.y - Math.sin(angle) * scale,
    };
  };
  const [vx, vy] = angleToUnit(focusStep.angle);
  const avx = focusStep.matrix.a * vx + focusStep.matrix.b * vy;
  const avy = focusStep.matrix.b * vx + focusStep.matrix.d * vy;
  const transformedScale = radius / Math.max(1, Math.hypot(avx, avy));
  const transformedPoint = {
    x: center.x + avx * transformedScale,
    y: center.y - avy * transformedScale,
  };
  const currentPoint = point(focusStep.angle);
  const targetPoint = point(focusStep.targetAngle, radius * 0.9);
  const nextPoint = point(focusStep.nextAngle);
  const visibleIteration = iteration.slice(0, clamp(focusIndex, 0, iteration.length - 1) + 1);
  const trailPath =
    visibleIteration.length > 1
      ? toPath(visibleIteration, (step) => point(step.angle).x, (step) => point(step.angle).y)
      : "";
  const stepDots = visibleIteration
    .map((step, index) => {
      const p = point(step.angle);
      const cls = index === 0 ? "violet" : index === iteration.length - 1 ? "green" : "coral";
      const label = index === 0 ? "Start" : index === iteration.length - 1 ? "Stop" : "";
      return `
        <circle cx="${p.x}" cy="${p.y}" r="${index === iteration.length - 1 ? 6 : 4}" class="chart-dot ${cls}" />
        ${label ? `<text x="${p.x + 8}" y="${p.y - 8}" class="vector-label ${cls}-label">${label}</text>` : ""}
      `;
    })
    .join("");
  const solutionDots = fixedPoints
    .map((step) => {
      const p = point(step.angle, radius + 18);
      return `<circle cx="${p.x}" cy="${p.y}" r="4" class="solution-dot" />`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg story-plot" aria-label="Vector relationships for the current iteration step">
      <defs>
        <marker id="arrow-cyan-main" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#27d6c9" />
        </marker>
        <marker id="arrow-coral-main" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#ff8d6d" />
        </marker>
        <marker id="arrow-amber-main" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#f2c14b" />
        </marker>
        <marker id="arrow-magenta-main" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#d86bff" />
        </marker>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" class="chart-bg" />
      <path d="M ${center.x} 42 L ${center.x} 274" class="chart-grid" />
      <path d="M 58 ${center.y} L ${width - 42} ${center.y}" class="chart-grid" />
      <circle cx="${center.x}" cy="${center.y}" r="${radius}" class="unit-circle vector-stage-circle" />
      ${trailPath ? `<path d="${trailPath}" class="iteration-trail ghost-trail" />` : ""}
      <g class="background-iteration-dots">
        ${stepDots}
      </g>
      ${solutionDots}
      <path d="M ${center.x} ${center.y} L ${currentPoint.x} ${currentPoint.y}" class="stage-vector current-stage-vector" marker-end="url(#arrow-cyan-main)" />
      <path d="M ${center.x} ${center.y} L ${transformedPoint.x} ${transformedPoint.y}" class="stage-vector transformed-stage-vector" marker-end="url(#arrow-coral-main)" />
      <path d="M ${center.x} ${center.y} L ${targetPoint.x} ${targetPoint.y}" class="stage-vector target-stage-vector" marker-end="url(#arrow-amber-main)" />
      <path d="M ${center.x} ${center.y} L ${nextPoint.x} ${nextPoint.y}" class="stage-vector next-stage-vector" marker-end="url(#arrow-magenta-main)" />
      <circle cx="${currentPoint.x}" cy="${currentPoint.y}" r="7" class="focus-dot cyan" />
      <circle cx="${transformedPoint.x}" cy="${transformedPoint.y}" r="6" class="focus-dot coral" />
      <circle cx="${targetPoint.x}" cy="${targetPoint.y}" r="6" class="focus-dot amber" />
      <circle cx="${nextPoint.x}" cy="${nextPoint.y}" r="6" class="focus-dot violet" />
      <text x="${currentPoint.x + 9}" y="${currentPoint.y - 10}" class="vector-label cyan-label">xₖ</text>
      <text x="${transformedPoint.x + 9}" y="${transformedPoint.y - 10}" class="vector-label coral-label">A(xₖ)xₖ</text>
      <text x="${targetPoint.x + 9}" y="${targetPoint.y + 18}" class="vector-label amber-label">vₖ</text>
      <text x="${nextPoint.x + 9}" y="${nextPoint.y - 10}" class="vector-label violet-label">xₖ₊₁</text>
      <g class="process-card">
        <rect x="18" y="286" width="208" height="54" rx="10" />
        <text x="32" y="308">Step order</text>
        <text x="32" y="328">xₖ → A(xₖ) → vₖ → xₖ₊₁</text>
      </g>
      <g class="legend-card">
        <rect x="236" y="286" width="226" height="54" rx="10" />
        <circle cx="252" cy="306" r="4" class="legend-cyan" /><text x="262" y="310">xₖ</text>
        <circle cx="302" cy="306" r="4" class="legend-coral" /><text x="312" y="310">A(xₖ)xₖ</text>
        <circle cx="386" cy="306" r="4" class="legend-amber" /><text x="396" y="310">vₖ</text>
        <circle cx="252" cy="326" r="4" class="legend-violet" /><text x="262" y="330">xₖ₊₁</text>
        <text x="318" y="330">Colors map to vectors</text>
      </g>
      <text x="22" y="${height - 8}" class="chart-help-label">Gray-blue dots are previous guesses; the orange-red arrow is the current A(xₖ)xₖ</text>
    </svg>
  `;
}

function derivationPanelMarkup(step, index) {
  const currentVector = formatVectorFromAngle(step.angle);
  const targetVector = formatVectorFromAngle(step.targetAngle);
  const nextVector = formatVectorFromAngle(step.nextAngle);

  return `
    <div class="derivation-panel" aria-label="Computation for the current iteration step">
      <div class="derivation-head">
        <span class="section-label">Step ${index}</span>
        <div>
          <h3>This frame is computed, not sketched</h3>
          <p>Each press of “Next step” sends the current guess through the same formulas.</p>
        </div>
      </div>
      <div class="derivation-grid">
        <article>
          <span class="math-tag">1. Current guess</span>
          <strong>xₖ = ${currentVector}</strong>
          <p>It is the cyan point on the unit circle, with angle θₖ = ${formatNumber(step.angle)} rad.</p>
        </article>
        <article>
          <span class="math-tag">2. Build the matrix</span>
          <div class="mini-equation">
            <span>${formatNumber(step.matrix.a)}</span>
            <span>${formatNumber(step.matrix.b)}</span>
            <span>${formatNumber(step.matrix.b)}</span>
            <span>${formatNumber(step.matrix.d)}</span>
          </div>
          <p>This is A(xₖ). Notice that it changes together with xₖ and the parameters on the right.</p>
        </article>
        <article>
          <span class="math-tag">3. Find the target direction</span>
          <strong>vₖ = ${targetVector}</strong>
          <p>We use the smaller-eigenvalue direction of A(xₖ); the yellow point is the direction the matrix recommends.</p>
        </article>
        <article>
          <span class="math-tag">4. Take one step</span>
          <strong>xₖ₊₁ = ${nextVector}</strong>
          <p>δₖ = ${formatNumber(step.residual)} rad, so θₖ₊₁ = θₖ + αδₖ, where α = ${formatNumber(state.mix)}.</p>
        </article>
      </div>
    </div>
  `;
}

function residualJourneySvg(iteration) {
  const width = 480;
  const height = 260;
  const pad = 34;
  const maxResidual = Math.max(0.001, ...iteration.map((step) => Math.abs(step.residual)));
  const bars = iteration
    .map((step, index) => {
      const availableWidth = width - pad * 2;
      const barWidth = availableWidth / iteration.length - 6;
      const x = pad + index * (availableWidth / iteration.length);
      const value = Math.abs(step.residual);
      const barHeight = 18 + (value / maxResidual) * (height - 100);
      const y = height - 44 - barHeight;
      const cls = value < 0.03 ? "stable-bar" : index === 0 ? "start-bar" : "moving-bar";
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" class="residual-bar ${cls}" />
        ${index % 3 === 0 ? `<text x="${x}" y="${height - 18}" class="tiny-label">${index}</text>` : ""}
      `;
    })
    .join("");
  const finalResidual = Math.abs(iteration[iteration.length - 1].residual);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg story-plot" aria-label="Direction error over the iteration">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" class="chart-bg" />
      <path d="M ${pad} ${height - 44} L ${width - pad} ${height - 44}" class="chart-grid strong" />
      ${bars}
      <text x="22" y="28" class="axis-label">Each bar is the direction error after one iteration</text>
      <text x="${width - 178}" y="28" class="meter-value">Final gap ${finalResidual.toFixed(4)} rad</text>
    </svg>
  `;
}

function basinStripSvg(params) {
  const width = 480;
  const height = 260;
  const pad = 30;
  const sampleCount = 72;
  const bucketColors = ["#27d6c9", "#8b5cf6", "#d86bff", "#f2c14b", "#7bd88f"];
  const buckets = [];
  const sampleWidth = (width - pad * 2) / sampleCount;
  const cells = Array.from({ length: sampleCount }, (_, index) => {
    const angle = -Math.PI + (index / (sampleCount - 1)) * TWO_PI;
    const path = runIteration({ ...params, seedAngle: angle });
    const end = path[path.length - 1];
    let bucketIndex = buckets.findIndex((bucketAngle) => {
      return Math.abs(normalizeAngle(bucketAngle - end.angle)) < 0.22;
    });
    if (bucketIndex === -1) {
      buckets.push(end.angle);
      bucketIndex = buckets.length - 1;
    }
    const color = bucketColors[bucketIndex % bucketColors.length];
    return `<rect x="${pad + index * sampleWidth}" y="92" width="${sampleWidth + 1}" height="64" fill="${color}" opacity="0.9" />`;
  }).join("");
  const seedX = pad + ((params.seedAngle + Math.PI) / TWO_PI) * (width - pad * 2);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg story-plot" aria-label="Convergence destinations from different starting angles">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" class="chart-bg" />
      <text x="22" y="28" class="axis-label">Each cell is a different starting angle</text>
      <text x="22" y="58" class="basin-note">Same color: same final self-consistent direction</text>
      <rect x="${pad}" y="92" width="${width - pad * 2}" height="64" rx="10" class="basin-frame" />
      ${cells}
      <path d="M ${seedX} 78 L ${seedX} 172" class="seed-marker" />
      <text x="${Math.min(width - 130, seedX + 8)}" y="188" class="axis-label">Current start</text>
      <text x="${pad}" y="${height - 24}" class="axis-label">-π</text>
      <text x="${width - pad - 12}" y="${height - 24}" class="axis-label">π</text>
    </svg>
  `;
}

function vectorPlaneSvg(current) {
  const width = 480;
  const height = 320;
  const center = { x: width / 2, y: height / 2 };
  const radius = 96;
  const [vx, vy] = angleToUnit(current.angle);
  const avx = current.matrix.a * vx + current.matrix.b * vy;
  const avy = current.matrix.b * vx + current.matrix.d * vy;
  const avScale = radius / Math.max(1, Math.hypot(avx, avy));
  const targetScale = radius * 0.82;
  const [tx, ty] = angleToUnit(current.targetAngle);
  const point = (xValue, yValue, scale = radius) => {
    return {
      x: center.x + xValue * scale,
      y: center.y - yValue * scale,
    };
  };
  const currentPoint = point(vx, vy);
  const transformedPoint = point(avx, avy, avScale);
  const targetPoint = point(tx, ty, targetScale);
  const arcRadius = 46;
  const arcStart = point(vx, vy, arcRadius);
  const arcEnd = point(tx, ty, arcRadius);
  const residualMagnitude = Math.abs(current.residual);
  const residualArc =
    residualMagnitude > 0.02
      ? `<path d="M ${arcStart.x} ${arcStart.y} A ${arcRadius} ${arcRadius} 0 ${residualMagnitude > Math.PI ? 1 : 0} ${current.residual < 0 ? 1 : 0} ${arcEnd.x} ${arcEnd.y}" class="angle-arc" />
         <text x="${center.x + 52}" y="${center.y - 10}" class="angle-label">direction gap</text>`
      : `<circle cx="${center.x + 42}" cy="${center.y - 8}" r="4" class="stable-ping" />
         <text x="${center.x + 52}" y="${center.y - 4}" class="angle-label">nearly aligned</text>`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg vector-plane" aria-label="Vector changes in coordinates">
      <defs>
        <marker id="arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#27d6c9" />
        </marker>
        <marker id="arrow-coral" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff8d6d" />
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f2c14b" />
        </marker>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" class="chart-bg" />
      <path d="M ${center.x} 34 L ${center.x} ${height - 34}" class="chart-grid" />
      <path d="M 42 ${center.y} L ${width - 42} ${center.y}" class="chart-grid" />
      <circle cx="${center.x}" cy="${center.y}" r="${radius}" class="unit-circle" />
      <path d="M ${center.x} ${center.y} L ${currentPoint.x} ${currentPoint.y}" class="vector-arrow current-vector" marker-end="url(#arrow-cyan)" />
      <path d="M ${center.x} ${center.y} L ${transformedPoint.x} ${transformedPoint.y}" class="vector-arrow transformed-vector" marker-end="url(#arrow-coral)" />
      <path d="M ${center.x} ${center.y} L ${targetPoint.x} ${targetPoint.y}" class="vector-arrow target-vector" marker-end="url(#arrow-amber)" />
      ${residualArc}
      <circle cx="${currentPoint.x}" cy="${currentPoint.y}" r="5" class="chart-dot cyan" />
      <circle cx="${transformedPoint.x}" cy="${transformedPoint.y}" r="5" class="chart-dot coral" />
      <circle cx="${targetPoint.x}" cy="${targetPoint.y}" r="5" class="chart-dot amber" />
      <text x="22" y="28" class="axis-label">Coordinate view</text>
      <text x="${currentPoint.x + 8}" y="${currentPoint.y - 8}" class="vector-label cyan-label">x</text>
      <text x="${transformedPoint.x + 8}" y="${transformedPoint.y - 8}" class="vector-label coral-label">A(x)x</text>
      <text x="${targetPoint.x + 8}" y="${targetPoint.y + 18}" class="vector-label amber-label">target</text>
    </svg>
  `;
}

function slider(label, key, min, max, step, value) {
  return `
    <label class="slider-field">
      <div class="slider-label">
        <span>${label}</span>
        <strong>${value.toFixed(2)}</strong>
      </div>
      <input data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      <p class="slider-help">${sliderHelp[key]}</p>
    </label>
  `;
}

function controlPanelMarkup() {
  return `
    <aside class="control-panel lab-controls">
      <div class="panel-heading compact">
        <div>
          <h2>Try it yourself</h2>
          <p>Drag the controls and watch the diagrams respond. Focus on whether the trail gathers, the direction gap shrinks, and the arrows align.</p>
        </div>
      </div>
      <div class="preset-row" role="tablist" aria-label="Model presets">
        ${Object.entries(presets)
          .map(([key, preset]) => {
            const active = state.label === preset.label ? "active" : "";
            return `<button type="button" class="preset-chip ${active}" data-preset="${key}">${preset.label}</button>`;
          })
          .join("")}
      </div>
      ${slider("Base gap", "baseGap", 0.2, 1.8, 0.01, state.baseGap)}
      ${slider("Direction bias", "anisotropy", 0, 1.5, 0.01, state.anisotropy)}
      ${slider("Coordinate coupling", "coupling", 0, 1.2, 0.01, state.coupling)}
      ${slider("Vector feedback", "feedback", 0, 1.4, 0.01, state.feedback)}
      ${slider("Twist strength", "twist", 0, 1.2, 0.01, state.twist)}
      ${slider("Update step", "mix", 0.1, 1, 0.01, state.mix)}
      ${slider("Starting angle", "seedAngle", -Math.PI, Math.PI, 0.01, state.seedAngle)}
    </aside>
  `;
}

function labSnapshot() {
  const series = computeSeries(state);
  const fixedPoints = findFixedPoints(series, state);
  const iteration = runIteration(state);
  const current = iteration[iteration.length - 1];
  const focusIndex = clamp(derivationStep, 0, iteration.length - 1);
  const focusStep = iteration[focusIndex];

  return {
    fixedPoints,
    iteration,
    current,
    focusIndex,
    focusStep,
    isDerivationDone: focusIndex === iteration.length - 1,
  };
}

function statusStripMarkup(current, fixedPoints, focusStep) {
  return `
    <span>Mode: <strong>${state.label}</strong></span>
    <span>Current angle: <strong>${formatAngle(focusStep.angle)}</strong></span>
    <span>Candidates: <strong>${fixedPoints.length}</strong></span>
    <span>Direction gap: <strong>${focusStep.residual.toFixed(3)} rad</strong></span>
  `;
}

function derivationStatusMarkup(focusIndex, isDerivationDone) {
  return isDerivationDone
    ? `<span class="status-step">Complete</span><span>Final direction gap is close to 0, so the iteration has settled near a self-consistent direction.</span>`
    : `<span class="status-step">Step ${focusIndex}</span><span>${
        isAutoPlaying
          ? "Auto-playing; all four vectors update with the current step."
          : "“Play derivation” advances the sequence automatically; “Next step” advances one computation by hand."
      }</span>`;
}

function matrixSnapshotMarkup(current) {
  return `
    <div class="matrix-grid">
      <div>
        <span class="section-label">Matrix Snapshot</span>
        <h3>Matrix generated by the current direction</h3>
        <div class="matrix-box">
          <span>${current.matrix.a.toFixed(3)}</span>
          <span>${current.matrix.b.toFixed(3)}</span>
          <span>${current.matrix.b.toFixed(3)}</span>
          <span>${current.matrix.d.toFixed(3)}</span>
        </div>
      </div>
      <div class="stats-grid">
        <div>
          <span class="eyebrow">Smaller eigenvalue</span>
          <strong>${current.lambdaSmall.toFixed(3)}</strong>
        </div>
        <div>
          <span class="eyebrow">Larger eigenvalue</span>
          <strong>${current.lambdaLarge.toFixed(3)}</strong>
        </div>
        <div>
          <span class="eyebrow">Direction from matrix</span>
          <strong>[${current.smallVector[0].toFixed(2)}, ${current.smallVector[1].toFixed(2)}]</strong>
        </div>
        <div>
          <span class="eyebrow">Direction gap</span>
          <strong>${current.residual.toFixed(3)} rad</strong>
        </div>
      </div>
    </div>
  `;
}

function updateTopbarState() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  const scrolled = window.scrollY > 18;
  topbar.classList.toggle("is-scrolled", scrolled);

  const targets = ["story", "compare", "lab", "interactive-lab", "formula"];
  let activeId = "top";
  targets.forEach((id) => {
    const section = document.getElementById(id);
    if (section && section.getBoundingClientRect().top <= 120) {
      activeId = id;
    }
  });

  topbar.querySelectorAll(".topbar-links a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isActive =
      href === `#${activeId}` ||
      (activeId === "interactive-lab" && href === "#lab");
    link.classList.toggle("is-active", isActive);
  });
}

function setupPageMotion() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(
    ".hero-copy, .hero-visual, .story-path, .panel, .intro-steps article, .insight-grid article, .theory-flow article, .toy-grid article, .graph-guide article"
  );

  if (pageMotionObserver) {
    pageMotionObserver.disconnect();
    pageMotionObserver = null;
  }

  revealTargets.forEach((element, index) => {
    element.classList.add("book-reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 45}ms`);
    const rect = element.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (prefersReducedMotion || alreadyInView) {
      element.classList.add("is-visible");
    } else {
      element.classList.remove("is-visible");
    }
  });

  if (!prefersReducedMotion) {
    if ("IntersectionObserver" in window) {
      pageMotionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              pageMotionObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      revealTargets.forEach((element) => {
        if (!element.classList.contains("is-visible")) {
          pageMotionObserver.observe(element);
        }
      });
    } else {
      revealTargets.forEach((element) => element.classList.add("is-visible"));
    }
  }

  if (!scrollEffectsBound) {
    scrollEffectsBound = true;
    window.addEventListener("scroll", updateTopbarState, { passive: true });
    window.addEventListener("hashchange", updateTopbarState);
  }

  updateTopbarState();
}

function refreshDynamicLab() {
  const {
    fixedPoints,
    iteration,
    current,
    focusIndex,
    focusStep,
    isDerivationDone,
  } = labSnapshot();
  const root = document.getElementById("root");

  const statusStrip = root.querySelector("[data-dynamic='status-strip']");
  if (statusStrip) statusStrip.innerHTML = statusStripMarkup(current, fixedPoints, focusStep);

  const playButton = root.querySelector("[data-action='play-trail']");
  if (playButton) {
    playButton.innerHTML = `<span aria-hidden="true">▶</span>${isAutoPlaying ? "Playing..." : "Play derivation"}`;
  }

  const derivationStatus = root.querySelector("[data-dynamic='derivation-status']");
  if (derivationStatus) {
    derivationStatus.innerHTML = derivationStatusMarkup(focusIndex, isDerivationDone);
  }

  const mainChart = root.querySelector("[data-dynamic='main-iteration-chart']");
  if (mainChart) mainChart.innerHTML = iterationCircleSvg(iteration, fixedPoints, focusIndex);

  const derivationPanel = root.querySelector("[data-dynamic='derivation-panel']");
  if (derivationPanel) derivationPanel.innerHTML = derivationPanelMarkup(focusStep, focusIndex);

  const vectorPlane = root.querySelector("[data-dynamic='vector-plane']");
  if (vectorPlane) vectorPlane.innerHTML = vectorPlaneSvg(current);

  const residualChart = root.querySelector("[data-dynamic='residual-chart']");
  if (residualChart) residualChart.innerHTML = residualJourneySvg(iteration);

  const basinChart = root.querySelector("[data-dynamic='basin-chart']");
  if (basinChart) basinChart.innerHTML = basinStripSvg(state);

  const matrixSnapshot = root.querySelector("[data-dynamic='matrix-snapshot']");
  if (matrixSnapshot) matrixSnapshot.innerHTML = matrixSnapshotMarkup(current);
}

function scheduleAutoPlayback() {
  if (!isAutoPlaying) return;

  const { iteration, focusIndex } = labSnapshot();
  if (focusIndex >= iteration.length - 1) {
    stopAutoPlayback();
    refreshDynamicLab();
    return;
  }

  playbackTimerId = window.setTimeout(() => {
    playbackTimerId = null;
    derivationStep = Math.min(derivationStep + 1, iteration.length - 1);
    refreshDynamicLab();
    scheduleAutoPlayback();
  }, 620);
}

function render() {
  const root = document.getElementById("root");
  const {
    fixedPoints,
    iteration,
    current,
    focusIndex,
    focusStep,
    isDerivationDone,
  } = labSnapshot();
  if (isDerivationDone && isAutoPlaying) {
    stopAutoPlayback();
  }

  root.innerHTML = `
    <div class="app-shell">
      <nav class="topbar" aria-label="Page navigation">
        <a class="brand-mark" href="#top">
          <span>NEPv</span>
          <strong>Visual Lab</strong>
        </a>
        <div class="topbar-links">
          <a href="#story">Story</a>
          <a href="#compare">Compare</a>
          <a href="#lab">Lab</a>
          <a href="#formula">Formula</a>
        </div>
      </nav>

      <header id="top" class="hero">
        <div class="hero-copy">
          <p class="kicker">NEPv Interactive Primer</p>
          <h1>What happens when a matrix changes after looking at the vector?</h1>
          <p class="lede">
            In an ordinary eigenvalue problem, a fixed matrix pushes an arrow: which arrows only stretch
            or shrink while keeping their direction? NEPv is subtler: the matrix itself changes with the
            arrow. This page uses a two-dimensional toy model to build intuition for that guess-update-check loop.
          </p>
          <div class="hero-notes">
            <span>Start with eigenvectors</span>
            <span>2D toy model</span>
            <span>Adjustable parameters</span>
          </div>
          <div class="story-equation" aria-label="From the ordinary eigenvalue equation to the NEPv equation">
            <span>A x = λ x</span>
            <span class="story-arrow">→</span>
            <span>A(x) x = λ x</span>
          </div>
          <div class="hero-actions">
            <a href="#lab" class="primary-link">Enter the lab</a>
            <a href="#formula" class="secondary-link">Read the formula first</a>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="orbit-ring">
            <span class="vector-dot current-dot"></span>
            <span class="vector-dot target-dot"></span>
            <span class="vector-line current-line"></span>
            <span class="vector-line target-line"></span>
          </div>
          <div class="mini-matrix">
            <span>a(x)</span>
            <span>b(x)</span>
            <span>b(x)</span>
            <span>d(x)</span>
          </div>
          <p class="visual-caption">Geometric intuition: the vector gives a direction, the matrix changes with that direction, then the matrix pushes the vector toward a new direction.</p>
        </div>
      </header>

      <main class="content-grid">
        <section class="story-path" aria-label="Learning path">
          <span>1. Meet the arrow</span>
          <span>2. Watch the matrix push it</span>
          <span>3. Search for self-consistency</span>
        </section>

        <section id="story" class="panel intro-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Chapter 01</span>
              <h2>Say the problem in plain language</h2>
              <p>
                Think of a vector as an arrow, and a matrix as a machine that pushes arrows.
                In ordinary linear algebra the machine is fixed. In NEPv, the machine first
                looks at where the arrow points, then decides how to push it.
              </p>
            </div>
          </div>
          <div class="intro-steps">
            <article>
              <span class="step-number">1</span>
              <h3>Ordinary eigenvectors</h3>
              <p>
                If the matrix acts on an arrow and the direction stays the same while only the length changes,
                that arrow is an eigenvector. The formula is <strong>A x = λ x</strong>.
              </p>
            </article>
            <article>
              <span class="step-number">2</span>
              <h3>Where nonlinearity enters</h3>
              <p>
                Now the matrix is no longer fixed; it becomes <strong>A(x)</strong>. Change the arrow,
                and the matrix changes too. One matrix calculation is no longer the whole story.
              </p>
            </article>
            <article>
              <span class="step-number">3</span>
              <h3>What are we looking for?</h3>
              <p>
                We want an arrow that builds a matrix, then remains aligned when that matrix pushes it.
                That is self-consistency: the assumption and the result agree.
              </p>
            </article>
          </div>
        </section>

        <section class="panel text-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Chapter 02</span>
              <h2>What this page demonstrates</h2>
              <p>
                To keep the picture clear, we only study directions on a two-dimensional unit circle.
                Each direction generates a small matrix, and that matrix returns a new eigenvector direction.
                The question becomes: is there a direction that comes back to itself after the loop?
              </p>
            </div>
          </div>
          <div class="insight-grid">
            <article>
              <h3>Current result</h3>
              <p>Final angle: <strong>${formatAngle(current.angle)}</strong></p>
              <p>Self-consistent directions found: <strong>${fixedPoints.length}</strong></p>
            </article>
            <article>
              <h3>How to read the picture</h3>
              <p>
                The picture compares the current guess with the direction returned by the matrix it creates.
                When those directions line up, the guess and the computed result agree.
              </p>
            </article>
            <article>
              <h3>Do not treat this as a universal solver</h3>
              <p>
                This is a classroom-scale model for intuition. It is not a replacement for real high-dimensional
                numerical algorithms, where NEPv systems can be larger, harder, and more sensitive.
              </p>
            </article>
          </div>
        </section>

        <section id="compare" class="panel compare-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Chapter 03</span>
              <h2>Ordinary eigenvalue problem vs. NEPv</h2>
              <p>They appear to differ by one pair of parentheses, but that pair changes the task from finding a direction to finding a direction that justifies itself.</p>
            </div>
          </div>
          <div class="compare-grid">
            <article class="compare-card stable-card">
              <span class="eyebrow">Familiar linear algebra</span>
              <h3>Ordinary eigenvalue problem</h3>
              <div class="formula-chip">A x = λ x</div>
              <p>The matrix <strong>A</strong> is fixed. You only need to find which directions keep the same direction after it acts.</p>
            </article>
            <div class="compare-arrow" aria-hidden="true">→</div>
            <article class="compare-card nonlinear-card">
              <span class="eyebrow">The extra NEPv complication</span>
              <h3>Eigenvector-dependent problem</h3>
              <div class="formula-chip hot">A(x) x = λ x</div>
              <p>The matrix <strong>A(x)</strong> changes with the current vector. The vector you want also influences the matrix used to compute it.</p>
            </article>
          </div>
        </section>

        <section class="panel loop-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Chapter 04</span>
              <h2>The loop: the vector changes the matrix, then the matrix changes the vector</h2>
              <p>NEPv is easiest to approach as a loop: give a guess, build a matrix, ask the matrix for a new direction, then let that new direction update the guess.</p>
            </div>
          </div>
          <div class="loop-grid">
            <div class="loop-track" aria-label="NEPv self-consistency loop">
              <div class="loop-node">Choose an initial vector x</div>
              <div class="loop-node">Build A(x)</div>
              <div class="loop-node">Find a new direction</div>
              <div class="loop-node">Update x</div>
            </div>
            <div class="loop-copy">
              <p>
                If this loop becomes stable, we have a possible solution. If it oscillates or reacts sharply
                to the starting point, the nonlinear feedback is creating the difficulty.
              </p>
              <div class="loop-sequence">x₀ → A(x₀) → x₁ → A(x₁) → x₂ → ...</div>
            </div>
          </div>
        </section>

        <section id="lab" class="panel theory-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">General Theory</span>
              <h2>How is an NEPv usually computed step by step?</h2>
              <p>
                We are looking for a self-consistent direction: use that direction to build a matrix,
                then ask whether the eigen-direction of that matrix still matches the original direction.
                Because the matrix depends on the unknown x, it usually cannot be solved in one ordinary linear-algebra step.
              </p>
            </div>
          </div>
          <div class="theory-flow" aria-label="Generic NEPv iteration workflow">
            <article>
              <span>1</span>
              <h3>Guess a direction</h3>
              <p>Start with x₀. It is only an initial guess, not yet a solution.</p>
            </article>
            <article>
              <span>2</span>
              <h3>Use it to build a matrix</h3>
              <p>Insert xₖ into A(x), producing the actual matrix A(xₖ) for this round.</p>
            </article>
            <article>
              <span>3</span>
              <h3>Find an eigen-direction</h3>
              <p>Run an ordinary eigenvalue calculation on A(xₖ) to get a target direction vₖ.</p>
            </article>
            <article>
              <span>4</span>
              <h3>Update the guess</h3>
              <p>Move xₖ a small step toward vₖ, obtain xₖ₊₁, then repeat.</p>
            </article>
          </div>
          <div class="formula-strip">
            <span>xₖ</span>
            <span>A(xₖ)</span>
            <span>A(xₖ)vₖ = λₖvₖ</span>
            <span>θₖ₊₁ = θₖ + α(θ(vₖ) - θₖ)</span>
          </div>
        </section>

        <section class="panel toy-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Toy Model</span>
              <h2>Now put the general idea into a 2D example</h2>
              <p>
                To make the computation visible, we only use directions on the unit circle.
                The current direction is x = [cos θ, sin θ], and it generates a 2 × 2 symmetric matrix.
                That keeps every step drawable in the coordinate plane.
              </p>
            </div>
          </div>
          <div class="toy-grid">
            <article>
              <span class="symbol">x(θ)</span>
              <h3>A direction becomes two coordinates</h3>
              <p>x = [cos θ, sin θ]. Every point on the unit circle is one possible guess direction.</p>
            </article>
            <article>
              <span class="symbol">A(x)</span>
              <h3>The matrix is generated by the direction</h3>
              <p>a(x), b(x), and d(x) change with x and the slider parameters, so the matrix is not a fixed backdrop.</p>
            </article>
            <article>
              <span class="symbol">vₖ</span>
              <h3>The matrix returns a target direction</h3>
              <p>The yellow point is the eigen-direction computed from the current matrix. It tells us where the next step should lean.</p>
            </article>
            <article>
              <span class="symbol">α</span>
              <h3>Do not jump all the way</h3>
              <p>The update step α controls how far xₖ moves toward vₖ. Too large can overshoot; too small is slow.</p>
            </article>
          </div>
        </section>

        <section id="interactive-lab" class="panel experiment-panel">
          <div class="experiment-chart">
            <div class="panel-heading">
              <div>
                <span class="section-label">Interactive Lab</span>
                <h2>Lab: play the derivation and watch each calculation</h2>
                <p>The main chart draws the vectors in coordinates: cyan is the current guess xₖ, red is the matrix output A(xₖ)xₖ, yellow is the target eigen-direction vₖ, and violet is the next step xₖ₊₁.</p>
              </div>
            </div>
            <div class="status-strip" data-dynamic="status-strip">
              ${statusStripMarkup(current, fixedPoints, focusStep)}
            </div>
            <div class="chart-toolbar">
              <button type="button" class="play-button" data-action="play-trail">
                <span aria-hidden="true">▶</span>
                ${isAutoPlaying ? "Playing..." : "Play derivation"}
              </button>
              <button type="button" class="play-button secondary-play" data-action="next-step">
                Next step
              </button>
              <button type="button" class="play-button secondary-play" data-action="reset-step">
                Reset
              </button>
            </div>
            <p class="derivation-status" data-dynamic="derivation-status" aria-live="polite">
              ${derivationStatusMarkup(focusIndex, isDerivationDone)}
            </p>
            <div data-dynamic="main-iteration-chart">
              ${iterationCircleSvg(iteration, fixedPoints, focusIndex)}
            </div>
            <div data-dynamic="derivation-panel">
              ${derivationPanelMarkup(focusStep, focusIndex)}
            </div>
            <p class="chart-caption">
              Tip: when the points gather quickly, this parameter setting is easy to make self-consistent.
              When the trail bends or loops, the feedback between the matrix and the vector is stronger.
            </p>
            <div class="graph-guide">
              <article>
                <span>What to watch</span>
              <p>First watch the four arrows from the origin. Red shows how the matrix pushes xₖ, yellow shows the eigen-direction returned by the matrix, and violet shows the next step.</p>
              </article>
              <article>
                <span>Geometry</span>
              <p>The key is not random motion on a circle. The current direction xₖ builds A(xₖ), and that matrix returns the target direction vₖ.</p>
              </article>
              <article>
                <span>How to judge</span>
              <p>If cyan, yellow, and violet gradually point in the same direction, the current guess, target direction, and next step are becoming consistent.</p>
              </article>
            </div>
            <div class="coordinate-story">
              <div class="panel-heading compact">
                <div>
                  <h3>Coordinate view</h3>
                  <p>The cyan arrow is the current guess <strong>x</strong>, the red arrow is the actual matrix output <strong>A(x)x</strong>, and the yellow arrow is the eigenvector direction returned by the matrix.</p>
                </div>
              </div>
              <div data-dynamic="vector-plane">
                ${vectorPlaneSvg(current)}
              </div>
              <div class="graph-guide">
                <article>
                  <span>What to watch</span>
                  <p>Watch whether the cyan, red, and yellow arrows gradually point in similar directions.</p>
                </article>
                <article>
                  <span>Geometry</span>
                  <p>An eigenvector does not require equal length. It requires the direction after the matrix acts to remain parallel.</p>
                </article>
                <article>
                  <span>How to judge</span>
                  <p>The smaller the direction gap, the closer we are to the geometric condition <strong>A(x)x = λx</strong>.</p>
                </article>
              </div>
            </div>
          </div>
          ${controlPanelMarkup()}
        </section>

        <section class="panel chart-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Geometry Check</span>
              <h3>Error staircase</h3>
              <p>Each bar is the direction gap after one iteration. Shorter bars mean the guessed direction and the matrix-returned direction agree more closely.</p>
            </div>
          </div>
          <div data-dynamic="residual-chart">
            ${residualJourneySvg(iteration)}
          </div>
          <div class="graph-guide">
            <article>
              <span>What to watch</span>
              <p>Watch whether the bars shrink. Each height is the absolute direction gap after one iteration.</p>
            </article>
            <article>
              <span>Geometry</span>
              <p>The direction gap is the angle between the current arrow and the target direction, measured in radians.</p>
            </article>
            <article>
              <span>How to judge</span>
              <p>If the final bars are near 0, the system is almost self-consistent. If they jump up and down, the iteration is unstable.</p>
            </article>
          </div>
        </section>

        <section class="panel chart-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Basins</span>
              <h3>Starting-point map</h3>
              <p>Different starting angles may end at different self-consistent directions. Same color means the final result falls into the same class.</p>
            </div>
          </div>
          <div data-dynamic="basin-chart">
            ${basinStripSvg(state)}
          </div>
          <div class="graph-guide">
            <article>
              <span>What to watch</span>
              <p>Watch how many segments appear in the color strip. Each small cell represents one possible starting direction.</p>
            </article>
            <article>
              <span>Geometry</span>
              <p>One color means those starting points eventually fall into the same self-consistent direction, also called an attraction basin.</p>
            </article>
            <article>
              <span>How to judge</span>
              <p>More fragmented color boundaries mean stronger sensitivity to the starting point. Larger same-color regions mean wider basins.</p>
            </article>
          </div>
        </section>

        <section class="panel matrix-panel" data-dynamic="matrix-snapshot">
          ${matrixSnapshotMarkup(current)}
        </section>

        <section id="formula" class="panel formula-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Chapter 05</span>
              <h2>Unpack the formula</h2>
              <p>After the pictures, the formula becomes easier to read. Each symbol corresponds to something you just saw on the page.</p>
            </div>
          </div>
          <div class="formula-grid">
            <article>
              <span class="symbol">x</span>
              <h3>The direction we are seeking</h3>
              <p>It is the cyan arrow in the coordinate plane and the initial guess at the start of the iteration.</p>
            </article>
            <article>
              <span class="symbol">A(x)</span>
              <h3>The matrix that changes with x</h3>
              <p>When you drag a parameter or change direction, this matrix changes too, so the red arrow moves with it.</p>
            </article>
            <article>
              <span class="symbol">λ</span>
              <h3>The length-scaling factor</h3>
              <p>If the direction is already aligned, λ describes how much the arrow is stretched or shrunk.</p>
            </article>
            <article>
              <span class="symbol">A(x)x = λx</span>
              <h3>One-sentence summary</h3>
              <p>Even when the matrix is decided by x, x is still exactly an eigen-direction accepted by that matrix.</p>
            </article>
          </div>
        </section>

        <section class="panel why-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Chapter 06</span>
              <h2>Why visualize it?</h2>
              <p>The hard part of NEPv is not that the formula is long. The feedback relation can make the geometry feel unintuitive.</p>
            </div>
          </div>
          <div class="why-grid">
            <article>
              <h3>It is not ordinary linear algebra</h3>
              <p>The matrix and the solution influence each other, so the matrix cannot be treated as a fixed machine.</p>
            </article>
            <article>
              <h3>Iteration can be sensitive</h3>
              <p>Sometimes it converges quickly, sometimes it approaches slowly, and sometimes a different start gives a different path.</p>
            </article>
            <article>
              <h3>See the phenomenon before the formula</h3>
              <p>Beginners build intuition more easily by seeing arrows, trails, and direction gaps before returning to symbols.</p>
            </article>
          </div>
        </section>

        <section class="panel report-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">Report Summary</span>
              <h2>Classroom summary</h2>
              <p>This mirrors the report structure in the README, but the page first summarizes it in more direct language.</p>
            </div>
          </div>
          <div class="report-grid">
            <article>
              <span class="eyebrow">Problem</span>
              <p>We study an eigenvalue problem where the matrix depends on the unknown vector, so the answer must agree with itself.</p>
            </article>
            <article>
              <span class="eyebrow">Demonstration</span>
              <p>We sample many directions on the circle, let each direction generate a matrix, then check whether the returned direction agrees.</p>
            </article>
            <article>
              <span class="eyebrow">Phenomena to notice</span>
              <p>Watch intersections, direction gaps, and iteration trails. Some cases converge quickly; others creep slowly or respond strongly to parameters.</p>
            </article>
          </div>
        </section>

        <section class="panel source-panel">
          <div class="panel-heading">
            <div>
              <span class="section-label">References</span>
              <h2>References</h2>
              <p>
                These references provide mathematical background. The 2D model on this page is a simplified teaching version designed for intuition.
              </p>
            </div>
          </div>
          <ul class="source-list">
            ${citations
              .map((source) => {
                return `
                  <li>
                    <a href="${source.href}" target="_blank" rel="noreferrer">${source.label}</a>
                    <span>${source.note}</span>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </section>
      </main>
    </div>
  `;

  root.querySelectorAll("[data-key]").forEach((input) => {
    let pendingSliderFrame = 0;
    input.addEventListener("input", (event) => {
      stopAutoPlayback();
      const key = event.target.dataset.key;
      state = { ...state, [key]: Number(event.target.value) };
      trailPlaybackId = 0;
      derivationStep = 0;
      const valueLabel = event.target
        .closest(".slider-field")
        ?.querySelector(".slider-label strong");
      if (valueLabel) {
        valueLabel.textContent = Number(event.target.value).toFixed(2);
      }
      if (pendingSliderFrame) {
        window.cancelAnimationFrame(pendingSliderFrame);
      }
      pendingSliderFrame = window.requestAnimationFrame(() => {
        pendingSliderFrame = 0;
        refreshDynamicLab();
      });
    });
    input.addEventListener("change", () => {
      if (pendingSliderFrame) {
        window.cancelAnimationFrame(pendingSliderFrame);
        pendingSliderFrame = 0;
      }
      refreshDynamicLab();
    });
  });

  root.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", (event) => {
      stopAutoPlayback();
      const presetName = event.currentTarget.dataset.preset;
      state = { ...presets[presetName] };
      trailPlaybackId = 0;
      derivationStep = 0;
      render();
    });
  });

  root.querySelector("[data-action='play-trail']")?.addEventListener("click", () => {
    stopAutoPlayback();
    derivationStep = 0;
    trailPlaybackId += 1;
    isAutoPlaying = true;
    refreshDynamicLab();
    scheduleAutoPlayback();
  });

  root.querySelector("[data-action='next-step']")?.addEventListener("click", () => {
    stopAutoPlayback();
    derivationStep = Math.min(derivationStep + 1, iteration.length - 1);
    trailPlaybackId = 0;
    refreshDynamicLab();
  });

  root.querySelector("[data-action='reset-step']")?.addEventListener("click", () => {
    stopAutoPlayback();
    derivationStep = 0;
    trailPlaybackId = 0;
    refreshDynamicLab();
  });

  setupPageMotion();
}

render();
