import https from 'https';

const url = 'https://health-931r.onrender.com/api/auth/login';

https.get(url, (res) => {
  console.log(`GET ${url}`);
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => process.stdout.write(d));
}).on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});
