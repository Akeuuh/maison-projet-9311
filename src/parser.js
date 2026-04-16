const markdownIt = require("markdown-it");
const taskLists = require("markdown-it-task-lists");

function parseMarkdown(content, fileMap = {}) {
  const md = markdownIt({ html: true, linkify: true }).use(taskLists);

  const transformed = content.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (match, text, href) => `[${text}](${transformLink(href, fileMap)})`,
  );

  return md.render(transformed);
}

function transformLink(href, fileMap) {
  const hashIdx = href.indexOf("#");
  const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";

  if (!base.endsWith(".md")) return href;

  const filename = base.split("/").pop();

  if (fileMap[filename]) {
    return fileMap[filename] + hash;
  }

  return base.replace(/\.md$/, ".html") + hash;
}

module.exports = { parseMarkdown, transformLink };
