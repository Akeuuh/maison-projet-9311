const NAV_LINKS = [
  { href: "dashboard.html", label: "Dashboard" },
  { href: "financement.html", label: "Financement" },
  { href: "projet.html", label: "Projet" },
  { href: "maison-chilly.html", label: "Maison" },
  { href: "appart-clichy.html", label: "Appart" },
];

function buildNav(activePage = "", prefix = "") {
  return NAV_LINKS.map(
    (l) =>
      `<a href="${prefix}${l.href}"${l.href === activePage ? ' class="active"' : ""}>${l.label}</a>`,
  ).join("");
}

module.exports = { NAV_LINKS, buildNav };
