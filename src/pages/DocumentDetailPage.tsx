import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getDocumentDetail, deleteDocument, shareDocumentMultiple, broadcastDocument, listShareableUsers, getFileUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Label, Switch, Separator,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui';
import { ArrowLeft, Download, Share2, Trash2, ShieldCheck, ShieldAlert, Lock, EyeOff, Plus, X, Megaphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, formatBytes, classificationBadge, fileIcon, timeAgo } from '@/lib/utils';

interface RecipientEntry { userId: string; permission: string; }

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [verifying, setVerifying] = useState(false);

  const [recipients, setRecipients] = useState<RecipientEntry[]>([{ userId: '', permission: 'Read Only' }]);
  const [noDownload, setNoDownload] = useState(false);
  const [noShare, setNoShare] = useState(false);
  const [shareExpiry, setShareExpiry] = useState('');
  const [shareLimit, setShareLimit] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [broadcastPerm, setBroadcastPerm] = useState('Read Only');
  const [broadcastNoDownload, setBroadcastNoDownload] = useState(false);
  const [broadcastNoShare, setBroadcastNoShare] = useState(true);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const load = () => { if (!id) return; setLoading(true); getDocumentDetail(id).then(setData).catch(() => toast.error('Document not found')).finally(() => setLoading(false)); };
  useEffect(load, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try { await deleteDocument(id); toast.success('Document deleted'); navigate('/documents'); } catch (e: any) { toast.error(e.message || 'Delete failed'); }
  };

  const openShare = async () => {
    setShareOpen(true);
    if (allUsers.length === 0) {
      const res = await listShareableUsers();
      setAllUsers(res.users.filter((u: any) => u.id !== user?.id));
    }
  };

  const addRecipient = () => setRecipients(prev => [...prev, { userId: '', permission: 'Read Only' }]);
  const removeRecipient = (i: number) => setRecipients(prev => prev.filter((_, idx) => idx !== i));
  const updateRecipient = (i: number, field: string, val: string) => setRecipients(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const handleShare = async () => {
    if (!id) return;
    const valid = recipients.filter(r => r.userId);
    if (valid.length === 0) return;
    setSharing(true);
    try {
      const res = await shareDocumentMultiple({
        documentId: id, recipients: valid.map(r => ({ userId: r.userId, permission: r.permission as any })),
        noDownload, noShare, expiresAt: shareExpiry || undefined, downloadLimit: shareLimit ? parseInt(shareLimit) : undefined, allowOverride,
      });
      if (res.clearanceViolations.length > 0) toast.warning(`${res.clearanceViolations.length} recipient(s) blocked by clearance`, { description: res.clearanceViolations[0] });
      else toast.success(`Shared with ${res.shares} recipient(s)`);
      setShareOpen(false);
      setRecipients([{ userId: '', permission: 'Read Only' }]);
      load();
    } catch (e: any) { toast.error(e?.message || 'Share failed'); }
    setSharing(false);
  };

  const handleBroadcast = async () => {
    if (!id) return;
    setBroadcasting(true);
    try {
      const res = await broadcastDocument({ documentId: id, permission: broadcastPerm as any, noDownload: broadcastNoDownload, noShare: broadcastNoShare, message: broadcastMessage || undefined });
      toast.success(`Broadcast to ${res.count} cleared employee(s)`);
      setBroadcastOpen(false);
    } catch (e: any) { toast.error(e?.message || 'Broadcast failed'); }
    setBroadcasting(false);
  };

  const handleVerify = async () => {
    if (!id) return;
    setVerifying(true);
    try {
      const { data: json, error: fnError } = await supabase.functions.invoke('verify-document', {
        body: { documentId: id },
      });
      if (fnError) {
        toast.error('Verification service error — see console for details');
        console.error('verify-document failed:', fnError);
        return;
      }
      if (json.valid) toast.success('Integrity verified — hash matches stored signature');
      else toast.error('Integrity check FAILED — file or hash may have been tampered with');
    } catch (e) {
      toast.error('Could not reach verification service — check the Edge Function is deployed');
      console.error(e);
    }
    setVerifying(false);
  };

  const handleResign = async () => {
    if (!id) return;
    setVerifying(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('sign-document', {
        body: { documentId: id },
      });
      if (fnError) {
        toast.error('Signing failed — see console for details');
        console.error('sign-document failed:', fnError);
      } else {
        toast.success('Document signed');
        load();
      }
    } catch (e) {
      toast.error('Could not reach signing service — check the Edge Function is deployed');
      console.error(e);
    }
    setVerifying(false);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  if (!data) return <p className="text-center py-16 text-muted-foreground">Document not found</p>;

  const doc = data.document;
  const cls = classificationBadge(doc.classification);
  const sig = data.signatureInfo;
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Manager';
  const isOwner = doc.owner === user?.id;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/documents')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Documents
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{fileIcon(doc.file_type)}</span>
          <div><h1 className="text-xl font-display font-normal">{doc.filename}</h1><p className="text-sm text-muted-foreground">Uploaded by {data.ownerName} · {formatBytes(doc.size_bytes)}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => window.open(await getFileUrl(doc.file_path), '_blank')} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button>
          {(isOwner || user?.role === 'Administrator') && <Button onClick={openShare} className="gap-1.5"><Share2 className="h-4 w-4" /> Share</Button>}
          {isAdmin && <Button variant="secondary" onClick={() => setBroadcastOpen(true)} className="gap-1.5"><Megaphone className="h-4 w-4" /> Broadcast</Button>}
          {(isOwner || user?.role === 'Administrator') && <Button variant="outline" size="icon" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={`border-l-4 ${sig.isVerified ? 'border-l-primary' : 'border-l-destructive'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {sig.isVerified ? (
                    <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center"><ShieldAlert className="h-5 w-5 text-destructive" /></div>
                  )}
                  <div><p className="text-sm font-semibold">{sig.status === 'Pending' ? 'Signing in progress...' : sig.isVerified ? 'HMAC-SHA256 Signature Verified' : 'Signature Unverified'}</p>
                    <p className="text-xs text-muted-foreground">Computed server-side from the actual stored bytes</p></div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={sig.status === 'Verified' ? handleVerify : handleResign} disabled={verifying}>
                  <RefreshCw className={`h-3 w-3 ${verifying ? 'animate-spin' : ''}`} /> {sig.status === 'Verified' ? 'Re-verify' : 'Sign now'}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded bg-muted/30 border border-border"><p className="text-muted-foreground mb-0.5">SHA-256 Hash</p><code className="text-foreground font-mono text-[11px] break-all">{sig.contentHash}</code></div>
                <div className="p-2 rounded bg-muted/30 border border-border"><p className="text-muted-foreground mb-0.5">HMAC Signature</p><code className="text-foreground font-mono text-[11px] break-all">{sig.signature}</code></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div><span className="text-muted-foreground">Classification:</span> <span className={`ml-1 ${cls.className}`}>{cls.label}</span></div>
                <div><span className="text-muted-foreground">File Type:</span> {doc.file_type}</div>
                <div><span className="text-muted-foreground">Version:</span> v{doc.version || 1}</div>
                <div><span className="text-muted-foreground">Retention:</span> {doc.retention_period || '—'}</div>
                <div><span className="text-muted-foreground">Uploaded:</span> {formatDateTime(doc.created_at)}</div>
                <div><span className="text-muted-foreground">Updated:</span> {formatDateTime(doc.updated_at)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Version History</CardTitle></CardHeader>
            <CardContent>
              {data.versions.length === 0 ? <p className="text-sm text-muted-foreground py-3">No prior versions</p> : (
                <div className="space-y-2">
                  {data.versions.map((v: any, i: number) => (
                    <div key={v.id} className="flex items-center justify-between text-sm p-2.5 rounded-md border border-border">
                      <div className="flex items-center gap-2"><span className="font-medium">v{v.version_number}</span><span className="text-muted-foreground">{timeAgo(v.created_at)}</span></div>
                      {i === 0 && <Badge className="text-xs">Current</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Active Shares ({data.shares.length})</CardTitle></CardHeader>
          <CardContent>
            {data.shares.length === 0 ? <p className="text-sm text-muted-foreground py-3">Not shared with anyone</p> : (
              <div className="space-y-3">
                {data.shares.map((s: any) => (
                  <div key={s.id} className="p-3 rounded-lg border border-border space-y-1.5">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium truncate">{s.recipientName || 'User'}</p><Badge variant="outline" className="text-[10px]">{s.permission}</Badge></div>
                    {s.recipientRole && <p className="text-[11px] text-muted-foreground">{s.recipientRole}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {s.no_download && <Badge variant="secondary" className="text-[10px] gap-0.5"><EyeOff className="h-2.5 w-2.5" /> No DL</Badge>}
                      {s.no_share && <Badge variant="secondary" className="text-[10px] gap-0.5"><Lock className="h-2.5 w-2.5" /> No Share</Badge>}
                      {s.expires_at && <Badge variant="secondary" className="text-[10px]">Exp {new Date(s.expires_at).toLocaleDateString()}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Share Document</DialogTitle><DialogDescription>Recipients below their clearance level are blocked by default.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Recipients</Label>
              {recipients.map((r, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Select value={r.userId} onValueChange={v => updateRecipient(i, 'userId', v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select user..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Select user...</SelectItem>
                        {allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={r.permission} onValueChange={v => updateRecipient(i, 'permission', v)}>
                    <SelectTrigger className="w-[120px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Read Only">Read Only</SelectItem><SelectItem value="Editable">Editable</SelectItem></SelectContent>
                  </Select>
                  {recipients.length > 1 && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeRecipient(i)}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addRecipient}><Plus className="h-3 w-3" /> Add Recipient</Button>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2"><EyeOff className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">No Download</p></div></div>
                <Switch checked={noDownload} onCheckedChange={setNoDownload} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">No Resharing</p></div></div>
                <Switch checked={noShare} onCheckedChange={setNoShare} />
              </div>
              {(user?.role === 'Administrator' || user?.role === 'Manager') && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-accent/30 bg-accent/5">
                  <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-accent" /><div><p className="text-sm font-medium">Override clearance</p><p className="text-xs text-muted-foreground">Allows sharing below required clearance (audited)</p></div></div>
                  <Switch checked={allowOverride} onCheckedChange={setAllowOverride} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Expiration</Label><Input type="datetime-local" className="mt-1" value={shareExpiry} onChange={e => setShareExpiry(e.target.value)} /></div>
              <div><Label className="text-xs">Download Limit</Label><Input type="number" className="mt-1" placeholder="Unlimited" value={shareLimit} onChange={e => setShareLimit(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button onClick={handleShare} disabled={sharing || !recipients.some(r => r.userId)}>{sharing ? 'Sharing...' : 'Share'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Broadcast</DialogTitle><DialogDescription>Sends to every active employee whose clearance covers "{doc.classification}".</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Permission</Label>
              <Select value={broadcastPerm} onValueChange={setBroadcastPerm}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Read Only">Read Only</SelectItem><SelectItem value="Editable">Editable</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Message (optional)</Label><Input className="mt-1" value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} /></div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border"><span className="text-sm">No Download</span><Switch checked={broadcastNoDownload} onCheckedChange={setBroadcastNoDownload} /></div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border"><span className="text-sm">No Resharing</span><Switch checked={broadcastNoShare} onCheckedChange={setBroadcastNoShare} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button onClick={handleBroadcast} disabled={broadcasting}>{broadcasting ? 'Broadcasting...' : 'Broadcast Now'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{doc.filename}"?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this document.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
