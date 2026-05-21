export type StressLevel = "low" | "moderate" | "high";

export function computeStressScore(params: {
  heartRate?: number;
  temperature?: number;
  symptomCount?: number;
  sleepHours?: number;
}): number {
  const { heartRate = 72, temperature = 36.6, symptomCount = 0, sleepHours = 7 } = params;
  let score = 0;

  // Heart rate contribution (0-30)
  if (heartRate > 100) score += Math.min(30, (heartRate - 100) * 1.5);
  else if (heartRate < 60) score += Math.min(15, (60 - heartRate) * 1.5);

  // Temperature contribution (0-25)
  if (temperature > 37.5) score += Math.min(25, (temperature - 37.5) * 15);
  else if (temperature < 36) score += Math.min(15, (36 - temperature) * 10);

  // Symptom count contribution (0-25)
  score += Math.min(25, symptomCount * 5);

  // Sleep deprivation (0-20)
  if (sleepHours < 6) score += Math.min(20, (6 - sleepHours) * 8);

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getStressLevel(score: number): StressLevel {
  if (score < 33) return "low";
  if (score < 66) return "moderate";
  return "high";
}

export function getStressColor(level: StressLevel): string {
  switch (level) {
    case "low": return "hsl(142, 71%, 45%)";
    case "moderate": return "hsl(45, 93%, 47%)";
    case "high": return "hsl(0, 72%, 51%)";
  }
}

export function getRecommendations(level: StressLevel): string[] {
  switch (level) {
    case "low":
      return [
        "Great job! Your stress levels are healthy.",
        "Continue maintaining your current routine.",
        "Regular exercise and sleep are working well for you.",
      ];
    case "moderate":
      return [
        "Your stress is slightly elevated. Consider deep breathing.",
        "Try a 10-minute meditation session.",
        "Ensure you're getting at least 7 hours of sleep.",
        "Stay hydrated and take regular breaks.",
      ];
    case "high":
      return [
        "⚠️ Your stress level is high. Please take immediate rest.",
        "Contact your healthcare provider if symptoms persist.",
        "Practice grounding techniques: 5-4-3-2-1 method.",
        "Avoid caffeine and stimulants.",
        "Reach out to your emergency contact if needed.",
      ];
  }
}
