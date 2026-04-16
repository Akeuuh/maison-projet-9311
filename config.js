const path = require("path");

module.exports = {
  SOURCE_DIR: path.join(__dirname, ".."),
  OUTPUT_DIR: path.join(__dirname, "dist"),
  PASSWORD_HASH: process.env.SITE_PASSWORD_HASH || "maison2026",
  SITUATION_FILES: [
    { src: "financement.md", out: "financement.html", title: "Financement" },
    { src: "PROJET.md", out: "projet.html", title: "Projet" },
    {
      src: "presentation_maison_chilly.md",
      out: "maison-chilly.html",
      title: "Maison Chilly",
    },
    {
      src: "presentation_appartement_clichy.md",
      out: "appart-clichy.html",
      title: "Appart Clichy",
    },
  ],
  ANNONCES_DIR: "ANNONCES",
};
