#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const { parseMarkdown } = require("./src/parser");
const { buildNav } = require("./src/nav");

console.log("Build started...");

const distDir = config.OUTPUT_DIR;
const annoncesDir = path.join(distDir, "annonces");

fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(annoncesDir, { recursive: true });

const template = fs.readFileSync(
  path.join(__dirname, "templates", "base.html"),
  "utf-8",
);

const fileMap = {};
for (const f of config.SITUATION_FILES) {
  fileMap[f.src] = f.out;
}

const authScript = `if(!sessionStorage.getItem("auth")){window.location.href="../index.html";}`;
const timestamp = new Date().toLocaleDateString("fr-FR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

for (const file of config.SITUATION_FILES) {
  const srcPath = path.join(config.SOURCE_DIR, file.src);

  if (!fs.existsSync(srcPath)) {
    console.warn(`Skipping ${file.src}: file not found`);
    continue;
  }

  const mdContent = fs.readFileSync(srcPath, "utf-8");
  const htmlContent = parseMarkdown(mdContent, fileMap);
  const nav = buildNav(file.out);

  const page = template
    .replace("{{TITLE}}", file.title)
    .replace("{{NAV}}", nav)
    .replace("{{CONTENT}}", htmlContent)
    .replace("{{TIMESTAMP}}", timestamp)
    .replace("{{AUTH_SCRIPT}}", authScript);

  fs.writeFileSync(path.join(distDir, file.out), page, "utf-8");
  console.log(`  Generated: ${file.out}`);
}

const cssSrc = path.join(__dirname, "templates", "style.css");
if (fs.existsSync(cssSrc)) {
  fs.copyFileSync(cssSrc, path.join(distDir, "style.css"));
  console.log("  Copied: style.css");
}

// Generate login page (index.html)
const loginTemplatePath = path.join(__dirname, "templates", "login.html");
if (fs.existsSync(loginTemplatePath)) {
  const loginTemplate = fs.readFileSync(loginTemplatePath, "utf-8");

  // Compute SHA-256 hash of password
  const passwordInput = config.PASSWORD_HASH;
  const passwordHash = crypto
    .createHash("sha256")
    .update(passwordInput)
    .digest("hex");

  const loginPage = loginTemplate.replace("{{PASSWORD_HASH}}", passwordHash);
  fs.writeFileSync(path.join(distDir, "index.html"), loginPage, "utf-8");
  console.log("  Generated: index.html");
} else {
  console.warn("Login template not found, skipping index.html");
}

function parseAnnonceDir(dirName) {
  const annoncesRoot = path.join(config.SOURCE_DIR, config.ANNONCES_DIR);
  const dirPath = path.join(annoncesRoot, dirName);

  const dateMatch = dirName.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dateIso = null;
  let dateFormatted = "";
  if (dateMatch) {
    dateIso = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const d = new Date(`${dateIso}T12:00:00`);
    dateFormatted = d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const fichePath = path.join(dirPath, "fiche-bien.md");
  if (!fs.existsSync(fichePath)) {
    console.warn(`  [dashboard] Missing fiche-bien.md in ${dirName}, skipping`);
    return null;
  }
  const fiche = fs.readFileSync(fichePath, "utf-8");

  const titleMatch = fiche.match(/^#\s+(.+)$/m);
  const titre = titleMatch
    ? titleMatch[1].replace(/^🏠\s*/, "").trim()
    : dirName;

  // matches markdown table row: | Prix affiché (FAI) | … | 499 000 € |
  const prixMatch = fiche.match(
    /Prix\s+affiché\s*\(FAI\)[^\n]*\|\s*([\d\s]+[€])/i,
  );
  const prix = prixMatch ? prixMatch[1].trim() : "—";

  const surfaceMatch = fiche.match(/Surface\s+Carrez[^\n]*\|\s*(\d+\s*m²)/i);
  const surface = surfaceMatch ? surfaceMatch[1].trim() : "—";

  // matches | DPE | **D** — … | — extracts bold letter A-G
  const dpeMatch = fiche.match(/\|\s*DPE\s*\|[^|]*\*\*([A-G])\*\*/i);
  const dpe = dpeMatch ? dpeMatch[1] : "—";

  const strateqiePath = path.join(dirPath, "strategie.md");
  let verdictLabel = "NEUTRE";
  let verdictClass = "badge-neutre";
  if (!fs.existsSync(strateqiePath)) {
    console.warn(`  [dashboard] Missing strategie.md in ${dirName}`);
  } else {
    const strat = fs.readFileSync(strateqiePath, "utf-8");
    // lazy-match from ## Verdict to next section or EOF
    const verdictSection = strat.match(/##\s+Verdict[\s\S]*?(?=\n##\s|\s*$)/i);
    if (verdictSection) {
      const vtext = verdictSection[0];
      if (/PASS\s*❌/i.test(vtext)) {
        verdictLabel = "PASS";
        verdictClass = "badge-pass";
      } else if (/\bGO\b.*✅/i.test(vtext) && !/NEUTRE/i.test(vtext)) {
        verdictLabel = "GO";
        verdictClass = "badge-go";
      } else if (/NEUTRE/i.test(vtext)) {
        verdictLabel = "NEUTRE";
        verdictClass = "badge-neutre";
      } else if (/\bGO\b/i.test(vtext)) {
        verdictLabel = "GO";
        verdictClass = "badge-go";
      }
    }
  }

  const annonceHref = `annonces/${dirName}.html`;

  return {
    dirName,
    dateIso,
    dateFormatted,
    titre,
    prix,
    surface,
    dpe,
    verdictLabel,
    verdictClass,
    annonceHref,
  };
}

const annoncesRoot = path.join(config.SOURCE_DIR, config.ANNONCES_DIR);
let annonces = [];
if (fs.existsSync(annoncesRoot)) {
  const dirs = fs.readdirSync(annoncesRoot).filter((d) => {
    return (
      fs.statSync(path.join(annoncesRoot, d)).isDirectory() &&
      /^\d{4}-\d{2}-\d{2}_/.test(d)
    );
  });
  for (const d of dirs) {
    const parsed = parseAnnonceDir(d);
    if (parsed) annonces.push(parsed);
  }
  annonces.sort((a, b) => (b.dateIso || "").localeCompare(a.dateIso || ""));
}

let budgetCible = "—";
let apport = "—";
let mensualite = "—";
const projetPath = path.join(config.SOURCE_DIR, "PROJET.md");
if (fs.existsSync(projetPath)) {
  const projetMd = fs.readFileSync(projetPath, "utf-8");
  const budgetMatch = projetMd.match(/autour de\s+\*\*([\d\s–€]+)\*\*/i);
  if (budgetMatch) budgetCible = budgetMatch[1].trim();
  const apportMatch = projetMd.match(/[Aa]pport\s+estimé\s*:\s*([\d\s–€]+)/);
  if (apportMatch) apport = apportMatch[1].trim();
  const mensMatch = projetMd.match(
    /[Mm]ensualité\s+cible\s*:\s*(~?[\d\s–€\/mois]+)/,
  );
  if (mensMatch) mensualite = mensMatch[1].trim();
}

const budgetHtml = `
<section class="budget-summary">
  <h2>💰 Budget</h2>
  <div class="budget-grid">
    <div class="budget-item"><span class="budget-label">Budget cible</span><span class="budget-value">${budgetCible}</span></div>
    <div class="budget-item"><span class="budget-label">Apport estimé</span><span class="budget-value">${apport}</span></div>
    <div class="budget-item"><span class="budget-label">Mensualité cible</span><span class="budget-value">${mensualite}</span></div>
  </div>
</section>`;

let annoncesHtml;
if (annonces.length === 0) {
  annoncesHtml = `<p class="empty-state">Aucune annonce analysée.</p>`;
} else {
  annoncesHtml = annonces
    .map(
      (a) => `
<div class="annonce-card">
  <div class="annonce-card-header">
    <h3 class="annonce-titre"><a href="${a.annonceHref}">${a.titre}</a></h3>
    <span class="badge ${a.verdictClass}">${a.verdictLabel}</span>
  </div>
  <div class="annonce-meta">
    <span>💶 ${a.prix}</span>
    <span>📐 ${a.surface}</span>
    <span>🌡️ DPE ${a.dpe}</span>
    <span>📅 ${a.dateFormatted}</span>
  </div>
</div>`,
    )
    .join("\n");
}

const dashboardContent = `
<h1>🏠 Dashboard — Annonces</h1>
${budgetHtml}
<section class="annonces-list">
  <h2>📋 Annonces analysées (${annonces.length})</h2>
  ${annoncesHtml}
</section>`;

const dashboardAuthScript = `if(!sessionStorage.getItem("auth")){window.location.href="index.html";}`;
const dashboardNav = buildNav("dashboard.html");
const dashboardPage = template
  .replace("{{TITLE}}", "Dashboard")
  .replace("{{NAV}}", dashboardNav)
  .replace("{{CONTENT}}", dashboardContent)
  .replace("{{TIMESTAMP}}", timestamp)
  .replace("{{AUTH_SCRIPT}}", dashboardAuthScript);

fs.writeFileSync(path.join(distDir, "dashboard.html"), dashboardPage, "utf-8");
console.log("  Generated: dashboard.html");

const annonceFileMap = {
  "financement.md": "../financement.html",
  "PROJET.md": "../projet.html",
  "presentation_maison_chilly.md": "../maison-chilly.html",
  "presentation_appartement_clichy.md": "../appart-clichy.html",
};

const annonceTemplate = template.replace(
  'href="style.css"',
  'href="../style.css"',
);
const annonceAuthScript = `if(!sessionStorage.getItem("auth")){window.location.href="../index.html";}`;

for (const annonce of annonces) {
  const annonceDirPath = path.join(annoncesRoot, annonce.dirName);
  const fichePath = path.join(annonceDirPath, "fiche-bien.md");
  const strateqiePath = path.join(annonceDirPath, "strategie.md");
  const questionsPath = path.join(annonceDirPath, "questions-visite.md");

  const ficheHtml = parseMarkdown(
    fs.readFileSync(fichePath, "utf-8"),
    annonceFileMap,
  );
  const stratHtml = fs.existsSync(strateqiePath)
    ? parseMarkdown(fs.readFileSync(strateqiePath, "utf-8"), annonceFileMap)
    : "<p>Non disponible</p>";
  const questHtml = fs.existsSync(questionsPath)
    ? parseMarkdown(fs.readFileSync(questionsPath, "utf-8"), annonceFileMap)
    : "<p>Non disponible</p>";

  const annonceContent = `
<div class="annonce-back"><a href="../dashboard.html">← Dashboard</a></div>
<div class="annonce-header">
  <h1>${annonce.titre}</h1>
  <span class="badge ${annonce.verdictClass}">${annonce.verdictLabel}</span>
</div>
<div class="tabs">
  <input type="radio" name="tabs" id="tab-fiche" checked>
  <input type="radio" name="tabs" id="tab-strat">
  <input type="radio" name="tabs" id="tab-quest">
  <div class="tab-labels">
    <label for="tab-fiche">Fiche du bien</label>
    <label for="tab-strat">Stratégie</label>
    <label for="tab-quest">Questions de visite</label>
  </div>
  <div class="tab-panels">
    <div class="tab-panel" id="panel-fiche">${ficheHtml}</div>
    <div class="tab-panel" id="panel-strat">${stratHtml}</div>
    <div class="tab-panel" id="panel-quest">${questHtml}</div>
  </div>
</div>`;

  const annoncePage = annonceTemplate
    .replace("{{TITLE}}", annonce.titre)
    .replace("{{NAV}}", buildNav("annonce", "../"))
    .replace("{{CONTENT}}", annonceContent)
    .replace("{{TIMESTAMP}}", timestamp)
    .replace("{{AUTH_SCRIPT}}", annonceAuthScript);

  fs.writeFileSync(
    path.join(annoncesDir, `${annonce.dirName}.html`),
    annoncePage,
    "utf-8",
  );
  console.log(`  Generated: annonces/${annonce.dirName}.html`);
}

const robotsTxt = path.join(distDir, "robots.txt");
if (!fs.existsSync(robotsTxt)) {
  fs.writeFileSync(robotsTxt, "User-agent: *\nDisallow: /\n", "utf-8");
  console.log("  Generated: robots.txt");
}

const notFoundPage = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Page introuvable — Projet Maison</title>
    <meta http-equiv="refresh" content="2;url=index.html" />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <div style="max-width:768px;margin:60px auto;padding:0 16px;text-align:center">
      <h1>Page introuvable</h1>
      <p>Redirection vers le tableau de bord dans 2 secondes…</p>
      <p><a href="index.html">Cliquez ici si la redirection ne fonctionne pas</a></p>
    </div>
  </body>
</html>`;
fs.writeFileSync(path.join(distDir, "404.html"), notFoundPage, "utf-8");
console.log("  Generated: 404.html");

console.log("Build complete.");
process.exit(0);
