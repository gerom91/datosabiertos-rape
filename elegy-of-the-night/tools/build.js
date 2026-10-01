// Builds single-file versions of the game:
//   dist/elegy-of-the-night.html  — standalone page (double-click to play offline)
//   dist/artifact.html            — body content for publishing as a claude.ai Artifact
// Usage: node tools/build.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
let js = '';
for (const s of scripts) {
  const p = path.join(ROOT, s);
  if (!fs.existsSync(p)) {
    console.warn('missing ' + s);
    continue;
  }
  js += '\n/* ---- ' + s + ' ---- */\n' + fs.readFileSync(p, 'utf8') + '\n';
}
js = js.replace(/<\/script/gi, '<\\/script');

const headStart = html.indexOf('<!--BUILD:HEAD-->');
const headEnd = html.indexOf('</head>');
const head = html.slice(headStart + '<!--BUILD:HEAD-->'.length, headEnd).trim();
const bodyStart = html.indexOf('<body>') + '<body>'.length;
const scriptsStart = html.indexOf('<!--BUILD:SCRIPTS-->');
const body = html.slice(bodyStart, scriptsStart).trim();

const title = '<title>Elegy of the Night</title>';
const inline = '<script>\n' + js + '\n</script>';

const standalone =
  '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  title + '\n' + head + '\n</head>\n<body>\n' + body + '\n' + inline + '\n</body>\n</html>\n';

// Artifact: the publisher wraps the content in its own skeleton; title + style first.
const styleMatch = head.match(/<style>[\s\S]*?<\/style>/);
const links = head.replace(/<style>[\s\S]*?<\/style>/, '').trim();
const artifact = title + '\n' + (styleMatch ? styleMatch[0] : '') + '\n' + links + '\n' + body + '\n' + inline + '\n';

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'elegy-of-the-night.html'), standalone);
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), artifact);
console.log('scripts: ' + scripts.length + ', js ' + (js.length / 1024).toFixed(0) + ' KB');
console.log('dist/elegy-of-the-night.html ' + (standalone.length / 1024).toFixed(0) + ' KB');
console.log('dist/artifact.html ' + (artifact.length / 1024).toFixed(0) + ' KB');
