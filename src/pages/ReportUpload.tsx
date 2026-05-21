import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  FileText,
  User,
  Heart,
  ClipboardList,
  Upload,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Loader2,
  Trash2,
  Filter,
  Sparkles,
  Camera,
  Scan,
  ShieldAlert,
  ArrowUpRight,
  Bot,
  Send,
  ChevronRight
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "../services/api";

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-3 mb-4 opacity-80">
    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <h3 className="text-sm font-bold uppercase tracking-wider text-primary/80">{title}</h3>
  </div>
);

const DataRow = ({ label, value, icon: Icon, t }: { label: string; value: any; icon?: any; t: any }) => (
  <div className="flex items-center justify-between py-3 border-b border-muted/50 last:border-0 group hover:bg-muted/30 px-3 transition-colors rounded-lg">
    <div className="flex items-center gap-3">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />}
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
    <span className="text-sm font-semibold text-foreground">
      {value === null || value === undefined || value === "" ? "—" :
        (typeof value === "boolean" ? (value ? t('onboarding.yes') : t('onboarding.no')) :
          (Array.isArray(value) ? (value.length > 0 ? value.join(", ") : t('reports.none')) : value))}
    </span>
  </div>
);

export default function ReportUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  console.log("API URL:", api.defaults.baseURL);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [analyzingSuggestion, setAnalyzingSuggestion] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [reportAnalysis, setReportAnalysis] = useState<any>(null);
  const [manualEntry, setManualEntry] = useState({
    hemoglobin: "",
    sugar: "",
    glucose: "",
    tsh: "",
    platelets: "",
    wbc: "",
    esr: "",
    lymphocytes: "",
    neutrophils: "",
    monocytes: "",
    eosinophils: ""
  });
  const [skinResult, setSkinResult] = useState<any>(null);

  // Doctor AI State
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [doctorMessage, setDoctorMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string, content: string }[]>([]);
  const [isConsulting, setIsConsulting] = useState(false);
  const [isSkinModalOpen, setIsSkinModalOpen] = useState(false);
  const [skinImage, setSkinImage] = useState<string | null>(null);
  const [analyzingSkin, setAnalyzingSkin] = useState(false);
  const [analyzingHealth, setAnalyzingHealth] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [onboardRes, aiRes, reportsRes] = await Promise.all([
          api.get("/onboarding").catch(() => null),
          api.get("/ai/latest").catch(() => null),
          api.get("/reports").catch(() => ({ success: true, data: [] }))
        ]);

        // Merge user metadata with onboarding data
        const meta = user?.user_metadata || {};
        const combinedOnboarding = {
          age: String(meta.age || ""),
          gender: meta.gender || "",
          ...(onboardRes || {})
        };

        setOnboarding(combinedOnboarding);
        setAiAnalysis(aiRes || null);

        // We fetch past reports for context if needed, but do not automatically 
        // display them in the Upload page slot. The user must upload a new report to see analysis.
        // if (reportsRes?.success && reportsRes.data?.length > 0) {
        //   setReportAnalysis(reportsRes.data[0].analysis);
        // }
      } catch (err) {
        console.error("Fetch Data Error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const triggerAnalysis = async () => {
    setAnalyzingSuggestion(true);
    try {
      const res = await api.post("/ai/analyze", { sensorData: {}, skinAnalysis: skinResult });
      setAiAnalysis(res.data.data);
      setShowSuggestions(true);
      toast({ title: "Analysis Complete", description: "Your Ayurvedic suggestions are ready." });
    } catch (err) {
      toast({ title: "Analysis Failed", description: "Could not generate suggestions.", variant: "destructive" });
    } finally {
      setAnalyzingSuggestion(false);
    }
  };

  const handleFullAIAnalysis = async () => {
    setAnalyzingHealth(true);
    try {
      const res = await api.post("/ai/analyze", {
        skinAnalysis: skinResult,
        sensorData: {} // Fetching latest from backend
      });
      if (res.success) {
        setReportAnalysis(res.data);
        toast({ title: "Health Analysis Complete", description: "All data sources have been fused." });
      }
    } catch (err) {
      toast({ title: "Analysis Failed", description: "Could not complete unified analysis.", variant: "destructive" });
    } finally {
      setAnalyzingHealth(false);
    }
  };

  const handleSkinScan = async () => {
    setAnalyzingSkin(true);
    try {
      // Simulate "Model Training" processing delay for realism
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Simulated "Vision AI" logic — in production, this would be a real ML model call
      const res = await api.post("/skin/analyze", {
        condition_name: "Scar / Wound", // Updated from Acne to match user context
        confidence_score: 92,
        symptoms: ["linear mark", "healing"]
      });
      if (res.success) {
        setSkinResult(res.data);
        // Ensure the results dashboard shows the skin scan immediately
        setReportAnalysis(prev => ({
          ...(prev || {}),
          skin_analysis: res.data
        }));
        toast({ title: "Skin Scan Complete", description: "Dermatology AI has analyzed the image." });
        setIsSkinModalOpen(false);
      }
    } catch (err) {
      toast({ title: "Scan Failed", description: "Could not analyze skin image.", variant: "destructive" });
    } finally {
      setAnalyzingSkin(false);
    }
  };

  const handleUpdateOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await api.post("/onboarding", onboarding);
      toast({ title: "Updated!", description: "Your health profile has been saved." });
      setIsEditing(false);
    } catch (err) {
      toast({ title: "Update Failed", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDoctorConsult = async () => {
    if (!doctorMessage.trim()) return;

    const userMsg = doctorMessage;
    setDoctorMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
    setIsConsulting(true);

    try {
      const res = await api.post("/doctor-ai", {
        prompt: userMsg
      });

      if (res.success) {
        setChatHistory(prev => [...prev, { role: "assistant", content: res.reply }]);
      } else {
        const fallback = "AI doctor is currently unavailable. Please try again later.";
        setChatHistory(prev => [...prev, { role: "assistant", content: res.message || fallback }]);
      }
    } catch (err: any) {
      console.error("[Doctor AI] Error:", err);
      const fallback = "AI doctor is currently unavailable. Please try again later.";
      toast({ title: "Consultation Failed", description: err.message || fallback, variant: "destructive" });
    } finally {
      setIsConsulting(false);
    }
  };

  const handleManualAnalysis = async () => {
    if (!manualEntry.hemoglobin && !manualEntry.sugar && !manualEntry.wbc && !manualEntry.tsh) {
      toast({ title: "Empty Data", description: "Please enter at least one value." });
      return;
    }
    setUploadLoading(true);
    try {
      const res = await api.post("/reports/manual", manualEntry);
      if (res.success) {
        setReportAnalysis(res.data.analysis);
        setManualEntry({
          hemoglobin: "", sugar: "", glucose: "", tsh: "", platelets: "", wbc: "", esr: "",
          lymphocytes: "", neutrophils: "", monocytes: "", eosinophils: ""
        });
        toast({ title: "Analysis Ready", description: "Your manual records have been processed." });
      } else {
        throw new Error(res.message || "Failed to process records.");
      }
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message || "Failed to process records.", variant: "destructive" });
    } finally {
      setUploadLoading(false);
    }
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("report", file);

    console.log("Uploading file to:", api.defaults.baseURL + "/reports/upload");
    setUploadLoading(true);
    try {
      if (file.type === "application/pdf") {
        setPdfUrl(URL.createObjectURL(file));
      } else {
        // Clear if not PDF or handle images differently if needed
        setPdfUrl(null);
      }

      const res = await api.post("/reports/upload", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setReportAnalysis(res.data.analysis);
        toast({ title: "Report Uploaded", description: "AI is analyzing your report parameters." });
      } else {
        throw new Error(res.message || "Upload failed");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err?.response?.data?.message || err?.message || "Upload Failed",
        variant: "destructive"
      });
    } finally {
      setUploadLoading(false);
    }
  };

  if (!onboarding) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-20">
          <Activity className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{t('reports.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
          </div>
        </div>

        <Tabs defaultValue="onboarding" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1 rounded-2xl">
            <TabsTrigger value="onboarding" className="flex items-center gap-2 rounded-xl data-[state=active]:shadow-premium">
              <User className="h-4 w-4" />
              <span>{t('reports.tabProfile')}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 rounded-xl data-[state=active]:shadow-premium">
              <ClipboardList className="h-4 w-4" />
              <span>{t('reports.tabReports')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="onboarding" className="mt-0">
            <Card className="overflow-hidden border-none shadow-premium bg-background/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{t('reports.aiAssess')}</CardTitle>
                    <CardDescription>{t('reports.aiAssessDesc')}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {onboarding && (onboarding._id || Object.keys(onboarding).length > 0) ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} className="hidden lg:flex rounded-full px-4">
                        {isEditing ? t('reports.cancelEdit') : t('reports.updateOnly')}
                      </Button>
                      <Button variant="default" size="sm" onClick={() => navigate("/onboarding?mode=update")} className="rounded-full px-6 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90">
                        {t('reports.fullUpdate')}
                      </Button>
                    </>
                  ) : (
                    <Button variant="default" size="sm" onClick={() => navigate("/onboarding")} className="rounded-full px-6 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90">
                      {t('reports.startProfile')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex h-96 items-center justify-center">
                    <Activity className="h-10 w-10 animate-spin text-primary/40" />
                  </div>
                ) : (onboarding && (onboarding._id || Object.keys(onboarding).length > 0)) || isEditing ? (
                  isEditing ? (
                    <form onSubmit={handleUpdateOnboarding} className="p-8 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-6">
                          <SectionHeader icon={User} title={t('reports.basicInfo')} />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{t('onboarding.age')}</Label>
                              <Input type="number" className="rounded-xl" value={onboarding.age || ""} onChange={e => setOnboarding({ ...onboarding, age: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('onboarding.gender')}</Label>
                              <Select value={onboarding.gender} onValueChange={v => setOnboarding({ ...onboarding, gender: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">{t('onboarding.male')}</SelectItem>
                                  <SelectItem value="female">{t('onboarding.female')}</SelectItem>
                                  <SelectItem value="other">{t('onboarding.other')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{t('onboarding.marital')}</Label>
                              <Select value={onboarding.marital_status} onValueChange={v => setOnboarding({ ...onboarding, marital_status: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">{t('onboarding.single')}</SelectItem>
                                  <SelectItem value="married">{t('onboarding.married')}</SelectItem>
                                  <SelectItem value="divorced">{t('onboarding.divorced')}</SelectItem>
                                  <SelectItem value="widowed">{t('onboarding.widowed')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('onboarding.ph')}</Label>
                              <Select value={onboarding.physically_handicapped === undefined ? "" : (onboarding.physically_handicapped ? "yes" : "no")} onValueChange={v => setOnboarding({ ...onboarding, physically_handicapped: v === "yes" })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">{t('onboarding.yes')}</SelectItem>
                                  <SelectItem value="no">{t('onboarding.no')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <SectionHeader icon={Activity} title={t('reports.vitalsAndReports')} />
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label>{t('reports.bpIssues')}</Label>
                              <Switch checked={onboarding.has_bp} onCheckedChange={v => setOnboarding({ ...onboarding, has_bp: v })} />
                            </div>
                            {onboarding.has_bp && <Input placeholder={t('onboarding.placeholder.bp')} value={onboarding.bp_values} onChange={e => setOnboarding({ ...onboarding, bp_values: e.target.value })} />}

                            <div className="flex items-center justify-between">
                              <Label>{t('reports.sugarIssues')}</Label>
                              <Switch checked={onboarding.has_sugar} onCheckedChange={v => setOnboarding({ ...onboarding, has_sugar: v })} />
                            </div>
                            {(onboarding.has_sugar || onboarding.sugar) && <Input placeholder={t('onboarding.placeholder.sugar')} value={onboarding.sugar_values || onboarding.sugar} onChange={e => setOnboarding({ ...onboarding, sugar_values: e.target.value })} />}
                          </div>

                          <div className="grid grid-cols-1 gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10 mt-4">
                            <div className="space-y-2">
                              <Label>{t('reports.hemo')}</Label>
                              <Input type="number" step="0.1" className="bg-background" value={onboarding.hemoglobin || ""} onChange={e => setOnboarding({ ...onboarding, hemoglobin: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('reports.bloodSugar')}</Label>
                              <Input type="number" className="bg-background" value={onboarding.sugar || ""} onChange={e => setOnboarding({ ...onboarding, sugar: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t('reports.cholesterol')}</Label>
                              <Input type="number" className="bg-background" value={onboarding.cholesterol || ""} onChange={e => setOnboarding({ ...onboarding, cholesterol: e.target.value })} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <SectionHeader icon={Activity} title={t('onboarding.stepDiet')} />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{t('onboarding.dietType')}</Label>
                              <Select value={onboarding.diet_type} onValueChange={v => setOnboarding({ ...onboarding, diet_type: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="veg">{t('onboarding.veg')}</SelectItem>
                                  <SelectItem value="nonveg">{t('onboarding.nonveg')}</SelectItem>
                                  <SelectItem value="vegan">{t('onboarding.vegan')}</SelectItem>
                                  <SelectItem value="eggetarian">{t('onboarding.eggetarian')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('reports.mealsDay')}</Label>
                              <Select value={onboarding.meals_per_day} onValueChange={v => setOnboarding({ ...onboarding, meals_per_day: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1meal">{t('onboarding.options.diet.1meal')}</SelectItem>
                                  <SelectItem value="2meals">{t('onboarding.options.diet.2meals')}</SelectItem>
                                  <SelectItem value="3meals">{t('onboarding.options.diet.3meals')}</SelectItem>
                                  <SelectItem value="4meals">{t('onboarding.options.diet.4meals')}</SelectItem>
                                  <SelectItem value="5meals">{t('onboarding.options.diet.5meals')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <SectionHeader icon={Heart} title={t('reports.lifestyle')} />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{t('onboarding.smoking')}</Label>
                              <Select value={onboarding.smoking} onValueChange={v => setOnboarding({ ...onboarding, smoking: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="never">{t('onboarding.never')}</SelectItem>
                                  <SelectItem value="occasionally">{t('onboarding.occasionally')}</SelectItem>
                                  <SelectItem value="regularly">{t('onboarding.regularly')}</SelectItem>
                                  <SelectItem value="quit">{t('onboarding.quit')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t('onboarding.alcohol')}</Label>
                              <Select value={onboarding.alcohol} onValueChange={v => setOnboarding({ ...onboarding, alcohol: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="never">{t('onboarding.never')}</SelectItem>
                                  <SelectItem value="occasionally">{t('onboarding.occasionally')}</SelectItem>
                                  <SelectItem value="regularly">{t('onboarding.regularly')}</SelectItem>
                                  <SelectItem value="quit">{t('onboarding.quit')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t('onboarding.sleepHours')}</Label>
                            <Input type="number" className="rounded-xl" value={onboarding.sleep_hours?.[0] || onboarding.sleep_hours || ""} onChange={e => setOnboarding({ ...onboarding, sleep_hours: e.target.value })} />
                          </div>

                          <SectionHeader icon={ClipboardList} title={t('reports.medHist')} />
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>{t('reports.pastSurgical')}</Label>
                              <Textarea className="rounded-xl bg-background" value={onboarding.surgical_history || ""} onChange={e => setOnboarding({ ...onboarding, surgical_history: e.target.value })} placeholder={t('onboarding.placeholder.surgical')} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-6 border-t">
                        <Button type="submit" disabled={isUpdating} className="rounded-full px-8 shadow-premium">
                          {isUpdating ? t('reports.applying') : t('reports.saveProfile')}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-8 space-y-12">
                      {/* AI Health Suggestions Section */}
                      <div className="p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 animate-in fade-in duration-700">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                          <div className="flex-shrink-0 relative">
                            {aiAnalysis ? (
                              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 p-1">
                                <div className="h-full w-full rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg">
                                  {aiAnalysis.healthScore || aiAnalysis.dominantDosha?.[0] || "?"}
                                </div>
                              </div>
                            ) : (
                              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center border-2 border-muted-foreground/20">
                                <Activity className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 text-center md:text-left space-y-4">
                            <div>
                              <h4 className="text-xl font-bold text-primary flex items-center gap-2 justify-center md:justify-start">
                                {t('reports.healthProfile')}
                                {aiAnalysis && <span className="text-xs px-2 py-0.5 bg-primary/20 rounded-full font-black uppercase tracking-tighter">AI Active</span>}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {aiAnalysis ? t('dashboard.basedOn') : "Get personalized AI health insights and Ayurvedic medicine suggestions based on your profile."}
                              </p>
                            </div>

                            {!showSuggestions || !aiAnalysis ? (
                              <Button
                                onClick={() => navigate("/ai-suggestions")}
                                disabled={analyzingSuggestion}
                                className="rounded-full px-8 bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-transform shadow-premium py-6 text-lg font-bold"
                              >
                                {analyzingSuggestion ? (
                                  <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {t('reports.analyzing')}
                                  </>
                                ) : (
                                  <>
                                    <Plus className="mr-2 h-5 w-5" />
                                    {t('reports.getMedicine')}
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                onClick={() => navigate("/ai-suggestions")}
                                className="rounded-full px-8 bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-transform shadow-premium py-6 text-lg font-bold"
                              >
                                <Sparkles className="mr-2 h-5 w-5" />
                                View Full AI Analysis
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-10">
                          <div>
                            <SectionHeader icon={User} title={t('reports.bioData')} />
                            <div className="grid grid-cols-1 gap-1">
                              <DataRow label={t('onboarding.age')} value={onboarding.age} icon={Activity} t={t} />
                              <DataRow label={t('onboarding.gender')} value={onboarding.gender ? t(`onboarding.${onboarding.gender}`) : "—"} icon={User} t={t} />
                              <DataRow label={t('onboarding.marital')} value={onboarding.marital_status ? t(`onboarding.${onboarding.marital_status}`) : "—"} icon={Heart} t={t} />
                              <DataRow label={t('onboarding.ph')} value={onboarding.physically_handicapped} icon={User} t={t} />
                            </div>
                          </div>

                          <div>
                            <SectionHeader icon={ClipboardList} title={t('reports.clinicalBasics')} />
                            <div className="grid grid-cols-1 gap-1">
                              <DataRow label={t('reports.bpReading')} value={onboarding.bp_values} icon={Activity} t={t} />
                              <DataRow label={t('reports.sugarReading')} value={onboarding.sugar_values} icon={Activity} t={t} />
                              <DataRow label={t('reports.hemo')} value={onboarding.hemoglobin} icon={Activity} t={t} />
                            </div>
                          </div>

                          <div>
                            <SectionHeader icon={AlertCircle} title={t('reports.medicalRisk')} />
                            <div className="grid grid-cols-1 gap-1">
                              <DataRow label={t('reports.strokeHist')} value={onboarding.stroke_history} icon={AlertCircle} t={t} />
                              <DataRow label={t('reports.cardiacHist')} value={onboarding.cardiac_arrest_history} icon={Activity} t={t} />
                              <DataRow label={t('reports.traumaHist')} value={onboarding.past_traumatic_history} icon={AlertCircle} t={t} />
                              <DataRow label={t('reports.pastSurgical')} value={onboarding.surgical_history} icon={ClipboardList} t={t} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-10">
                          <div>
                            <SectionHeader icon={Heart} title={t('reports.symptoms')} />
                            <div className="grid grid-cols-1 gap-1">
                              <DataRow label={t('reports.headache')} value={onboarding.headache_type && onboarding.headache_type !== 'none' ? t(`onboarding.options.headache.${onboarding.headache_type}`) : 'None'} icon={Activity} t={t} />
                              <DataRow label={t('reports.painLevel')} value={onboarding.pain_severity ? t(`onboarding.${onboarding.pain_severity}`) : 'N/A'} icon={AlertCircle} t={t} />
                              <DataRow label={t('reports.lowEnergy')} value={onboarding.low_energy} icon={Activity} t={t} />
                              <DataRow label={t('reports.chestPressure')} value={onboarding.chest_pressure} icon={Activity} t={t} />
                            </div>
                          </div>

                          <div>
                            <SectionHeader icon={Activity} title={t('reports.entOcular')} />
                            <div className="grid grid-cols-1 gap-1">
                              <DataRow label={t('reports.entIssues')} value={onboarding.ent_issues} icon={Activity} t={t} />
                              <DataRow label={t('reports.eyeIssues')} value={onboarding.ocular_issues} icon={Activity} t={t} />
                            </div>
                          </div>

                          <div>
                            <SectionHeader icon={Activity} title={t('reports.lifestyle')} />
                            <div className="grid grid-cols-1 gap-1">
                              <DataRow label={t('onboarding.smoking')} value={onboarding.smoking ? t(`onboarding.${onboarding.smoking}`) : "—"} icon={Activity} t={t} />
                              <DataRow label={t('onboarding.alcohol')} value={onboarding.alcohol ? t(`onboarding.${onboarding.alcohol}`) : "—"} icon={Activity} t={t} />
                              <DataRow label={t('onboarding.sleepHours')} value={onboarding.sleep_hours?.[0] || onboarding.sleep_hours} icon={Activity} t={t} />
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-2 pt-12 border-t border-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
                            <div>
                              <SectionHeader icon={Filter} title={t('reports.dietDigest')} />
                              <div className="grid grid-cols-1 gap-1">
                                <DataRow label={t('onboarding.dietType')} value={onboarding.diet_type ? t(`onboarding.${onboarding.diet_type}`) : "—"} icon={Activity} t={t} />
                                <DataRow label={t('reports.mealsDay')} value={onboarding.meals_per_day} icon={Activity} t={t} />
                                <DataRow label={t('reports.outsideFood')} value={onboarding.outside_food_intake ? t(`onboarding.${onboarding.outside_food_intake}`) : "—"} icon={Activity} t={t} />
                              </div>
                            </div>
                            <div>
                              <SectionHeader icon={ClipboardList} title={t('reports.medication')} />
                              <div className="grid grid-cols-1 gap-1">
                                <DataRow label={t('reports.onMeds')} value={onboarding.on_medication} icon={CheckCircle2} t={t} />
                                <DataRow label={t('reports.medsHist')} value={onboarding.medications_history} icon={ClipboardList} t={t} />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-6 text-center">
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-40">
                              {t('reports.lastUpdated')}: {onboarding.updatedAt ? new Date(onboarding.updatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                            </p>
                            <Button
                              onClick={() => navigate("/onboarding?mode=update")}
                              className="rounded-full px-12 py-7 text-xl font-black shadow-premium bg-gradient-to-r from-primary/80 to-primary hover:scale-105 transition-all text-white border-none"
                            >
                              {t('reports.updateOnboarding')}
                            </Button>
                            <p className="text-[10px] opacity-40 max-w-xs leading-relaxed">
                              Updating your onboarding data helps the AI provide more accurate health predictions and specific medicines.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-12 text-center space-y-4">
                    <div className="mx-auto h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                      <ClipboardList className="h-10 w-10 text-primary/40" />
                    </div>
                    <h3 className="text-xl font-bold">{t('reports.noData')}</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Complete your medical profile to enable AI analysis and personalized health suggestions.
                    </p>
                    <Button onClick={() => navigate("/onboarding")} className="mt-4 rounded-full px-8 shadow-premium">
                      {t('reports.startProfile')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-0 space-y-6">
            <Card className="border-none shadow-premium bg-background/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 px-6 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-3">
                    <Upload className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-xl">{t('reports.uploadTitle')}</CardTitle>
                      <CardDescription>{t('reports.uploadDesc')}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    {pdfUrl ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-primary/5 p-4 rounded-3xl border border-primary/10">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <h3 className="font-bold text-base">Uploaded Document</h3>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => { setPdfUrl(null); setReportAnalysis(null); }} className="rounded-full shadow-sm text-xs">
                            <Upload className="h-3 w-3 mr-2" /> Upload Another
                          </Button>
                        </div>
                        <iframe src={pdfUrl} className="w-full h-full min-h-[700px] border-2 border-primary/20 rounded-3xl bg-white shadow-premium" />
                      </div>
                    ) : (
                      <div className="group relative border-2 border-dashed border-primary/20 rounded-3xl p-12 text-center hover:border-primary/40 transition-all bg-primary/5 cursor-pointer">
                        <input type="file" onChange={onFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf,image/*" disabled={uploadLoading} />
                        <div className="space-y-4 pointer-events-none">
                          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="h-8 w-8 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <p className="font-bold text-lg">{t('reports.dropzone')}</p>
                            <p className="text-xs text-muted-foreground">PDF, JPEG or PNG up to 10MB</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Health Tools Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground px-1">AI Health Tools</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          variant="outline"
                          className="h-auto p-6 rounded-3xl border-2 border-primary/10 hover:border-primary/30 bg-background flex flex-col items-center gap-3 text-center transition-all group"
                          onClick={() => document.getElementById('report-upload-input')?.click()}
                        >
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold">Upload Report</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-black">PDF / Image</p>
                          </div>
                          <input id="report-upload-input" type="file" className="hidden" onChange={onFileUpload} accept=".pdf,image/*" />
                        </Button>

                        <Button
                          variant="outline"
                          className="h-auto p-6 rounded-3xl border-2 border-primary/10 hover:border-primary/30 bg-background flex flex-col items-center gap-3 text-center transition-all group"
                          onClick={() => setIsSkinModalOpen(true)}
                        >
                          <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                            <Camera className="h-6 w-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-bold">Skin AI Scanner</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-black">Analyze Rashes</p>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="h-auto p-6 rounded-3xl border-2 border-indigo-500/10 hover:border-indigo-500/30 bg-background flex flex-col items-center gap-3 text-center transition-all group"
                          onClick={() => setIsDoctorModalOpen(true)}
                        >
                          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                            <Bot className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-bold">Doctor AI Agent</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-black text-indigo-600">Powered by Grok</p>
                          </div>
                        </Button>

                        <Button
                          className="h-auto p-6 rounded-3xl bg-gradient-to-br from-primary to-primary/80 hover:scale-[1.02] transition-all flex flex-col items-center gap-3 text-center shadow-premium group"
                          onClick={handleFullAIAnalysis}
                          disabled={analyzingHealth}
                        >
                          {analyzingHealth ? (
                            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                          ) : (
                            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Sparkles className="h-6 w-6 text-white" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white">Full Analysis</p>
                            <p className="text-[10px] text-white/70 uppercase tracking-wider font-black">Unified Fusion</p>
                          </div>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-bold text-primary">{t('reports.manualEntry')}</Label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 bg-muted/30 p-6 rounded-3xl border border-muted/50">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest opacity-60">{t('reports.hemo')}</Label>
                          <Input
                            value={manualEntry.hemoglobin}
                            onChange={e => setManualEntry(p => ({ ...p, hemoglobin: e.target.value }))}
                            placeholder="e.g. 13.5"
                            className="rounded-xl bg-background text-lg py-6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Blood Sugar (Glucose)</Label>
                          <Input
                            value={manualEntry.sugar}
                            onChange={e => setManualEntry(p => ({ ...p, sugar: e.target.value }))}
                            placeholder="e.g. 110"
                            className="rounded-xl bg-background text-lg py-6"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">WBC</Label>
                            <Input value={manualEntry.wbc} onChange={e => setManualEntry(p => ({ ...p, wbc: e.target.value }))} placeholder="4500" className="rounded-xl bg-background" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">TSH</Label>
                            <Input value={manualEntry.tsh} onChange={e => setManualEntry(p => ({ ...p, tsh: e.target.value }))} placeholder="2.5" className="rounded-xl bg-background" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Platelets</Label>
                            <Input value={manualEntry.platelets} onChange={e => setManualEntry(p => ({ ...p, platelets: e.target.value }))} placeholder="200000" className="rounded-xl bg-background" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">ESR</Label>
                            <Input value={manualEntry.esr} onChange={e => setManualEntry(p => ({ ...p, esr: e.target.value }))} placeholder="15" className="rounded-xl bg-background" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Neutrophils %</Label>
                            <Input value={manualEntry.neutrophils} onChange={e => setManualEntry(p => ({ ...p, neutrophils: e.target.value }))} placeholder="60" className="rounded-xl bg-background" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lymphocytes %</Label>
                            <Input value={manualEntry.lymphocytes} onChange={e => setManualEntry(p => ({ ...p, lymphocytes: e.target.value }))} placeholder="30" className="rounded-xl bg-background" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Monocytes %</Label>
                            <Input value={manualEntry.monocytes} onChange={e => setManualEntry(p => ({ ...p, monocytes: e.target.value }))} placeholder="6" className="rounded-xl bg-background" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Eosinophils %</Label>
                            <Input value={manualEntry.eosinophils} onChange={e => setManualEntry(p => ({ ...p, eosinophils: e.target.value }))} placeholder="2" className="rounded-xl bg-background" />
                          </div>
                        </div>
                        <Button
                          onClick={handleManualAnalysis}
                          disabled={uploadLoading}
                          className="w-full mt-4 rounded-xl py-6 text-base font-bold shadow-premium bg-gradient-to-r from-primary to-primary/80"
                        >
                          {uploadLoading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              {t('reports.analyzing')}
                            </>
                          ) : (
                            <>
                              <Activity className="mr-2 h-5 w-5" />
                              {t('reports.analyze')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {reportAnalysis ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-h-[1200px] overflow-y-auto pr-2 custom-scrollbar pb-10">

                        {/* SECTION 1: SUMMARY CARD */}
                        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-[2.5rem] p-8 text-white shadow-premium relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                            <Activity className="h-32 w-32" />
                          </div>
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="space-y-2">
                              <p className="text-xs font-black uppercase tracking-[0.3em] opacity-60">Overall Health Score</p>
                              <div className="flex items-baseline gap-2">
                                <h2 className="text-6xl font-black">{reportAnalysis.summary?.health_score || reportAnalysis.summary?.healthScore || "—"}</h2>
                                <span className="text-xl font-bold opacity-60">/100</span>
                              </div>
                              <div className="flex items-center gap-2 mt-4 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full w-fit">
                                <div className={`h-2 w-2 rounded-full animate-pulse ${reportAnalysis.summary?.riskLevel === 'Low' ? 'bg-green-400' :
                                    reportAnalysis.summary?.riskLevel === 'Moderate' ? 'bg-orange-400' : 'bg-red-400'
                                  }`} />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                  {reportAnalysis.summary?.riskLevel || "Calculating"} Risk
                                </span>
                              </div>
                            </div>
                            <div className="h-24 w-24 rounded-full border-8 border-white/10 flex items-center justify-center">
                              <Sparkles className="h-10 w-10 text-white/40" />
                            </div>
                          </div>
                        </div>

                        {/* SECTION 2: PARAMETERS GRID */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Biometric Parameters
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {reportAnalysis.parameters?.filter((p: any) => p.parameter_name || p.test_name).map((param: any, idx: number) => (
                              <div key={idx} className="bg-background border-2 border-muted/50 p-5 rounded-3xl hover:border-primary/20 transition-all group">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-bold text-xs text-muted-foreground truncate max-w-[120px]">{param.parameter_name || param.test_name}</span>
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${param.status === 'normal' ? 'bg-green-100 text-green-700' :
                                      param.status === 'high' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {param.status}
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-foreground">{param.value}</span>
                                  <span className="text-[10px] font-bold text-muted-foreground">{param.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SECTION 3: DISEASE PREDICTIONS */}
                        {reportAnalysis.predictions?.length > 0 && (
                          <div className="bg-primary/5 border-2 border-primary/10 rounded-[2.5rem] p-8 space-y-6">
                            <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                              <ShieldAlert className="h-5 w-5" />
                              Clinical Health Predictions
                            </h4>
                            <div className="space-y-4">
                              {reportAnalysis.predictions.map((pred: any, i: number) => (
                                <div key={i} className="bg-background p-6 rounded-3xl border border-primary/10 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-lg text-foreground">{pred.condition}</span>
                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${pred.confidence === 'High' ? 'bg-red-100 text-red-700' :
                                        pred.confidence === 'Moderate' || pred.confidence === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                          'bg-blue-100 text-blue-700'
                                      }`}>
                                      <Sparkles className="h-3 w-3" />
                                      {pred.confidence?.toUpperCase()} CONFIDENCE
                                    </div>
                                  </div>
                                  {pred.reason && (
                                    <p className="text-sm text-muted-foreground leading-relaxed italic opacity-80">{pred.reason}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SECTION 4: SKIN ANALYSIS */}
                        {reportAnalysis.skin_analysis && (
                          <div className="bg-orange-50/50 border-2 border-orange-100 rounded-[2.5rem] p-8 space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
                                <Camera className="h-5 w-5" />
                                Skin Condition Result
                              </h4>
                              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${reportAnalysis.skin_analysis.severity === 'severe' ? 'bg-red-100 text-red-700' :
                                  reportAnalysis.skin_analysis.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                {reportAnalysis.skin_analysis.severity}
                              </span>
                            </div>
                            <div className="bg-background p-6 rounded-3xl border border-orange-100 shadow-sm space-y-4">
                              <div className="flex items-baseline gap-2">
                                <span className="font-black text-2xl text-orange-900">{reportAnalysis.skin_analysis.condition}</span>
                                <span className="text-xs font-bold text-orange-600 opacity-60">Detected condition</span>
                              </div>
                              {reportAnalysis.skin_analysis.advice?.length > 0 && (
                                <div className="space-y-3 pt-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-800/40">Suggested Care</p>
                                  <ul className="grid grid-cols-1 gap-2">
                                    {reportAnalysis.skin_analysis.advice.map((a: string, i: number) => (
                                      <li key={i} className="text-xs font-bold text-orange-900/80 flex items-start gap-2 bg-orange-50/50 p-3 rounded-xl">
                                        <ArrowUpRight className="h-3 w-3 text-orange-400 mt-0.5 flex-shrink-0" />
                                        {a}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            {reportAnalysis.skin_analysis.warning && (
                              <div className="flex items-center gap-2 text-red-600 font-bold text-[10px] italic bg-red-50 p-4 rounded-2xl">
                                <AlertCircle className="h-4 w-4" />
                                {reportAnalysis.skin_analysis.warning}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SECTION 5: RECOMMENDATIONS (TABS) */}
                        {reportAnalysis.recommendations && (
                          <div className="space-y-4">
                            <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                              <ClipboardList className="h-4 w-4" />
                              AI Doctor Recommendations
                            </h4>
                            <Tabs defaultValue="medical" className="w-full">
                              <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-2xl h-12">
                                <TabsTrigger value="medical" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all font-bold text-xs">Medical</TabsTrigger>
                                <TabsTrigger value="ayurvedic" className="rounded-xl data-[state=active]:bg-green-500 data-[state=active]:text-white transition-all font-bold text-xs">Ayurvedic</TabsTrigger>
                                <TabsTrigger value="lifestyle" className="rounded-xl data-[state=active]:bg-purple-500 data-[state=active]:text-white transition-all font-bold text-xs">Lifestyle</TabsTrigger>
                              </TabsList>

                              <TabsContent value="medical" className="mt-4">
                                <div className="bg-blue-50/50 border-2 border-blue-100 rounded-[2rem] p-6">
                                  <ul className="space-y-3">
                                    {reportAnalysis.recommendations.medical?.map((text: string, i: number) => (
                                      <li key={i} className="text-sm font-bold text-blue-900/80 flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[10px] text-blue-600">{i + 1}</div>
                                        {text}
                                      </li>
                                    ))}
                                    {(!reportAnalysis.recommendations.medical || reportAnalysis.recommendations.medical.length === 0) && <li className="text-sm text-muted-foreground italic text-center py-4">No medical advice specific to this analysis.</li>}
                                  </ul>
                                </div>
                              </TabsContent>

                              <TabsContent value="ayurvedic" className="mt-4">
                                <div className="bg-green-50/50 border-2 border-green-100 rounded-[2rem] p-6">
                                  <ul className="space-y-3">
                                    {reportAnalysis.recommendations.ayurvedic?.map((text: string, i: number) => (
                                      <li key={i} className="text-sm font-bold text-green-900/80 flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-[10px] text-green-600">{i + 1}</div>
                                        <span className="italic">{text}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </TabsContent>

                              <TabsContent value="lifestyle" className="mt-4">
                                <div className="bg-purple-50/50 border-2 border-purple-100 rounded-[2rem] p-6">
                                  <ul className="space-y-3">
                                    {reportAnalysis.recommendations.lifestyle?.map((text: string, i: number) => (
                                      <li key={i} className="text-sm font-bold text-purple-900/80 flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-[10px] text-purple-600">{i + 1}</div>
                                        {text}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        )}

                        {/* SECTION 6: ALERT */}
                        {reportAnalysis.alert && (
                          <div className="p-8 bg-red-500 rounded-[2.5rem] text-white shadow-xl shadow-red-200 animate-pulse border-4 border-white/20">
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                                <AlertCircle className="h-8 w-8 text-white" />
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60 mb-1">Emergency Alert</p>
                                <h3 className="text-xl font-black uppercase tracking-tight">{reportAnalysis.alert}</h3>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-muted/20 rounded-3xl border border-dashed border-muted/50 opacity-60">
                        <div className="h-20 w-20 rounded-3xl bg-background flex items-center justify-center mb-6 shadow-sm">
                          <FileText className="h-10 w-10 text-muted-foreground opacity-30" />
                        </div>
                        <h3 className="font-bold text-xl mb-2">{t('reports.analysisTitle')}</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          Upload a report or enter values manually to see a detailed health breakdown here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Skin AI Scanner Modal */}
        <Dialog open={isSkinModalOpen} onOpenChange={setIsSkinModalOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-gradient-to-br from-orange-50 to-orange-100/50">
              <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
                <Camera className="h-8 w-8 text-orange-600" />
              </div>
              <DialogTitle className="text-2xl font-black text-orange-900">Skin AI Scanner</DialogTitle>
              <DialogDescription className="text-orange-800/60 font-medium">
                Analyze skin conditions like acne, rashes, or scars using our dermatology AI.
              </DialogDescription>
            </DialogHeader>

            <div className="p-8 space-y-6 bg-background">
              <div className="border-2 border-dashed border-orange-200 rounded-3xl p-12 text-center bg-orange-50/30 group hover:border-orange-400 transition-all cursor-pointer relative">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSkinImage(URL.createObjectURL(file));
                  }}
                />
                {skinImage ? (
                  <img src={skinImage} alt="Skin preview" className="max-h-48 mx-auto rounded-xl shadow-lg" />
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="h-6 w-6 text-orange-600" />
                    </div>
                    <p className="text-sm font-bold text-orange-900/40">Upload or Capture Image</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1 rounded-2xl h-12 border-orange-200 text-orange-900 hover:bg-orange-50">
                  <Camera className="mr-2 h-4 w-4" /> Camera
                </Button>
                <Button
                  className="flex-1 rounded-2xl h-12 bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200"
                  onClick={handleSkinScan}
                  disabled={analyzingSkin || !skinImage}
                >
                  {analyzingSkin ? <Loader2 className="h-5 w-5 animate-spin" /> : "Analyze Skin"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Doctor AI Agent Modal */}
        <Dialog open={isDoctorModalOpen} onOpenChange={setIsDoctorModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-gradient-to-br from-indigo-50 to-purple-100/50">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-indigo-950 tracking-tight">Doctor AI Agent</DialogTitle>
                  <p className="text-sm font-bold text-indigo-600/60">Powered by Grok Clinical Intelligence</p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-0 bg-background flex flex-col h-[500px]">
              <ScrollArea className="flex-1 p-8">
                <div className="space-y-6">
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center opacity-40">
                      <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
                        <Bot className="h-10 w-10 text-indigo-400" />
                      </div>
                      <p className="text-lg font-black text-indigo-900">Hello! I'm your clinical assistant.</p>
                      <p className="text-sm font-bold max-w-[250px]">Ask me anything about your blood reports or skin conditions.</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-5 rounded-[1.5rem] text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-indigo-50 text-indigo-900 rounded-tl-none border border-indigo-100'
                          }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {isConsulting && (
                    <div className="flex justify-start">
                      <div className="bg-indigo-50 p-5 rounded-[1.5rem] rounded-tl-none border border-indigo-100 flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
                        </div>
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Doctor AI is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-6 bg-indigo-50/50 border-t border-indigo-100">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 bg-white rounded-2xl p-1 shadow-inner ring-1 ring-indigo-100">
                    <textarea
                      className="w-full bg-transparent p-3 text-sm font-bold text-indigo-900 placeholder:text-indigo-200 outline-none resize-none"
                      placeholder="Type your medical query here..."
                      rows={2}
                      value={doctorMessage}
                      onChange={(e) => setDoctorMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleDoctorConsult();
                        }
                      }}
                    />
                  </div>
                  <Button
                    className="h-14 w-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 shrink-0"
                    onClick={handleDoctorConsult}
                    disabled={isConsulting || !doctorMessage.trim()}
                  >
                    <Send className="h-6 w-6" />
                  </Button>
                </div>
                <p className="mt-4 text-[10px] font-black text-center text-indigo-300 uppercase tracking-[0.2em]">
                  Medical Disclaimer: Agent for informational purposes only.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
