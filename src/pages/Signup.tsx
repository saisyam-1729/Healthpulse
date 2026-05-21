import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "../services/api";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", gender: "", password: "", emergencyContact: "" });
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(form.email, form.password, {
        name: form.name,
        phone: form.phone,
        age: parseInt(form.age),
        gender: form.gender,
        emergency_contact: form.emergencyContact,
      });
      
      // Handle pending onboarding if any
      const pending = localStorage.getItem("pendingOnboarding");
      if (pending) {
        try {
          const onboardingData = JSON.parse(pending);
          await api.post("/onboarding", onboardingData);
          localStorage.removeItem("pendingOnboarding");
          toast({ title: t("onboarding.complete"), description: t("onboarding.completeDesc") });
        } catch (onboardErr) {
          console.error("Failed to sync onboarding:", onboardErr);
          toast({ title: "Partial Success", description: "Account created, but profile sync failed. You can update it later." });
        }
      } else {
        toast({ title: t("signup.successTitle", "Account created!"), description: t("signup.successDesc", "Welcome to Health Sync.") });
      }

      navigate("/onboarding");
    } catch (err: any) {
      console.error("Signup failed:", err.message);
      toast({ title: t("signup.failed", "Signup failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">{t("signup.title", "Create Account")}</CardTitle>
          <CardDescription>{t("signup.subtitle", "Start monitoring your health with AI")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("signup.fullName", "Full Name")}</Label>
                <Input value={form.name} onChange={e => update("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("login.email", "Email")}</Label>
                <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("signup.phone", "Phone")}</Label>
                <Input value={form.phone} onChange={e => update("phone", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("onboarding.age", "Age")}</Label>
                <Input type="number" value={form.age} onChange={e => update("age", e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("onboarding.gender", "Gender")}</Label>
                <Select onValueChange={v => update("gender", v)}>
                  <SelectTrigger><SelectValue placeholder={t("common.select", "Select")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("onboarding.male", "Male")}</SelectItem>
                    <SelectItem value="female">{t("onboarding.female", "Female")}</SelectItem>
                    <SelectItem value="other">{t("onboarding.other", "Other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("signup.emergencyContact", "Emergency Contact")}</Label>
                <Input value={form.emergencyContact} onChange={e => update("emergencyContact", e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("login.password", "Password")}</Label>
              <Input type="password" value={form.password} onChange={e => update("password", e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("signup.creating", "Creating Account...")}
                </>
              ) : t("signup.createBtn", "Create Account")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("signup.haveAccount", "Already have an account?")} <Link to="/login" className="text-primary hover:underline">{t("login.signInBtn", "Sign in")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
