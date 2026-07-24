import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { manageIdRanges } from '@/lib/api';
import { Card, CardContent, Button, Input, Label, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui';
import { Plus, Trash2, Hash, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminIdRangesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ranges, setRanges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user?.role !== 'Administrator') { navigate('/'); return; } fetchRanges(); }, [user, navigate]);

  const fetchRanges = async () => {
    setLoading(true);
    try { const res = await manageIdRanges({ action: 'list' }); setRanges(res.ranges); if (res.departments) setDepartments(res.departments); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!label || !startId || !endId) return;
    setSaving(true);
    try {
      const res = await manageIdRanges({ action: 'create', rangeLabel: label, startId: parseInt(startId), endId: parseInt(endId), departmentId: deptId || undefined });
      toast.success(res.message || 'Range created');
      setCreateOpen(false); setLabel(''); setStartId(''); setEndId(''); setDeptId('');
      fetchRanges();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await manageIdRanges({ action: 'delete', id: deleteId }); toast.success('Range deleted'); setDeleteId(null); fetchRanges(); } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" />{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-normal">Employee ID Ranges</h1><p className="text-sm text-muted-foreground">Configure ID number ranges per department.</p></div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Range</Button>
      </div>

      {ranges.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><Hash className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No ID ranges configured</p><Button variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>Create your first range</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ranges.map(r => (
            <Card key={r.id} className="group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">{r.rangeLabel}</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 text-center p-2 rounded-lg bg-muted/50 border border-border"><p className="text-lg font-bold font-mono">{r.startId}</p><p className="text-[10px] text-muted-foreground">Start</p></div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-center p-2 rounded-lg bg-muted/50 border border-border"><p className="text-lg font-bold font-mono">{r.endId}</p><p className="text-[10px] text-muted-foreground">End</p></div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{r.departmentName || 'No department'}</span>
                  <div className="flex items-center gap-1.5"><span className="text-muted-foreground">Next:</span><code className="font-mono font-bold">{r.nextAvailableId || r.startId}</code></div>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, ((r.nextAvailableId || r.startId) - r.startId) / (r.endId - r.startId) * 100)}%` }} /></div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{(r.nextAvailableId || r.startId) - r.startId} / {r.endId - r.startId} used</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create ID Range</DialogTitle><DialogDescription>Employee IDs auto-assign from this range.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Label</Label><Input className="mt-1" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., Accounting IDs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Start ID</Label><Input type="number" className="mt-1" value={startId} onChange={e => setStartId(e.target.value)} placeholder="1" /></div>
              <div><Label className="text-xs">End ID</Label><Input type="number" className="mt-1" value={endId} onChange={e => setEndId(e.target.value)} placeholder="100" /></div>
            </div>
            <div><Label className="text-xs">Department (optional)</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Link to department..." /></SelectTrigger>
                <SelectContent><SelectItem value="">None</SelectItem>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !label || !startId || !endId}>{saving ? 'Creating...' : 'Create Range'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete ID Range?</AlertDialogTitle><AlertDialogDescription>Existing employee IDs won't be affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
