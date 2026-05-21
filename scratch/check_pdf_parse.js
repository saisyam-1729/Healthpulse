const pdf = require('./backend/node_modules/pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('Keys of pdf:', Object.keys(pdf));
if (pdf.default) {
  console.log('Type of pdf.default:', typeof pdf.default);
}
