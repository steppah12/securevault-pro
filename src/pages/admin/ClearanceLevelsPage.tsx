import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getUsersByLevel } from '@/lib/api';
import { Badge, Skeleton } from '@/components/ui';
import { Shield, Eye, Lock, ShieldCheck, Crown } from 'lucide-react';

const levelConfig = [
  { role: 'Administrator', level: 4, icon: Crown, accent: 'from-destructive/20 to-destructive/5 border-destructive/20', badge: 'bg-destructive/20 text-destructive', docs: 'All document classifications', desc: 'Full system access.' },
  { role: 'Security Officer', level: 3, icon: ShieldCheck, accent: 'from-accent/20 to-accent/5 border-accent/20', badge: 'bg-accent/20 text-accent', docs: 'Public, Internal, Confidential, Restricted', desc: 'Security monitoring & audit access.' },
  { role: 'Manager', level: 2, icon: Shield, accent: 'from-primary/20 to-primary/5 border-primary/20', badge: 'bg-primary/20 text-primary', docs: 'Public, Internal, Confidential', desc: 'Team management, sharing, announcements.' },
  { role: 'Employee', level: 1, icon: Eye, accent: 'from-secondary to-secondary/50 border-border', badge: 'bg-secondary text-secondary-foreground', docs: 'Public, Internal', desc: 'Standard access to own and internal files.' },
  { role: 'Guest', level: 0, icon: Lock, accent: 'from-muted to-muted/50 border-border', badge: 'bg-muted text-muted-foreground', docs: 'Public only', desc: 'Limited read access to public documents.' },
];

export default function ClearanceLevelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<any>({});
  const [selectedLevel, setSelectedLevel] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role !== 'Administrator' && user?.role !== 'Security Officer') { navigate('/'); return; }
    getUsersByLevel({}).then(res => setCounts(res.counts)).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, [user, navigate]);

  useEffect(() => {
    if (!selectedLevel) { setFilteredUsers([]); return; }
    getUsersByLevel({ role: selectedLevel, limit: 100 }).then(res => setFilteredUsers(res.users)).catch((e) => console.error(e));
  }, [selectedLevel]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" />{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-display font-normal">Clearance Levels</h1><p className="text-sm text-muted-foreground">View and manage users across all security clearance levels</p></div>
      <div className="space-y-4">
        {levelConfig.map(lc => {
          const count = lc.role === 'Security Officer' ? counts.securityOfficer : counts[lc.role.toLowerCase()] || 0;
          const isExpanded = selectedLevel === lc.role;
          return (
            <div key={lc.role}>
              <button onClick={() => setSelectedLevel(isExpanded ? '' : lc.role)} className={`w-full text-left rounded-xl border bg-gradient-to-r ${lc.accent} p-5 transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-card/50 flex items-center justify-center"><lc.icon className="h-6 w-6" /></div>
                    <div><div className="flex items-center gap-2"><h3 className="font-bold text-lg">{lc.role}</h3><Badge className={lc.badge}>Level {lc.level}</Badge></div><p className="text-sm text-muted-foreground mt-0.5">{lc.desc}</p></div>
                  </div>
                  <div className="text-right"><p className="text-3xl font-bold">{count}</p><p className="text-xs text-muted-foreground">user{count !== 1 ? 's' : ''}</p></div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/30"><p className="text-xs text-muted-foreground"><span className="font-medium">Document Access:</span> {lc.docs}</p></div>
              </button>
              {isExpanded && filteredUsers.length > 0 && (
                <div className="mt-2 ml-6 space-y-1.5">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card text-sm">
                      <div className="flex items-center gap-3">
                        {u.employee_id && <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">#{u.employee_id}</code>}
                        <div><p className="font-medium">{u.first_name} {u.last_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                      </div>
                      <Badge variant={u.status === 'Locked' ? 'destructive' : 'default'} className="text-xs">{u.status || 'Active'}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {isExpanded && filteredUsers.length === 0 && <p className="mt-2 ml-6 text-sm text-muted-foreground">No users at this level</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
