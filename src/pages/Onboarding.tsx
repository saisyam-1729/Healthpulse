import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

import { onboardingSchema } from "@/config/onboardingSchema";
import { FieldRenderer } from "@/components/FieldRenderer";

interface OnboardingData {
  age: string; gender: string; marital_status: string; physically_handicapped: boolean;
  headache_type: string; body_pain_location: string[]; chest_pain_side: string; chest_pressure: boolean;
  stroke_history: boolean; cardiac_arrest_history: boolean;
  conditions: string[];
  on_medication: boolean; medication_details: string;
  has_bp: boolean; bp_values: string; has_sugar: boolean; sugar_values: string;
  low_energy: boolean; proper_sleep: boolean; sleep_hours: number[];
  pain_severity: string; pain_locations: string[];
  common_symptoms: string[];
  wound_scar_marks: boolean; wound_details: string; fractures: boolean; fracture_details: string;
  ent_issues: string[]; ocular_issues: string[]; ocular_family_history: boolean;
  menstrual_flow: string; cycle_duration: string; pads_per_day: string; menstrual_other_symptoms: string;
  menopausal: boolean;
  past_traumatic_history: string; surgical_history: string; medications_history: string;
  physical_exhaustion: boolean;
  smoking: string; smoking_duration: string; smoking_frequency: string;
  alcohol: string; alcohol_duration: string; alcohol_frequency: string;
  other_addictions: string;
  sexually_active: string;
  blood_investigations: string[]; imaging_done: string[];
  has_blood_report: boolean;
  diet_type: string; meals_per_day: string; food_type: string; outside_food_intake: string;
  womens_health: string;
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [data, setData] = useState<OnboardingData>({
    age: "", gender: "", marital_status: "", physically_handicapped: false,
    headache_type: "", body_pain_location: [], chest_pain_side: "", chest_pressure: false,
    stroke_history: false, cardiac_arrest_history: false,
    conditions: [],
    on_medication: false, medication_details: "",
    has_bp: false, bp_values: "", has_sugar: false, sugar_values: "",
    low_energy: false, proper_sleep: true, sleep_hours: [7],
    pain_severity: "", pain_locations: [],
    common_symptoms: [],
    wound_scar_marks: false, wound_details: "", fractures: false, fracture_details: "",
    ent_issues: [], ocular_issues: [], ocular_family_history: false,
    menstrual_flow: "", cycle_duration: "", pads_per_day: "", menstrual_other_symptoms: "",
    menopausal: false,
    past_traumatic_history: "", surgical_history: "", medications_history: "",
    physical_exhaustion: false,
    smoking: "never", smoking_duration: "", smoking_frequency: "",
    alcohol: "never", alcohol_duration: "", alcohol_frequency: "",
    other_addictions: "",
    sexually_active: "",
    blood_investigations: [], imaging_done: [],
    has_blood_report: false,
    diet_type: "veg", meals_per_day: "3", food_type: "", outside_food_intake: "rarely",
    womens_health: "",
  });

  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadOnboarding = async () => {
      if (!user) {
        setFetching(false);
        return;
      }
      try {
        const res = await api.get("/onboarding");
        
        // Always start with user metadata if it's there
        const meta = user.user_metadata || {};
        const baseData = {
          ...data,
          age: meta.age ? String(meta.age) : data.age,
          gender: meta.gender || data.gender,
        };

        if (res && Object.keys(res).length > 0) {
          setData({ ...baseData, ...res });
          
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get("mode") !== "update") {
             navigate("/dashboard");
          }
        } else {
          // If no onboarding record, at least use the signup metadata
          setData(baseData);
        }
      } catch (err) {
        console.log("No existing profile found");
      } finally {
        setFetching(false);
      }
    };
    loadOnboarding();
  }, [user, navigate]);

  const handleChange = (key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleFinish = async () => {
    try {
      if (user) {
        await api.post("/onboarding", data);
        toast({ title: t('onboarding.complete', "Assessment complete!"), description: t('onboarding.completeDesc', "Your health profile has been updated.") });
        
        // Track GA Event
        const { trackEvent, AnalyticsCategory, AnalyticsAction } = await import("@/lib/analytics");
        trackEvent(AnalyticsCategory.USER, AnalyticsAction.ONBOARDING_COMPLETE);

        // After update, if we came from reports, go back to reports
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get("mode") === "update") {
          navigate("/reports");
        } else {
          navigate("/dashboard");
        }
      } else {
        localStorage.setItem("pendingOnboarding", JSON.stringify(data));
        toast({ title: t('onboarding.saved', "Assessment saved!"), description: t('onboarding.savedDesc', "Now create your account to finish.") });
        navigate("/signup");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter sections dynamically based on condition
  const dynamicSteps = onboardingSchema.filter((section) => {
    if (section.condition && !section.condition(data)) return false;
    return true;
  });

  // Keep step index bounded if sections conditionally disappear
  const safeStep = Math.min(step, dynamicSteps.length - 1);
  const currentSection = dynamicSteps[safeStep];
  const totalSteps = dynamicSteps.length;
  const progress = ((safeStep + 1) / totalSteps) * 100;
  const isLastStep = safeStep === totalSteps - 1;

  if (!currentSection) return null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 p-4">
      <div className="mx-auto w-full max-w-2xl flex-1">
        {/* Step indicator */}
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("common.step")} {safeStep + 1} {t("common.of")} {totalSteps}</span>
          <span className="font-medium text-foreground">{t(currentSection.title)}</span>
        </div>
        <Progress value={progress} className="mb-6" />

        <Card className="flex flex-col h-full max-h-[85vh]">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="font-display">{t(currentSection.title)}</CardTitle>
            {currentSection.subtitle && (
              <CardDescription>
                {t(currentSection.subtitle)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0 pb-6">
            <div className="space-y-5">
              {currentSection.fields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={(data as any)[field.key]}
                  onChange={handleChange}
                  data={data}
                />
              ))}
            </div>
          </CardContent>
          <div className="p-6 pt-0 border-t bg-background mt-auto flex-shrink-0">
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={safeStep === 0}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {t('common.back')}
              </Button>
              {isLastStep ? (
                <Button onClick={handleFinish}>
                  <Check className="mr-1 h-4 w-4" /> {t('onboarding.completeBtn', 'Complete')}
                </Button>
              ) : (
                <Button onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))}>
                  {t('common.next')} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
