const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json' };
http.createServer((req, res) => {
  let f = req.url === '/' ? '/index.html' : req.url;
  f = path.join(__dirname, f);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
}).listen(3000, () => console.log('Server at http://localhost:3000'));