const { PDFParse } = require('pdf-parse');
const buffer = Buffer.from('%PDF-1.4');
try {
    const parser = new PDFParse(buffer);
    console.log('Prototype property names:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
} catch (e) {
    console.log('Error:', e.message);
}
