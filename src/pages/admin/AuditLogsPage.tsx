import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getAuditLogs, exportAuditLogs } from '@/lib/api';
import { Card, CardContent, Button, Input, Badge, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Search, Download, ScrollText } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils';

const riskColors: Record<string, string> = { Normal: 'bg-muted text-muted-foreground', Elevated: 'bg-accent/20 text-accent', Suspicious: 'bg-destructive/20 text-destructive', Critical: 'bg-destructive text-destructive-foreground' };

export default function AuditLogsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { if (user?.role !== 'Administrator' && user?.role !== 'Security Officer') navigate('/'); }, [user, navigate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try { const res = await getAuditLogs({ action: action || undefined, search: search || undefined, offset: page * 30, limit: 30 }); setLogs(res.records); setHasMore(res.hasMore); } catch (e) { console.error(e); }
    setLoading(false);
  }, [action, search, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  const debouncedSearch = useDebouncedCallback((val: string) => { setSearch(val); setPage(0); }, 300);

  const handleExport = async () => {
    try {
      const res = await exportAuditLogs({ action: action || undefined });
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'audit-logs.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported');
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-normal">Audit Logs</h1>
        <Button variant="outline" onClick={handleExport} className="gap-1.5"><Download className="h-4 w-4" /> Export CSV</Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search logs..." className="pl-9" onChange={e => debouncedSearch(e.target.value)} /></div>
        <Select value={action} onValueChange={v => { setAction(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem><SelectItem value="Login">Login</SelectItem><SelectItem value="Upload">Upload</SelectItem>
            <SelectItem value="Download">Download</SelectItem><SelectItem value="Delete">Delete</SelectItem><SelectItem value="Share">Share</SelectItem><SelectItem value="Admin Action">Admin Action</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground"><ScrollText className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No logs found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Time</th><th className="px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Action</th><th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Details</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Risk</th><th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr></thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{timeAgo(log.created_at)}</td>
                      <td className="px-4 py-3 truncate max-w-[160px]">{log.userEmail}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{log.action}</Badge></td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-[250px]">{log.details}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{log.riskLevel && log.riskLevel !== 'Normal' ? <Badge className={`text-xs ${riskColors[log.riskLevel] || ''}`}>{log.riskLevel}</Badge> : <span className="text-xs text-muted-foreground">Normal</span>}</td>
                      <td className="px-4 py-3"><Badge variant={log.status === 'Failed' ? 'destructive' : 'default'} className="text-xs">{log.status || 'Success'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Page {page + 1}</p>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button></div>
      </div>
    </div>
  );
}
