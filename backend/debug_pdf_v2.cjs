const fs = require('fs');
const { PDFParse } = require('pdf-parse');
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
        
        // This is the v2 API discovered in README.md
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        await parser.destroy();

        console.log("--- START TEXT ---");
        console.log(result.text);
        console.log("--- END TEXT ---");
        
        const normalizedText = result.text.replace(/\r/g, "").replace(/\n+/g, "\n").toLowerCase();
        const lines = normalizedText.split("\n");
        console.log("LINES COUNT:", lines.length);
        lines.slice(0, 50).forEach((l, i) => console.log(`${i}: [${l}]`));
    } catch (err) {
        console.error("Error:", err);
    }
}

debugPDF();
