import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getUsersByLevel, compareUsers } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { BarChart3, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function UserComparisonPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'Administrator' && user?.role !== 'Security Officer') { navigate('/'); return; }
    getUsersByLevel({ limit: 500 }).then(res => setAllUsers(res.users)).catch((e) => console.error(e));
  }, [user, navigate]);

  const addUser = (id: string) => { if (selectedIds.length >= 5 || selectedIds.includes(id)) return; setSelectedIds(prev => [...prev, id]); };
  const removeUser = (id: string) => setSelectedIds(prev => prev.filter(i => i !== id));

  const handleCompare = async () => {
    if (selectedIds.length < 1) return;
    setLoading(true);
    try { const res = await compareUsers(selectedIds); setResults(res.comparisons); } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setLoading(false);
  };

  const statLabels = [
    { key: 'logins', label: 'Logins' }, { key: 'uploads', label: 'Uploads' }, { key: 'downloads', label: 'Downloads' },
    { key: 'shares', label: 'Shares' }, { key: 'failedActions', label: 'Failed Actions' }, { key: 'suspiciousActions', label: 'Suspicious' }, { key: 'totalActions', label: 'Total Activity' },
  ];
  const maxValues = statLabels.reduce((acc, s) => { acc[s.key] = Math.max(...results.map(r => r.stats[s.key] || 0), 1); return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-display font-normal">Compare Users</h1><p className="text-sm text-muted-foreground">Compare activity and behavior across up to 5 users</p></div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            {selectedIds.map(id => {
              const u = allUsers.find(u => u.id === id);
              return (
                <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                  <span className="font-medium">{u?.first_name} {u?.last_name}</span>
                  <button onClick={() => removeUser(id)}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                </div>
              );
            })}
            {selectedIds.length < 5 && (
              <Select value="" onValueChange={addUser}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Add user to compare..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Add user to compare...</SelectItem>
                  {allUsers.filter(u => !selectedIds.includes(u.id)).map(u => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleCompare} disabled={loading || selectedIds.length < 1} className="gap-1.5"><BarChart3 className="h-4 w-4" /> {loading ? 'Comparing...' : 'Compare'}</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}>
            {results.map(r => (
              <Card key={r.id} className={r.riskScore >= 40 ? 'border-destructive/30' : ''}>
                <CardContent className="p-4 text-center">
                  <p className="font-bold text-sm truncate">{r.name}</p><p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  <div className="flex items-center justify-center gap-2 mt-2"><Badge variant="outline" className="text-xs">{r.role}</Badge>{r.employeeId && <code className="text-[10px] bg-muted px-1 py-0.5 rounded">#{r.employeeId}</code>}</div>
                  <div className="mt-2"><span className={`text-xl font-display font-normal ${r.riskScore >= 40 ? 'text-destructive' : r.riskScore >= 20 ? 'text-accent' : 'text-primary'}`}>{r.riskScore}</span><p className="text-[10px] text-muted-foreground">Risk Score</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Activity Comparison</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {statLabels.map(stat => (
                <div key={stat.key}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{stat.label}</p>
                  <div className="space-y-1.5">
                    {results.map((r, i) => {
                      const val = r.stats[stat.key] || 0;
                      const pct = (val / maxValues[stat.key]) * 100;
                      const colors = ['bg-primary', 'bg-accent', 'bg-chart-2', 'bg-chart-5', 'bg-destructive'];
                      const isSuspicious = stat.key === 'suspiciousActions' && val > 0;
                      return (
                        <div key={r.id} className="flex items-center gap-3">
                          <span className="text-xs w-24 truncate text-muted-foreground">{r.name.split(' ')[0]}</span>
                          <div className="flex-1 bg-muted rounded-full h-5 relative">
                            <div className={`${isSuspicious ? 'bg-destructive' : colors[i % colors.length]} h-5 rounded-full transition-all flex items-center justify-end pr-2`} style={{ width: `${Math.max(5, pct)}%` }}>
                              <span className="text-[10px] font-bold text-white">{val}</span>
                            </div>
                          </div>
                          {isSuspicious && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
