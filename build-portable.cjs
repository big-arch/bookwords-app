const fs = require("fs");
const path = require("path");

const root = __dirname;
const htmlPath = path.join(root, "index.html");
const cssPath = path.join(root, "styles.css");
const scriptPath = path.join(root, "script.js");
const outDir = path.join(root, "portable");
const outPath = path.join(outDir, "BookWords.html");

const html = fs.readFileSync(htmlPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const script = fs.readFileSync(scriptPath, "utf8");

const portable = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="script.js"></script>', `<script>\n${script}\n</script>`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, portable, "utf8");

console.log(outPath);
