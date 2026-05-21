const { analyzeReport } = require('./services/informaticsService');

const extractedData = [
  {
    test_name: 'Hemoglobin',
    value: 14,
    unit: 'g/dL',
    range: '12-17.5',
    category: 'Haematology'
  },
  {
    test_name: 'WBC',
    value: 4000,
    unit: '/µL',
    range: '4500-11000',
    category: 'Haematology'
  },
  {
    test_name: 'ESR',
    value: 7,
    unit: 'mm/hr',
    range: '0-20',
    category: 'Haematology'
  },
  {
    test_name: 'Platelets',
    value: 440000,
    unit: '/µL',
    range: '150000-450000',
    category: 'Haematology'
  },
  {
    test_name: 'Glucose',
    value: 40,
    unit: 'mg/dL',
    range: '70-140',
    category: 'Biochemistry'
  }
];

const informaticsOutput = analyzeReport({
  reportData: extractedData,
  onboardingData: {},
  sensorData: {}
});

console.log(JSON.stringify(informaticsOutput, null, 2));
