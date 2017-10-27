const fs = require('fs');
const http = require('http');
const path = require('path');

const server = http.createServer((request, response) => {
  let filePath;

  if (request.url.match('WiredPanel')) {
    filePath = '../' + request.url;
  } else {
    filePath = '.' + request.url;
  }

  if (filePath == './') filePath = './index.html';

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
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

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if (error.code == 'ENOENT') {
        fs.readFile('./404.html', function(error, content) {
          response.writeHead(200, { 'Content-Type': contentType });
          response.end(content, 'utf-8');
        });
      } else {
        response.writeHead(500);
        response.end(
          'Sorry, check with the site admin for error: ' + error.code + ' ..\n'
        );
        response.end();
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(8000);
