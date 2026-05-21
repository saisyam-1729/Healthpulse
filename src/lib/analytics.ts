import ReactGA from "react-ga4";

const MEASUREMENT_ID = "G-XXXXXXXXXX"; // In production, this should come from VITE_GA_ID or similar

export const initGA = () => {
  ReactGA.initialize(MEASUREMENT_ID);
  // IP Anonymization is enabled by default in GA4, 
  // but we can be explicit if needed via gtag configurations
  console.log("GA4 Initialized");
};

export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: "pageview", page: path });
};

export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};

export const enum AnalyticsCategory {
  USER = "User",
  HEALTH = "Health",
  DEVICE = "Device",
  FEEDBACK = "Feedback",
  EMERGENCY = "Emergency"
}

export const enum AnalyticsAction {
  ONBOARDING_COMPLETE = "onboarding_complete",
  AI_ANALYSIS_TRIGGER = "ai_analysis_trigger",
  EMERGENCY_TRIGGER = "emergency_trigger",
  FEEDBACK_SUBMIT = "feedback_submit",
  DEVICE_DATA_RECEIVED = "device_data_received"
}
