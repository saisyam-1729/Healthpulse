import * as fs from 'fs';

const langs = ['en', 'hi', 'te', 'kn', 'ta'];
const additions = {
  en: { select: 'Select', step: 'Step', of: 'of' },
  hi: { select: 'चुनें', step: 'चरण', of: 'में से' },
  te: { select: 'ఎంచుకోండి', step: 'దశ', of: 'లో' },
  kn: { select: 'ಆಯ್ಕೆಮಾಡಿ', step: 'ಹಂತ', of: 'ರಲ್ಲಿ' },
  ta: { select: 'தேர்ந்தெடு', step: 'படி', of: 'இல்' },
};

for (const lang of langs) {
  const file = `./src/locales/${lang}.json`;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!j.common) j.common = {};
  j.common.select = additions[lang].select;
  j.common.step = additions[lang].step;
  j.common.of = additions[lang].of;
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
}

let ob = fs.readFileSync('./src/pages/Onboarding.tsx', 'utf8');
ob = ob.replace(/placeholder="Select"/g, 'placeholder={t("common.select")}');
ob = ob.replace(/<span>Step {step \+ 1} of {totalSteps}<\/span>/g, '<span>{t("common.step")} {step + 1} {t("common.of")} {totalSteps}</span>');

// Verify translation string has not been missed
ob = ob.replace(/Tell us about yourself/g, '{t("onboarding.subtitle0")}');
fs.writeFileSync('./src/pages/Onboarding.tsx', ob);
console.log('Done mapping select and step');
