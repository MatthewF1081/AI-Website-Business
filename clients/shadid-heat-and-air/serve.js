// Local preview:  node serve.js  ->  http://localhost:5175
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "site");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
      return fs.readFile(path.join(root, "404.html"), (e2, d2) => { res.writeHead(404, { "Content-Type": types[".html"] }); res.end(e2 ? "Not found" : d2); });
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(5175, () => console.log("Preview at http://localhost:5175"));
