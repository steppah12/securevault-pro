import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton } from '@/components/ui';
import { Users, FileText, AlertTriangle, Lock, Shield, ShieldCheck, Megaphone, Settings, BarChart3, Eye } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { CLEARANCE_LEVELS } from '@/types/database';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'Administrator' && user.role !== 'Security Officer') { navigate('/'); return; }
    getAdminDashboard().then(setData).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) return <div className="space-y-6"><Skeleton className="h-32" /><div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div></div>;
  if (!data) return null;

  const isAdmin = user?.role === 'Administrator';
  const stats = [
    { label: 'Total Users', value: data.totalUsers, icon: Users, color: 'from-primary/20 to-primary/5 text-primary', onClick: () => navigate('/admin/users') },
    { label: 'Total Documents', value: data.totalDocuments, icon: FileText, color: 'from-chart-2/20 to-chart-2/5 text-chart-2', onClick: () => navigate('/documents') },
    { label: 'Active Alerts', value: data.activeAlerts, icon: AlertTriangle, color: 'from-destructive/20 to-destructive/5 text-destructive', onClick: () => navigate('/admin/alerts') },
    { label: 'Locked Accounts', value: data.lockedAccounts, icon: Lock, color: 'from-accent/20 to-accent/5 text-accent', onClick: () => navigate('/admin/users') },
  ];

  const rd = data.riskDistribution;
  const totalUsers = rd.normal + rd.medium + rd.high + rd.critical || 1;
  const severityColors: Record<string, string> = { Critical: 'bg-destructive text-destructive-foreground', High: 'bg-accent/20 text-accent', Medium: 'bg-secondary text-secondary-foreground', Info: 'bg-muted text-muted-foreground' };

  const quickActions = [
    { label: 'Manage Users', icon: Users, desc: 'Add, suspend, or assign clearance', to: '/admin/users', color: 'text-primary' },
    { label: 'Clearance Levels', icon: Shield, desc: 'View users by clearance level', to: '/admin/clearance', color: 'text-accent' },
    { label: 'Compare Users', icon: BarChart3, desc: 'Compare activity between users', to: '/admin/compare', color: 'text-chart-2' },
    { label: 'Announcements', icon: Megaphone, desc: 'Post to groups or all employees', to: '/admin/announcements', color: 'text-chart-3' },
    { label: 'ID Range Config', icon: Settings, desc: 'Configure employee ID ranges', to: '/admin/id-ranges', color: 'text-muted-foreground' },
    { label: 'Audit Logs', icon: Eye, desc: 'Monitor all system activity', to: '/admin/audit', color: 'text-chart-5' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20"><ShieldCheck className="h-7 w-7 text-primary" /></div>
            <div><h1 className="text-2xl font-display font-normal">Admin Command Center</h1><p className="text-sm text-muted-foreground mt-0.5">{isAdmin ? 'Full Administrator Access' : 'Security Officer Access'} · Employee ID: {user?.employee_id || '—'}</p></div>
          </div>
          <Badge className="bg-primary/15 text-primary border border-primary/30 font-semibold px-3 py-1.5 text-sm">{CLEARANCE_LEVELS[user?.role || 'Administrator']?.label}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="cursor-pointer hover:border-primary/30 transition-all group" onClick={s.onClick}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p><p className="text-3xl font-bold mt-1">{s.value}</p></div>
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform`}><s.icon className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map(a => (
            <button key={a.label} onClick={() => navigate(a.to)} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-all text-left group">
              <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${a.color} group-hover:bg-primary/10 transition-colors`}><a.icon className="h-5 w-5" /></div>
              <div><p className="text-sm font-semibold">{a.label}</p><p className="text-xs text-muted-foreground">{a.desc}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Threat Level Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Normal (0–20)', count: rd.normal, color: 'bg-primary', pct: (rd.normal / totalUsers) * 100 },
              { label: 'Medium (20–40)', count: rd.medium, color: 'bg-accent', pct: (rd.medium / totalUsers) * 100 },
              { label: 'High (40–60)', count: rd.high, color: 'bg-destructive/70', pct: (rd.high / totalUsers) * 100 },
              { label: 'Critical (60+)', count: rd.critical, color: 'bg-destructive', pct: (rd.critical / totalUsers) * 100 },
            ].map(r => (
              <div key={r.label}>
                <div className="flex items-center justify-between text-sm mb-1.5"><span>{r.label}</span><span className="font-bold tabular-nums">{r.count}</span></div>
                <div className="w-full bg-muted rounded-full h-2"><div className={`${r.color} h-2 rounded-full transition-all`} style={{ width: `${Math.max(2, r.pct)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Alerts</CardTitle><Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/admin/alerts')}>View all</Button></div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentAlerts.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No alerts</p> :
              data.recentAlerts.slice(0, 5).map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2"><Badge className={`text-xs ${severityColors[alert.severity] || ''}`}>{alert.severity}</Badge><span className="text-sm truncate max-w-[200px]">{alert.title}</span></div>
                  <span className="text-xs text-muted-foreground">{timeAgo(alert.created_at)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</CardTitle><Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/admin/audit')}>View all</Button></div></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentActivity.slice(0, 8).map((log: any) => (
              <div key={log.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-2"><Badge variant={log.status === 'Failed' ? 'destructive' : 'secondary'} className="text-xs">{log.action}</Badge><span className="text-muted-foreground truncate max-w-[350px]">{log.details}</span></div>
                <span className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
