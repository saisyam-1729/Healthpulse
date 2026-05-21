import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, MessageSquare, LogIn, Download, Search, Trash2, Edit2, Key, Activity, ArrowLeft, 
  LayoutDashboard, Clock, RefreshCw, Smartphone, Monitor, Globe, ShieldAlert
} from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

interface AnalyticsData {
  stats: {
    activeUsers: number;
    sessionsToday: number;
    avgSessionTime: number;
    bounceRate: number;
  };
  charts: {
    activityOverTime: any[];
    topPages: any[];
    devices: any[];
  };
  liveUsers: any[];
}

interface User {
  _id: string;
  email: string;
  role: string;
  loginCount: number;
  lastLogin: string;
  createdAt: string;
}

interface Feedback {
  _id: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const COLORS = ['#00f3ff', '#0066ff', '#00ff66', '#ff00ff', '#ffaa00'];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "users" | "feedbacks">("analytics");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserHealth, setSelectedUserHealth] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [analyticsData, usersData, feedbackData] = await Promise.all([
        api.get("/admin/analytics"),
        api.get("/admin/users"),
        api.get("/admin/feedbacks"),
      ]);
      setAnalytics(analyticsData);
      setUsers(usersData);
      setFeedbacks(feedbackData);
    } catch (err: any) {
      if (err.status === 403) navigate("/dashboard");
      else toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh analytics every 30 seconds
    const interval = setInterval(() => {
      api.get("/admin/analytics").then(data => setAnalytics(data)).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleViewHealth = async (userId: string, email: string) => {
    try {
      const result = await api.get(`/admin/users/${userId}/health`);
      if (result && result.length > 0) {
        setSelectedUserHealth({ email, ...result[0] });
        toast({ title: "Health Data Loaded", description: `Showing latest analysis for ${email}` });
      } else {
        toast({ title: "No Data", description: "This user hasn't performed any AI analysis yet.", variant: "default" });
      }
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleExportUsers = () => {
    const token = localStorage.getItem('admin_token');
    window.open(`${import.meta.env.VITE_API_URL}/admin/export/users?token=${token}`, '_blank');
  };

  const handleExportFeedback = () => {
    const token = localStorage.getItem('admin_token');
    window.open(`${import.meta.env.VITE_API_URL}/admin/export/feedbacks?token=${token}`, '_blank');
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("userRole");
    navigate("/admin-login");
  };

  const handleEditUser = async (userId: string, currentEmail: string, currentRole: string) => {
    const newRole = window.prompt(`Change role for ${currentEmail}\n\nCurrent role: ${currentRole}\nEnter new role (user / admin):`, currentRole);
    if (!newRole || newRole === currentRole) return;
    try {
      await api.put(`/admin/users/${userId}`, { email: currentEmail, role: newRole });
      toast({ title: "User Updated", description: `Role changed to ${newRole}` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    const newPassword = window.prompt(`Reset password for ${email}\n\nEnter new password (min 6 chars):`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    try {
      await api.patch(`/admin/users/${userId}/password`, { password: newPassword });
      toast({ title: "Password Reset", description: `Password updated for ${email}` });
    } catch (err: any) {
      toast({ title: "Reset Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const confirmed = window.confirm(`Are you sure you want to DELETE user:\n${email}\n\nThis action cannot be undone!`);
    if (!confirmed) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast({ title: "User Deleted", description: `${email} has been removed.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><Activity className="h-8 w-8 animate-spin text-cyan-400" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-cyan-500/30">
      
      {/* ── GLASS HEADER ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-cyan-500/20 bg-background/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,243,255,0.05)]">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="hover:bg-cyan-500/10 text-cyan-400">
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-cyan-400" />
              <h1 className="text-xl font-bold font-display neon-text-cyan">SYS_ADMIN</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-400 transition-colors">
              LOGOUT
            </Button>
            <div className="h-4 w-px bg-border hidden md:block" />
            <Button variant="outline" size="sm" onClick={handleExportUsers} className="hidden md:flex gap-2 glass-button text-xs">
              <Download className="h-3 w-3" /> EXPORT USERS
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportFeedback} className="hidden md:flex gap-2 glass-button text-xs">
              <Download className="h-3 w-3" /> EXPORT FEEDBACK
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex glass-panel rounded-full p-1 border-cyan-500/30">
            {['analytics', 'users', 'feedbacks'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300 ${
                  activeTab === tab 
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(0,243,255,0.3)]' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          
          {/* ======================= ANALYTICS TAB ======================= */}
          {activeTab === 'analytics' && analytics && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Top Stats */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="liquid-glass border-cyan-500/30 group hover:border-cyan-400 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-cyan-500/80 uppercase">Active Users</CardTitle>
                    <Activity className="h-4 w-4 text-cyan-400 group-hover:animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-cyan-400">{analytics.stats.activeUsers}</div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      Live right now
                    </p>
                  </CardContent>
                </Card>

                <Card className="liquid-glass border-blue-500/30 group hover:border-blue-400 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-blue-500/80 uppercase">Sessions Today</CardTitle>
                    <Users className="h-4 w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-blue-400">{analytics.stats.sessionsToday}</div>
                    <p className="text-xs text-muted-foreground mt-1">Unique active sessions</p>
                  </CardContent>
                </Card>

                <Card className="liquid-glass border-green-500/30 group hover:border-green-400 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-green-500/80 uppercase">Avg Session</CardTitle>
                    <Clock className="h-4 w-4 text-green-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-green-400">{formatTime(analytics.stats.avgSessionTime)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Time spent in app</p>
                  </CardContent>
                </Card>

                <Card className="liquid-glass border-orange-500/30 group hover:border-orange-400 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-orange-500/80 uppercase">Bounce Rate</CardTitle>
                    <RefreshCw className="h-4 w-4 text-orange-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-orange-400">{analytics.stats.bounceRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Single page visits</p>
                  </CardContent>
                </Card>
              </div>

              {/* Middle Charts */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                
                {/* Line Chart */}
                <Card className="liquid-glass border-cyan-500/30 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-cyan-400 uppercase tracking-widest">Network Traffic (24h)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.charts.activityOverTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 243, 255, 0.1)" />
                        <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(5, 10, 20, 0.9)', border: '1px solid rgba(0,243,255,0.3)', borderRadius: '8px' }}
                          itemStyle={{ color: '#00f3ff' }}
                        />
                        <Line type="monotone" dataKey="views" stroke="#00f3ff" strokeWidth={3} dot={{ fill: '#00f3ff', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card className="liquid-glass border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-cyan-400 uppercase tracking-widest">Device Nodes</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] flex items-center justify-center">
                    {analytics.charts.devices.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.charts.devices}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {analytics.charts.devices.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: 'rgba(5, 10, 20, 0.9)', border: '1px solid rgba(0,243,255,0.3)', borderRadius: '8px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-xs uppercase tracking-widest">Awaiting Data</p>
                    )}
                  </CardContent>
                </Card>
                
                {/* Bar Chart */}
                <Card className="liquid-glass border-cyan-500/30 lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-cyan-400 uppercase tracking-widest">Hot Sectors (Top Pages)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.charts.topPages} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 243, 255, 0.1)" horizontal={false} />
                        <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="path" stroke="rgba(255,255,255,0.8)" fontSize={12} tickLine={false} axisLine={false} width={150} />
                        <RechartsTooltip 
                          cursor={{ fill: 'rgba(0,243,255,0.1)' }}
                          contentStyle={{ backgroundColor: 'rgba(5, 10, 20, 0.9)', border: '1px solid rgba(0,243,255,0.3)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="views" fill="url(#colorCyan)" radius={[0, 4, 4, 0]}>
                          {analytics.charts.topPages.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

              </div>

              {/* Bottom Table */}
              <Card className="liquid-glass border-cyan-500/30 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-cyan-400 uppercase tracking-widest">Live Activity Log</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-cyan-950/40 text-xs uppercase text-cyan-500/80 font-mono tracking-widest">
                        <tr>
                          <th className="px-6 py-4 font-medium">Session / User</th>
                          <th className="px-6 py-4 font-medium">Event</th>
                          <th className="px-6 py-4 font-medium">Path / Action</th>
                          <th className="px-6 py-4 font-medium">Device</th>
                          <th className="px-6 py-4 font-medium text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-500/10">
                        {analytics.liveUsers.map((ev, idx) => (
                          <motion.tr 
                            key={ev._id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="hover:bg-cyan-900/20 transition-colors group"
                          >
                            <td className="px-6 py-4 font-mono text-xs">
                              {ev.userId ? <span className="text-green-400">Auth: {ev.userId.slice(0,8)}</span> : <span className="text-muted-foreground">Anon: {ev.sessionId.slice(0,8)}</span>}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                ev.eventType === 'pageview' ? 'bg-blue-500/20 text-blue-400' :
                                ev.eventType === 'click' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {ev.eventType}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground/80">
                              {ev.eventType === 'click' ? ev.elementId : ev.path}
                              {ev.eventType === 'time' && <span className="ml-2 text-muted-foreground">({formatTime(ev.timeSpent)})</span>}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground text-xs flex items-center gap-2">
                              {ev.deviceType === 'Mobile' ? <Smartphone className="h-3 w-3" /> : ev.deviceType === 'Tablet' ? <Monitor className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                              {ev.deviceType}
                            </td>
                            <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                              {format(new Date(ev.timestamp), "HH:mm:ss")}
                            </td>
                          </motion.tr>
                        ))}
                        {analytics.liveUsers.length === 0 && (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No recent activity detected.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ======================= USERS TAB ======================= */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="liquid-glass border-cyan-500/30">
                <CardHeader className="pb-3 border-b border-cyan-500/10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-cyan-400 uppercase tracking-widest text-lg font-bold">User Database</CardTitle>
                      <CardDescription className="text-cyan-500/60">Manage system operators and clients.</CardDescription>
                    </div>
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500/50" />
                      <Input 
                        placeholder="Search matrix..." 
                        className="pl-10 bg-background/50 border-cyan-500/30 focus-visible:ring-cyan-500 text-cyan-50 placeholder:text-cyan-500/40" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-cyan-950/20 text-xs uppercase text-cyan-500/80 font-mono tracking-widest border-b border-cyan-500/20">
                        <tr>
                          <th className="px-6 py-4 text-left font-medium">Identifier</th>
                          <th className="px-6 py-4 text-left font-medium">Clearance Level</th>
                          <th className="px-6 py-4 text-center font-medium">Access Count</th>
                          <th className="px-6 py-4 text-left font-medium">Last Uplink</th>
                          <th className="px-6 py-4 text-left font-medium">Init Date</th>
                          <th className="px-6 py-4 text-right font-medium">Overrides</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-500/10">
                        {filteredUsers.map((u) => (
                          <tr key={u._id} className="hover:bg-cyan-900/10 transition-colors group">
                            <td className="px-6 py-4 font-medium text-foreground">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'admin' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.2)]' : 'bg-white/5 text-muted-foreground'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-mono text-cyan-400/80">{u.loginCount || 0}</td>
                            <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                              {u.lastLogin ? format(new Date(u.lastLogin), "MMM d, HH:mm") : "Never"}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                              {format(new Date(u.createdAt), "MMM d, yyyy")}
                            </td>
                            <td className="px-6 py-4 text-right space-x-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => handleViewHealth(u._id, u.email)} title="Health Scan">
                                <Activity className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500/50 hover:text-blue-400 hover:bg-blue-500/10" onClick={() => handleEditUser(u._id, u.email, u.role)} title="Modify Clearance">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500/50 hover:text-green-400 hover:bg-green-500/10" onClick={() => handleResetPassword(u._id, u.email)} title="Reset Passkey">
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500/50 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteUser(u._id, u.email)} title="Terminate">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Health Analysis Display */}
              <AnimatePresence>
                {selectedUserHealth && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 overflow-hidden">
                    <Card className="border-cyan-500/40 bg-cyan-950/30 backdrop-blur-xl shadow-[0_0_30px_rgba(0,243,255,0.1)] relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle className="text-lg text-cyan-400">Health Scan: {selectedUserHealth.email}</CardTitle>
                          <CardDescription className="text-cyan-500/60 font-mono text-xs">Log updated: {format(new Date(selectedUserHealth.timestamp), "PPP p")}</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUserHealth(null)} className="text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/20">Close Panel</Button>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 p-4 rounded-xl border border-cyan-500/20 bg-black/40">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">Condition</p>
                            <p className="text-xl font-bold text-cyan-50">{selectedUserHealth.condition}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">Severity</p>
                            <p className="text-xl font-bold font-mono text-cyan-400">{selectedUserHealth.severity}/100</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">Risk Index</p>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                              selectedUserHealth.riskLevel === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 
                              selectedUserHealth.riskLevel === 'medium' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
                              'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}>
                              {selectedUserHealth.riskLevel}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">Critical Flags</p>
                            <p className="text-sm font-medium text-red-400">{selectedUserHealth.criticalFlags?.join(', ') || 'None'}</p>
                          </div>
                        </div>

                        {selectedUserHealth.alerts?.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase text-red-400/80 tracking-widest flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> System Alerts
                            </p>
                            {selectedUserHealth.alerts.map((a: any, i: number) => (
                              <div key={i} className="text-xs p-3 rounded-lg bg-red-950/40 text-red-200 border border-red-500/30 font-mono">
                                &gt; {a.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ======================= FEEDBACK TAB ======================= */}
          {activeTab === 'feedbacks' && (
            <motion.div key="feedbacks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="liquid-glass border-cyan-500/30 bg-transparent shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-cyan-400 uppercase tracking-widest text-lg font-bold">Feedback Stream</CardTitle>
                  <CardDescription className="text-cyan-500/60">Raw user telemetry and system ratings.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {feedbacks.map((f, i) => (
                      <motion.div 
                        key={f._id} 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="glass-panel p-5 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.15)] group relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-4 pl-3">
                          <span className="text-sm font-bold text-foreground/90">{f.username}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Activity key={i} className={`h-3 w-3 ${i < f.rating ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]' : 'text-cyan-900/50'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/70 italic pl-3 mb-4 line-clamp-4">"{f.comment}"</p>
                        <div className="text-[10px] text-cyan-500/50 uppercase tracking-widest border-t border-cyan-500/10 pt-3 pl-3 font-mono">
                          {format(new Date(f.createdAt), "PPP p")}
                        </div>
                      </motion.div>
                    ))}
                    {feedbacks.length === 0 && (
                      <div className="col-span-full py-12 text-center text-cyan-500/50 font-mono text-sm uppercase tracking-widest">
                        No telemetry data available.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
