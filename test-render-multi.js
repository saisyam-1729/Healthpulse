import https from 'https';

const test = (path) => {
  const url = `https://health-931r.onrender.com${path}`;
  https.get(url, (res) => {
    console.log(`GET ${url} -> STATUS: ${res.statusCode}`);
  });
};

['/', '/api', '/auth/login', '/api/login', '/signup'].forEach(test);
