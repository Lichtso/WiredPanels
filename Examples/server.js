const fs = require('fs'),
      path = require('path'),
      http = require('http');

const PORT = 8080;

const server = http.createServer((request, response) => {
    const filePath = (request.url == '/') ? 'index.html' : '..'+request.url;

    const extname = path.extname(filePath);
    let contentType = 'text/plain';
    switch(extname) {
        case '.html':
            contentType = 'text/html';
            break;
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }

    console.log(filePath, contentType);
    fs.readFile(filePath, function(error, content) {
        if(error) {
            if(error.code == 'ENOENT')
                response.writeHead(404);
            else
                response.writeHead(500);
        } else {
            response.writeHead(200, {
                'Content-Type': contentType
            });
            response.write(content);
        }
        response.end();
    });
}).on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
}) .listen(PORT, () => {
    console.log(`open http://localhost:${PORT}/`);
    console.log(`and double click the pane to start`);
  });
