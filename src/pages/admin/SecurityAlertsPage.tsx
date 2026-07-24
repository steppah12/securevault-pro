import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getSecurityAlerts, updateAlertStatus } from '@/lib/api';
import { Card, CardContent, Button, Badge, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { ShieldCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils';

const severityBorder: Record<string, string> = { Critical: 'border-l-destructive', High: 'border-l-accent', Medium: 'border-l-primary', Info: 'border-l-muted-foreground' };
const severityBadge: Record<string, string> = { Critical: 'bg-destructive text-destructive-foreground', High: 'bg-accent/20 text-accent', Medium: 'bg-primary/20 text-primary', Info: 'bg-muted text-muted-foreground' };

export default function SecurityAlertsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [counts, setCounts] = useState({ active: 0, acknowledged: 0, resolved: 0 });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { if (user?.role !== 'Administrator' && user?.role !== 'Security Officer') navigate('/'); }, [user, navigate]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try { const res = await getSecurityAlerts({ severity: severity || undefined, alertStatus: status || undefined, offset: page * 20, limit: 20 }); setAlerts(res.records); setCounts(res.counts); setHasMore(res.hasMore); } catch (e) { console.error(e); }
    setLoading(false);
  }, [severity, status, page]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleStatusChange = async (alertId: string, newStatus: string) => {
    try { await updateAlertStatus({ alertId, status: newStatus }); toast.success(`Alert ${newStatus.toLowerCase()}`); fetchAlerts(); } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-normal">Security Alerts</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Active: <span className="font-bold text-foreground">{counts.active}</span></span>
          <span className="text-muted-foreground">Ack: <span className="font-bold text-foreground">{counts.acknowledged}</span></span>
          <span className="text-muted-foreground">Resolved: <span className="font-bold text-foreground">{counts.resolved}</span></span>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={severity} onValueChange={v => { setSeverity(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Severities</SelectItem><SelectItem value="Critical">Critical</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Info">Info</SelectItem></SelectContent>
        </Select>
        <Select value={status} onValueChange={v => { setStatus(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Acknowledged">Acknowledged</SelectItem><SelectItem value="Resolved">Resolved</SelectItem><SelectItem value="Dismissed">Dismissed</SelectItem></SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : alerts.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><ShieldCheck className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No alerts found</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className={`border border-border border-l-4 rounded-r-lg p-4 ${severityBorder[alert.severity] || ''} bg-card`}>
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2"><Badge className={`text-xs font-bold ${severityBadge[alert.severity] || ''}`}>{alert.severity?.toUpperCase()}</Badge><span className="text-sm font-semibold">{alert.title}</span></div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(alert.created_at)}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
              {alert.affectedUserName && <p className="text-xs text-muted-foreground mb-2">Affected: {alert.affectedUserName}</p>}
              <div className="flex items-center gap-2">
                {alert.alertStatus === 'Active' && (
                  <>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleStatusChange(alert.id, 'Acknowledged')}><Eye className="h-3 w-3 mr-1" /> Acknowledge</Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleStatusChange(alert.id, 'Resolved')}><ShieldCheck className="h-3 w-3 mr-1" /> Resolve</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => handleStatusChange(alert.id, 'Dismissed')}>Dismiss</Button>
                  </>
                )}
                {alert.alertStatus === 'Acknowledged' && <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleStatusChange(alert.id, 'Resolved')}><ShieldCheck className="h-3 w-3 mr-1" /> Resolve</Button>}
                {(alert.alertStatus === 'Resolved' || alert.alertStatus === 'Dismissed') && <Badge variant="secondary" className="text-xs">{alert.alertStatus}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button></div>
    </div>
  );
}
