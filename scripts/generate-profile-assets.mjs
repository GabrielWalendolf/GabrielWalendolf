// Gera SVGs animados para o README do perfil:
//  - contrib-wave-dark.svg / contrib-wave-light.svg  (grade de contribuições carregando em onda diagonal)
//  - activity-graph-dark.svg / activity-graph-light.svg (atividade dos últimos 31 dias, linha se desenhando)
// Sem dependências: roda com Node 20+ (fetch nativo).

import { mkdirSync, writeFileSync } from "node:fs";

const USER = process.env.GH_USER || "GabrielWalendolf";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.OUT_DIR || "dist";

const THEMES = {
  dark: {
    bg: "#0d1117",
    text: "#c9d1d9",
    muted: "#8b949e",
    grid: "#21262d",
    levels: ["#161b22", "#2e1065", "#5b21b6", "#7c3aed", "#a78bfa"],
    line: "#7c3aed",
    point: "#a78bfa",
    title: "#a78bfa",
  },
  light: {
    bg: "#ffffff",
    text: "#24292f",
    muted: "#57606a",
    grid: "#eaeef2",
    levels: ["#ebedf0", "#ddd6fe", "#a78bfa", "#7c3aed", "#4c1d95"],
    line: "#7c3aed",
    point: "#5b21b6",
    title: "#6d28d9",
  },
};

const LEVEL_INDEX = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------- dados

async function fetchCalendar() {
  if (process.env.MOCK) return mockCalendar();
  if (!TOKEN) throw new Error("GITHUB_TOKEN não definido");
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel weekday } }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar;
}

function mockCalendar() {
  const weeks = [];
  const start = new Date();
  start.setDate(start.getDate() - 364 - start.getDay());
  let total = 0;
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > new Date()) break;
      const r = Math.random();
      const count = r < 0.55 ? 0 : Math.floor(r * 12);
      total += count;
      const level = count === 0 ? "NONE" : count < 4 ? "FIRST_QUARTILE" : count < 7 ? "SECOND_QUARTILE" : count < 10 ? "THIRD_QUARTILE" : "FOURTH_QUARTILE";
      days.push({ date: date.toISOString().slice(0, 10), contributionCount: count, contributionLevel: level, weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  return { totalContributions: total, weeks };
}

// ---------------------------------------------------------------- onda diagonal

function waveSvg(cal, t) {
  const CELL = 11, GAP = 3, STEP = CELL + GAP;
  const LEFT = 34, TOP = 42;
  const cols = cal.weeks.length;
  const width = LEFT + cols * STEP + 16;
  const height = TOP + 7 * STEP + 34;

  const CYCLE = 9;      // duração total do loop (s)
  const DIAG = 0.045;   // atraso entre diagonais (s)

  let cells = "";
  let monthLabels = "";
  let lastMonth = -1;

  cal.weeks.forEach((week, x) => {
    const first = week.contributionDays[0];
    if (first) {
      const m = new Date(first.date + "T00:00:00").getMonth();
      if (m !== lastMonth && x < cols - 2) {
        monthLabels += `<text x="${LEFT + x * STEP}" y="${TOP - 10}" class="lbl">${MONTHS[m]}</text>`;
        lastMonth = m;
      }
    }
    for (const day of week.contributionDays) {
      const y = day.weekday;
      const lvl = LEVEL_INDEX[day.contributionLevel] ?? 0;
      const delay = ((x + y) * DIAG).toFixed(3);
      cells += `<rect x="${LEFT + x * STEP}" y="${TOP + y * STEP}" width="${CELL}" height="${CELL}" rx="2.5" fill="${t.levels[lvl]}" style="animation-delay:${delay}s"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`;
    }
  });

  const dayLabels = [["Mon", 1], ["Wed", 3], ["Fri", 5]]
    .map(([n, i]) => `<text x="${LEFT - 8}" y="${TOP + i * STEP + 9}" text-anchor="end" class="lbl">${n}</text>`)
    .join("");

  const legendX = width - 16 - 5 * STEP - 70;
  const legend =
    `<text x="${legendX}" y="${height - 12}" class="lbl">Less</text>` +
    t.levels.map((c, i) => `<rect x="${legendX + 30 + i * STEP}" y="${height - 21}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`).join("") +
    `<text x="${legendX + 30 + 5 * STEP + 4}" y="${height - 12}" class="lbl">More</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
  .lbl { font: 10px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${t.muted}; }
  .ttl { font: 600 14px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${t.text}; }
  .ttl tspan { fill: ${t.title}; }
  .g rect {
    transform-box: fill-box;
    transform-origin: center;
    animation: wave ${CYCLE}s cubic-bezier(.3,.7,.4,1) infinite both;
  }
  @keyframes wave {
    0%   { opacity: 0; transform: scale(.2) rotate(-45deg); }
    7%   { opacity: 1; transform: scale(1.25) rotate(0deg); }
    11%  { opacity: 1; transform: scale(1); }
    68%  { opacity: 1; transform: scale(1); }
    76%  { opacity: 0; transform: scale(.2) rotate(45deg); }
    100% { opacity: 0; transform: scale(.2) rotate(45deg); }
  }
  @media (prefers-reduced-motion: reduce) { .g rect { animation: none; } }
</style>
<rect width="100%" height="100%" rx="10" fill="${t.bg}"/>
<text x="${LEFT}" y="20" class="ttl"><tspan>${cal.totalContributions.toLocaleString("en-US")}</tspan> contributions in the last year</text>
${monthLabels}${dayLabels}
<g class="g">${cells}</g>
${legend}
</svg>`;
}

// ---------------------------------------------------------------- gráfico de atividade

function activitySvg(cal, t) {
  const days = cal.weeks.flatMap((w) => w.contributionDays).slice(-31);
  const W = 900, H = 320;
  const PAD = { l: 50, r: 24, t: 56, b: 44 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const max = Math.max(4, ...days.map((d) => d.contributionCount));
  const niceMax = Math.ceil(max / 4) * 4;

  const pts = days.map((d, i) => [
    PAD.l + (i / (days.length - 1)) * iw,
    PAD.t + ih - (d.contributionCount / niceMax) * ih,
  ]);

  // curva suave (Catmull-Rom -> Bézier)
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    // evita que a curva desça abaixo do zero
    c1[1] = Math.min(c1[1], PAD.t + ih); c2[1] = Math.min(c2[1], PAD.t + ih);
    line += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${line} L${pts.at(-1)[0].toFixed(1)},${PAD.t + ih} L${pts[0][0].toFixed(1)},${PAD.t + ih} Z`;

  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const y = PAD.t + (ih / 4) * i;
    grid += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" stroke="${t.grid}" stroke-dasharray="3 4"/>`;
    grid += `<text x="${PAD.l - 12}" y="${y + 4}" text-anchor="end" class="lbl">${Math.round(niceMax - (niceMax / 4) * i)}</text>`;
  }
  const xLabels = days
    .map((d, i) => `<text x="${pts[i][0]}" y="${H - PAD.b + 20}" text-anchor="middle" class="lbl">${Number(d.date.slice(8))}</text>`)
    .join("");
  const dots = pts
    .map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" class="dot" style="animation-delay:${(0.3 + (i / pts.length) * 1.8).toFixed(2)}s"><title>${days[i].date}: ${days[i].contributionCount}</title></circle>`)
    .join("");
  const total31 = days.reduce((s, d) => s + d.contributionCount, 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${t.line}" stop-opacity=".45"/>
    <stop offset="100%" stop-color="${t.line}" stop-opacity="0"/>
  </linearGradient>
</defs>
<style>
  .lbl { font: 11px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${t.muted}; }
  .ttl { font: 600 17px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${t.title}; }
  .sub { font: 12px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: ${t.muted}; }
  .ln  { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 2.2s ease-out .2s forwards; }
  .ar  { opacity: 0; animation: fade 1s ease-out 1.6s forwards; }
  .dot { fill: ${t.bg}; stroke: ${t.point}; stroke-width: 2.5; opacity: 0;
         transform-box: fill-box; transform-origin: center; animation: pop .4s ease-out forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fade { to { opacity: 1; } }
  @keyframes pop  { 0% { opacity: 0; transform: scale(0); } 70% { opacity: 1; transform: scale(1.5); } 100% { opacity: 1; transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .ln, .ar, .dot { animation: none; opacity: 1; stroke-dashoffset: 0; } }
</style>
<rect width="100%" height="100%" rx="10" fill="${t.bg}"/>
<text x="${PAD.l}" y="30" class="ttl">Contribution activity</text>
<text x="${W - PAD.r}" y="30" text-anchor="end" class="sub">${total31} contributions in the last 31 days</text>
${grid}
<path d="${area}" fill="url(#fill)" class="ar"/>
<path d="${line}" fill="none" stroke="${t.line}" stroke-width="3" stroke-linecap="round" pathLength="1" class="ln"/>
${dots}
${xLabels}
<text x="${W / 2}" y="${H - 6}" text-anchor="middle" class="lbl">Days</text>
</svg>`;
}

// ---------------------------------------------------------------- main

const cal = await fetchCalendar();
mkdirSync(OUT, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(`${OUT}/contrib-wave-${name}.svg`, waveSvg(cal, theme));
  writeFileSync(`${OUT}/activity-graph-${name}.svg`, activitySvg(cal, theme));
}
console.log(`OK: ${cal.totalContributions} contributions, arquivos gerados em ${OUT}/`);
