/**
 * Production-Grade Medical OCR Parsing and Clinical Mapping Engine
 */

const { MEDICAL_DICTIONARY } = require('./medicalMetadata');

class MedicalParser {
  constructor() {
    this.dictionary = MEDICAL_DICTIONARY;
  }

  /**
   * Main entry point for the 11-step pipeline.
   * @param {string} text - Raw extracted text from OCR/PDF.
   */
  process(text) {
    if (!text) return [];

    // STEP 9 — OCR ERROR CORRECTION
    let cleanedText = text
      .replace(/gm\/d1/g, "gm/dl")
      .replace(/ce11s/g, "cells")
      .replace(/1akh/gi, "lakh")
      .replace(/m1\/cmm/gi, "mil/cmm")
      .replace(/0\s?%\s/g, "0% ") // Fix spacing in percentages
      .replace(/\r/g, "");

    // STEP 1 — INPUT UNDERSTANDING (Treat as continuous stream)
    const lines = cleanedText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const results = [];

    // STEP 2 — PARAMETER-FIRST DETECTION
    this.dictionary.forEach(param => {
      const occurrences = [];
      lines.forEach((line, index) => {
        if (param.synonyms.some(regex => regex.test(line))) {
          occurrences.push(index);
        }
      });

      if (occurrences.length > 0) {
        console.log(`[DEBUG] Detected ${param.name} at lines: ${occurrences.join(', ')}`);
      }

      const candidates = [];
      occurrences.forEach(lineIdx => {
        // STEP 3 — CONTEXT WINDOW [i-2 ... i+4]
        const window = [];
        for (let i = lineIdx - 2; i <= lineIdx + 4; i++) {
          if (lines[i]) {
            // STEP 1 — LOGICAL ROW RECONSTRUCTION
            const columns = lines[i].split(/\s{2,}|\t/).map(c => c.trim()).filter(c => c.length > 0);
            window.push({ text: lines[i], columns, distance: i - lineIdx });
          }
        }

        const extracted = this.extractCandidates(window, param);
        if (extracted.length > 0) {
          console.log(`  [DEBUG] Found ${extracted.length} candidates for ${param.name}`);
        }
        candidates.push(...extracted);
      });


      if (candidates.length > 0) {
        // STEP 5 — COLUMN-AWARE LOGIC & STEP 4 — FILTERING
        const bestCandidate = this.scoreCandidates(candidates, param);

        // STEP 11 — NO GUESSING POLICY
        if (bestCandidate && this.isValid(bestCandidate, param)) {
          // STEP 8 — STATUS CALCULATION
          const status = this.calculateStatus(bestCandidate.normalizedValue, bestCandidate.min, bestCandidate.max);

          results.push({
            category: param.category,
            parameter_name: param.name,
            value: bestCandidate.value,
            unit: bestCandidate.unit,
            reference_range: bestCandidate.rangeStr || "unknown",
            min: bestCandidate.min,
            max: bestCandidate.max,
            status: status
          });
        }
      }
    });

    return results;
  }

  /**
   * Normalizes value based on unit (e.g., lakhs -> absolute)
   */
  normalizeValue(value, unit) {
    let normalized = value;
    if (unit.includes('lakh')) {
      normalized = value * 100000;
    }
    return normalized;
  }

  /**
   * Extracts candidates with column-aware logic.
   */
  extractCandidates(window, param) {
    const candidates = [];

    window.forEach(item => {

      const valueRegex = /\b(\d+\.\d+|\d+)\b/g;
      const range = this.parseRangeFromLine(item.text);

      let match;
      while ((match = valueRegex.exec(item.text)) !== null) {
        const val = parseFloat(match[1]);
        if (range.min === val || range.max === val) continue;

        const unitPart = item.text.slice(match.index + match[0].length).trim().split(/\s+/)[0].toLowerCase();
        const isUnitMatch = param.validUnits.some(u =>
          unitPart.includes(u.toLowerCase()) || u.toLowerCase().includes(unitPart)
        );

        if (isUnitMatch) {
          const normalizedValue = this.normalizeValue(val, unitPart);
          candidates.push({
            value: val,
            normalizedValue,
            unit: unitPart,
            min: range.min !== null ? this.normalizeValue(range.min, unitPart) : null,
            max: range.max !== null ? this.normalizeValue(range.max, unitPart) : null,
            rangeStr: range.str,
            distance: item.distance,
            originalLine: item.text,
            isBeforeRange: range.original ? item.text.indexOf(match[1]) < item.text.indexOf(range.original) : true
          });
        }
      }
    });

    return candidates;
  }

  /**
   * Scores candidates with Step 4 & 5 rules.
   */
  scoreCandidates(candidates, param) {
    let topCandidate = null;
    let topScore = -1;

    candidates.forEach(c => {
      let score = 0;
      score += 100; // Unit Match Base

      // STEP 5 — SAME-LINE PRIORITY
      if (c.distance === 0) {
        score += 500;
      } else if (c.distance > 0 && c.distance <= 2) {
        score += 100;
      } else if (c.distance === -1) {
        score += 50;
      } else {
        score -= 200;
      }

      // STEP 7 & 8 — COLUMN-AWARE & RANGE FILTERING
      if (c.rangeStr && !c.isBeforeRange) {
        score -= 1000;
      } else if (c.isBeforeRange) {
        score += 100;
      }

      const withinHumanRange = c.normalizedValue >= param.humanRange.min && c.normalizedValue <= param.humanRange.max;
      if (withinHumanRange) {
        score += 50;
      } else {
        score -= 2000;
      }

      if (score > topScore) {
        topScore = score;
        topCandidate = c;
      }
    });

    return topScore > 300 ? topCandidate : null;
  }







  /**
   * Validates if a candidate is truly a match for the parameter.
   */
  isValid(candidate, param) {
    // STEP 6 — STRICT UNIT VALIDATION
    const isUnitMatch = param.validUnits.some(u =>
      candidate.unit.includes(u.toLowerCase()) || u.toLowerCase().includes(candidate.unit)
    );

    if (!isUnitMatch) return false;

    // Reject if completely outside human possibility (Using normalized value)
    if (candidate.normalizedValue < param.humanRange.min || candidate.normalizedValue > param.humanRange.max) return false;

    return true;
  }

  /**
   * Normalizes range strings into min/max values.
   */
  parseRangeFromLine(line) {
    // X-Y
    const dashMatch = line.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
    if (dashMatch) {
      const min = parseFloat(dashMatch[1]);
      const max = parseFloat(dashMatch[2]);
      return { min, max, str: `${min}-${max}`, original: dashMatch[0] };
    }

    // < X or > Y
    const gtLtMatch = line.match(/([<>])\s*([\d.]+)/);
    if (gtLtMatch) {
      const op = gtLtMatch[1];
      const val = parseFloat(gtLtMatch[2]);
      if (op === '<') return { min: null, max: val, str: `<${val}`, original: gtLtMatch[0] };
      if (op === '>') return { min: val, max: null, str: `>${val}`, original: gtLtMatch[0] };
    }

    return { min: null, max: null, str: null, original: null };
  }


  /**
   * Determines clinical status.
   */
  calculateStatus(value, min, max) {
    if (min !== null && max !== null) {
      if (value < min) return "low";
      if (value > max) return "high";
      return "normal";
    }
    if (min !== null && value < min) return "low";
    if (max !== null && value > max) return "high";

    // If no range found in document, we COULD use default range from dictionary
    // But Step 8 implies we use the extracted min/max.
    // If both are null, we return "normal" or "unknown".
    // Let's use "normal" as default if it's within human range but no specific range found.
    return "normal";
  }
}

module.exports = new MedicalParser();
