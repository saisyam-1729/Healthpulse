import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Lock } from "lucide-react";
import { api } from "../services/api";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const API_URL = "https://health-931r.onrender.com";
    try {
      console.log("Sending request via API service:", API_URL);
      const data = await api.post("/admin/login", { username, password });
      
      console.log("Response:", data);
      if (data.token) {
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("userRole", "admin");
        window.location.href = "/admin/dashboard";
      } else {
        alert("Login failed: No token received");
      }
    } catch (error: any) {
      console.error("Login error:", error.message);
      alert("Login failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30">
            <Lock className="h-7 w-7" />
          </div>
          <CardTitle className="font-display text-3xl font-bold tracking-tight">Admin Console</CardTitle>
          <CardDescription className="text-slate-400">Strictly authorized personnel only</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Username</Label>
              <Input 
                id="username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
                className="bg-slate-800 border-slate-700 text-white focus-visible:ring-primary"
                placeholder="Enter admin ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="password" className="text-slate-300">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="bg-slate-800 border-slate-700 text-white focus-visible:ring-primary"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full h-11 text-base font-bold transition-all hover:scale-[1.02]" disabled={loading}>
              {loading ? "Verifying..." : "Authenticate Access"}
            </Button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest font-bold">
              <LayoutDashboard className="h-3 w-3" />
              Secure Admin Terminal
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
