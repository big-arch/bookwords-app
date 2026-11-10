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
const forestData = `data:image/png;base64,${fs.readFileSync(path.join(root, "assets", "night-forest.png")).toString("base64")}`;
const nightCss = fs.readFileSync(path.join(root, "theme-night.css"), "utf8")
  .replaceAll('url("assets/night-forest.png")', `url("${forestData}")`);
const ambience = fs.readFileSync(path.join(root, "ambience.js"), "utf8");

const portable = html
  .replace(/<script src="sync-engine\.js(?:\?v=[^"]+)?"><\/script>/, () => `<script>\n${fs.readFileSync(path.join(root, "sync-engine.js"), "utf8")}\n</script>`)
  .replace(/<link rel="stylesheet" href="styles\.css(?:\?v=[^"]+)?" \/>/, () => `<style>\n${css}\n</style>`)
  .replace(/<link rel="stylesheet" href="theme-night\.css(?:\?v=[^"]+)?" \/>/, () => `<style>\n${nightCss}\n</style>`)
  .replace(/<script src="script\.js(?:\?v=[^"]+)?"><\/script>/, () => `<script>\n${script}\n</script>`)
  .replace(/<script src="ambience\.js(?:\?v=[^"]+)?"><\/script>/, () => `<script>\n${ambience}\n</script>`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, portable, "utf8");

console.log(outPath);
