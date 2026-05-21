import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Brain, Leaf, AlertCircle, Loader2, Sparkles, ChevronLeft, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function AiSuggestions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const fetchLatestAnalysis = async () => {
    try {
      const res = await api.get("/ai/latest");
      if (res.data) {
        setAnalysis(res.data);
      } else {
        // If no analysis exists, trigger one immediately
        handleAnalyze();
      }
    } catch (err) {
      console.error("Fetch Analysis Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api.post("/ai/analyze", { sensorData: {} });
      setAnalysis(res.data);
      toast({
        title: t("dashboard.analysisComplete"),
        description: res.data.condition,
      });
    } catch (err) {
      toast({
        title: "Analysis Failed",
        description: "Could not generate suggestions based on your profile.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchLatestAnalysis();
  }, [user]);

  if (loading || analyzing) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 animate-in fade-in duration-700">
          <div className="relative">
            <div className="h-32 w-32 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Brain className="absolute inset-0 m-auto h-12 w-12 text-primary animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">{t('reports.analyzing')}</h2>
            <p className="text-muted-foreground animate-pulse">Running AI diagnostic on your health profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => navigate("/reports")} className="rounded-full">
                <ChevronLeft className="h-6 w-6" />
             </Button>
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <Sparkles className="h-5 w-5 text-primary" />
                   <span className="text-xs font-black uppercase tracking-widest text-primary/60">AI Diagnostic Engine</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                  Health Analysis & Remedies
                </h1>
             </div>
          </div>
          <Button variant="outline" onClick={handleAnalyze} className="rounded-full border-primary/20 hover:bg-primary/5">
            <Activity className="mr-2 h-4 w-4" />
            Refresh Analysis
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Status Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-premium bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Brain className="h-32 w-32" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-primary-foreground text-2xl font-black shadow-lg ${
                    (analysis?.healthScore || 0) > 80 ? 'bg-green-500' : (analysis?.healthScore || 0) > 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}>
                    {analysis?.healthScore || "?"}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-primary/40 leading-none">Confidence</p>
                    <p className="text-lg font-black text-primary">{(analysis?.mlPrediction?.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <CardTitle className="text-xl font-black">{t('reports.healthScore')}</CardTitle>
                <CardDescription className="text-[10px]">{t('reports.latestAnalysis')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-xl bg-background/50 border border-primary/10">
                   <p className="text-[10px] font-bold uppercase text-primary/60 mb-0.5">{t('reports.predictedCondition')}</p>
                   <p className="text-lg font-black truncate">{analysis?.condition || "Excellent"}</p>
                </div>
                <div className="p-3 rounded-xl bg-background/50 border border-primary/10">
                   <p className="text-[10px] font-bold uppercase text-primary/60 mb-1">{t('reports.riskLevel')}</p>
                   <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${analysis?.riskLevel === 'low' ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <p className="text-lg font-black uppercase text-primary">{analysis?.riskLevel || "Low"}</p>
                   </div>
                </div>

                {/* Clinical Flags / Derived Features */}
                {analysis?.clinicalFlags && (
                  <div className="space-y-2 pt-2 border-t border-primary/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Clinical Insights</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(analysis.clinicalFlags).map(([key, value]) => (
                        value && (
                          <span key={key} className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[9px] font-bold border border-red-500/20 uppercase tracking-tighter">
                            {key.replace('_flag', '').replace('_', ' ')}
                          </span>
                        )
                      ))}
                      {!Object.values(analysis.clinicalFlags).some(v => v) && (
                        <span className="text-[10px] font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> No critical flags
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-premium bg-muted/30 overflow-hidden">
               <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
               <CardHeader className="py-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-primary" />
                    Prakriti (Dosha)
                  </CardTitle>
               </CardHeader>
               <CardContent className="pb-6">
                  <div className="flex items-center gap-3 mb-3">
                     <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                        <span className="text-2xl font-black text-primary">{analysis?.dominantDosha?.[0]}</span>
                     </div>
                     <div>
                        <p className="font-bold text-base leading-none">{analysis?.dominantDosha} Type</p>
                        <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold mt-1">Body Constitution</p>
                     </div>
                  </div>
                  <p className="text-xs leading-relaxed opacity-70 italic bg-background/40 p-3 rounded-xl border border-primary/5">
                    {analysis?.recommendations?.doshaAdvice || "Maintain a balanced lifestyle by eating warmth-providing foods and practicing grounding activities."}
                  </p>
               </CardContent>
            </Card>
          </div>

          {/* Recommendations Content */}
          <div className="lg:col-span-3 space-y-8">
             {/* Blood Report Section */}
             {analysis?.reportParameters?.length > 0 && (
               <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <FileText className="h-6 w-6 text-primary" />
                      Biomarker Report
                    </h3>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded-md">
                      Latest Lab Data
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {analysis.reportParameters.map((param: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-2xl bg-muted/30 border border-muted/50 hover:border-primary/20 transition-all group">
                        <p className="text-[9px] font-black uppercase opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">{param.test_name}</p>
                        <div className="flex items-baseline gap-1 my-1">
                          <span className="text-base font-black tracking-tight">{param.value}</span>
                          <span className="text-[8px] font-bold opacity-40">{param.unit}</span>
                        </div>
                        <div className={`mt-1 flex items-center gap-1 text-[8px] font-black uppercase ${
                          param.status === 'normal' ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {param.status === 'normal' ? <CheckCircle2 className="h-2 w-2" /> : <Activity className="h-2 w-2" />}
                          {param.status}
                        </div>
                      </div>
                    ))}
                  </div>
               </section>
             )}

             <div className="space-y-6">
                <div className="flex flex-col gap-2">
                   <h3 className="text-xl font-black flex items-center gap-3">
                     <Leaf className="h-6 w-6 text-primary" />
                     Medicine Cabinet
                   </h3>
                   <p className="text-xs text-muted-foreground">Personalized Ayurvedic remedies based on your hybrid ML analysis results.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {analysis?.recommendations?.medicines?.map((med: any, idx: number) => (
                     <Card key={idx} className="border-none shadow-premium bg-card/40 backdrop-blur-md group hover:scale-[1.02] transition-all overflow-hidden">
                       <div className="h-1 bg-primary/20 w-0 group-hover:w-full transition-all duration-500" />
                       <CardHeader className="pb-2 pt-4">
                         <div className="flex items-start justify-between">
                           <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                             <Leaf className="h-5 w-5" />
                           </div>
                           <span className="text-[9px] font-black uppercase py-0.5 px-2 bg-primary/5 rounded-full border border-primary/10">Natural Remedy</span>
                         </div>
                         <CardTitle className="mt-3 text-lg font-bold">{med.name}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-3 pb-5">
                         <div className="space-y-0.5">
                            <p className="text-[9px] font-black text-primary uppercase tracking-tighter opacity-60">Primary Benefit</p>
                            <p className="text-xs font-semibold leading-relaxed line-clamp-2">{med.benefit}</p>
                         </div>
                         <div className="pt-2 flex items-center justify-between border-t border-muted/50">
                            <span className="text-[9px] opacity-40 italic font-medium">Holistic Healing</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                         </div>
                       </CardContent>
                     </Card>
                   )) || (
                     <div className="col-span-full py-10 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                       <p className="text-sm text-muted-foreground">General wellness herbs recommended based on profile.</p>
                     </div>
                   )}
                </div>
             </div>

             <Card className="border-none shadow-premium bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-1">
                <div className="bg-background/80 rounded-2xl p-6 lg:p-8">
                   <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-emerald-500" />
                      LIFESTYLE & DIETARY ALIGNMENT
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                           <p className="text-[11px] font-black uppercase text-emerald-600 tracking-widest">Dietary Guidelines</p>
                        </div>
                        <ul className="space-y-2">
                          {Array.isArray(analysis?.recommendations?.diet) ? (
                            analysis.recommendations.diet.map((item: string, i: number) => (
                              <li key={i} className="text-xs flex items-center gap-2 opacity-80">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                {item}
                              </li>
                            ))
                          ) : (
                            <li className="text-xs leading-relaxed opacity-80">
                              {analysis?.recommendations?.dietAdvice || "Focus on fresh, seasonal vegetables and whole grains. Avoid processed sugars and excessive caffeine."}
                            </li>
                          )}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                           <p className="text-[11px] font-black uppercase text-teal-600 tracking-widest">Physical Activity</p>
                        </div>
                        <ul className="space-y-2">
                          {Array.isArray(analysis?.recommendations?.lifestyle) ? (
                            analysis.recommendations.lifestyle.map((item: string, i: number) => (
                              <li key={i} className="text-xs flex items-center gap-2 opacity-80">
                                <CheckCircle2 className="h-3 w-3 text-teal-500" />
                                {item}
                              </li>
                            ))
                          ) : (
                            <li className="text-xs leading-relaxed opacity-80">
                              {analysis?.recommendations?.exerciseAdvice || "Moderate yoga and rhythmic breathing (Pranayama) are highly recommended for your current constitution."}
                            </li>
                          )}
                        </ul>
                      </div>
                   </div>
                </div>
             </Card>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
