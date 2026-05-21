const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

const filePath = path.join(__dirname, '../backend/uploads/1776364946456-Blood Report (1).pdf');

async function debugPDF() {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        console.log("--- START TEXT ---");
        console.log(data.text);
        console.log("--- END TEXT ---");
        
        const normalizedText = data.text.replace(/\r/g, "").replace(/\n+/g, "\n").toLowerCase();
        const lines = normalizedText.split("\n");
        console.log("LINES COUNT:", lines.length);
        lines.slice(0, 50).forEach((l, i) => console.log(`${i}: [${l}]`));
    } catch (err) {
        console.error("Error:", err);
    }
}

debugPDF();
