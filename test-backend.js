const http = require('http');

http.get('http://localhost:5001/', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  process.exit(0);
}).on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
