const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

const filePath = path.join(__dirname, 'uploads/1776364946456-Blood Report (1).pdf');

async function debugPDF() {
    try {
        console.log("Checking file:", filePath);
        if (!fs.existsSync(filePath)) {
            console.error("File does not exist!");
            return;
        }
        const dataBuffer = fs.readFileSync(filePath);
        const parsePDF = (typeof pdfParse === 'function') ? pdfParse : (pdfParse.default || pdfParse.PDFParse || pdfParse);
        const data = await parsePDF(dataBuffer);
        console.log("--- START TEXT ---");
        console.log(data.text);
        console.log("--- END TEXT ---");
        
        const normalizedText = data.text.replace(/\r/g, "").replace(/\n+/g, "\n").toLowerCase();
        const lines = normalizedText.split("\n");
        console.log("LINES COUNT:", lines.length);
        lines.slice(0, 100).forEach((l, i) => console.log(`${i}: [${l}]`));
    } catch (err) {
        console.error("Error:", err);
    }
}

debugPDF();
