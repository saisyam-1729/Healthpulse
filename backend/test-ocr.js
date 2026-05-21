const fs = require('fs');
const { createCanvas, ImageData } = require('canvas');
const fileBuffer = fs.readFileSync('uploads/1776592798844-Blood Report 26-08-24.pdf');
const Tesseract = require('tesseract.js');

async function test() {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    console.log("Loading PDF...");
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) }).promise;
    console.log("Getting page 1...");
    const page = await pdf.getPage(1);
    
    console.log("Getting operator list...");
    const ops = await page.getOperatorList();
    
    let imgDataObj = null;
    for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
            const name = ops.argsArray[i][0];
            imgDataObj = await page.objs.get(name);
            break; // take first image
        }
    }
    
    if (imgDataObj) {
        console.log("Image extracted!", imgDataObj.width, imgDataObj.height);
        const canvas = createCanvas(imgDataObj.width, imgDataObj.height);
        const ctx = canvas.getContext("2d");
        
        let imgData;
        if (imgDataObj.data) {
             console.log("Using raw pixel data, length:", imgDataObj.data.length);
             const clamped = new Uint8ClampedArray(imgDataObj.data);
             // Ensure it's RGBA
             if (clamped.length === imgDataObj.width * imgDataObj.height * 4) {
                 imgData = new ImageData(clamped, imgDataObj.width, imgDataObj.height);
                 ctx.putImageData(imgData, 0, 0);
             } else if (clamped.length === imgDataObj.width * imgDataObj.height * 3) {
                 // Convert RGB to RGBA
                 const rgba = new Uint8ClampedArray(imgDataObj.width * imgDataObj.height * 4);
                 for(let i = 0, j = 0; i < clamped.length; i += 3, j += 4) {
                     rgba[j] = clamped[i];
                     rgba[j+1] = clamped[i+1];
                     rgba[j+2] = clamped[i+2];
                     rgba[j+3] = 255;
                 }
                 imgData = new ImageData(rgba, imgDataObj.width, imgDataObj.height);
                 ctx.putImageData(imgData, 0, 0);
             }
        }
        
        const imageBuffer = canvas.toBuffer();
        console.log("Running OCR...");
        const ocr = await Tesseract.recognize(imageBuffer, "eng");
        console.log("[OCR SUCCESS]", ocr?.data?.text?.length, "characters");
        
        const extractedText = ocr?.data?.text || "";
        fs.writeFileSync('temp_ocr.txt', extractedText);
        
        const lines = extractedText
            .replace(/\r/g, "")
            .split('\n')
            .map(line => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
            .filter(line => line.length > 0);
            
        const extractedData = [];
        
        const nameContext = [
            { regex: /haemoglobin|hemoglobin|hb/i, name: 'Hemoglobin', cat: 'Haematology' },
            { regex: /total leucocytes|^wbc|white blood/i, name: 'WBC', cat: 'Haematology' },
            { regex: /red blood cell|rbc/i, name: 'RBC', cat: 'Haematology' },
            { regex: /pcv|packed cell volume/i, name: 'PCV', cat: 'Haematology' },
            { regex: /mcv/i, name: 'MCV', cat: 'Haematology' },
            { regex: /mch|mean corpuscular h/i, name: 'MCH', cat: 'Haematology' },
            { regex: /mchc/i, name: 'MCHC', cat: 'Haematology' },
            { regex: /platelet count/i, name: 'Platelets', cat: 'Haematology' }
        ];

        lines.forEach(line => {
            if (/age|year|month|date|time|sex|gender|\bdr\b|doctor/i.test(line)) return;

            const valueMatch = line.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)(?=\s|$|\d)/);
            if (!valueMatch) return;

            let paramName = "";
            let cat = 'General';
            const foundContext = nameContext.find(n => n.regex.test(line));
            if (foundContext) {
                paramName = foundContext.name;
                cat = foundContext.cat;
            }

            const rawVal = valueMatch[1];
            const rawUnit = valueMatch[2].toLowerCase();
            const val = parseFloat(rawVal);
            
            // Allow loose unit mapping 
            const validUnitMatch = /gm|g\/dl|mg|cmm|cumm|lakh|uiu|miu|mm|%|cells|fl|pg/i.test(rawUnit);
            if (!validUnitMatch && !paramName) return;

            let rangeStr = "";
            const rangeMatch = line.match(/([\d.]+)\s*(?:-|to|–|—)\s*([\d.]+)/) || line.match(/([<>])\s*([\d.]+)/);
            if (rangeMatch) rangeStr = rangeMatch[0];

            extractedData.push({ param: paramName, val, unit: rawUnit, range: rangeStr, line });
        });
        console.log("EXTRACTED:", extractedData);
    } else {
        console.log("No images found in PDF page 1.");
    }
  } catch (err) {
    console.error("[TEST ERROR]", err);
  }
}
test();
