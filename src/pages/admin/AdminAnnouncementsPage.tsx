import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getAnnouncements, createAnnouncement, getDepartments } from '@/lib/api';
import { Card, CardContent, Button, Input, Badge, Skeleton, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui';
import { Megaphone, Plus, Users, Shield, Building } from 'lucide-react';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils';

const priorityColors: Record<string, string> = { Normal: 'bg-muted text-muted-foreground', Important: 'bg-accent/20 text-accent', Urgent: 'bg-destructive/20 text-destructive' };
const targetIcons: Record<string, any> = { 'All Employees': Users, 'Specific Department': Building, 'Clearance Level': Shield };

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [posting, setPosting] = useState(false);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('All Employees');
  const [targetDept, setTargetDept] = useState('');
  const [targetClearance, setTargetClearance] = useState('');
  const [priority, setPriority] = useState('Normal');

  useEffect(() => {
    if (user?.role !== 'Administrator' && user?.role !== 'Manager') { navigate('/'); return; }
    fetchAnnouncements();
    getDepartments().then(d => setDepartments(d.departments)).catch((e) => console.error(e));
  }, [user, navigate]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try { const res = await getAnnouncements({}); setAnnouncements(res.records); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handlePost = async () => {
    if (!title.trim() || !message.trim()) return;
    setPosting(true);
    try {
      const res = await createAnnouncement({ title, message, targetType, targetDepartmentId: targetType === 'Specific Department' ? targetDept : undefined, targetClearance: targetType === 'Clearance Level' ? targetClearance : undefined, priority });
      toast.success(`Announcement posted to ${res.notifiedCount} user(s)`);
      setCreateOpen(false); setTitle(''); setMessage(''); setTargetType('All Employees'); setPriority('Normal');
      fetchAnnouncements();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setPosting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-normal">Announcements</h1><p className="text-sm text-muted-foreground">Post messages to specific groups, departments, or all employees</p></div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Announcement</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : announcements.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><Megaphone className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No announcements yet</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const TargetIcon = targetIcons[a.targetType] || Users;
            return (
              <Card key={a.id} className={a.priority === 'Urgent' ? 'border-destructive/30' : a.priority === 'Important' ? 'border-accent/30' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2"><Badge className={`text-xs ${priorityColors[a.priority] || ''}`}>{a.priority}</Badge><h3 className="font-semibold">{a.title}</h3></div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{a.message}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>Posted by {a.posterName}</span><span className="flex items-center gap-1"><TargetIcon className="h-3 w-3" /> {a.targetType}{a.targetClearance ? `: ${a.targetClearance}` : ''}</span></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> New Announcement</DialogTitle><DialogDescription>This will notify all targeted users.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Title</Label><Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><Label className="text-xs">Message</Label><Textarea className="mt-1" rows={4} value={message} onChange={e => setMessage(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Target Audience</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="All Employees">All Employees</SelectItem><SelectItem value="Specific Department">Specific Department</SelectItem><SelectItem value="Clearance Level">Clearance Level</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Important">Important</SelectItem><SelectItem value="Urgent">Urgent</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {targetType === 'Specific Department' && (
              <div><Label className="text-xs">Department</Label>
                <Select value={targetDept} onValueChange={setTargetDept}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {targetType === 'Clearance Level' && (
              <div><Label className="text-xs">Clearance Level</Label>
                <Select value={targetClearance} onValueChange={setTargetClearance}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Guest">Guest — Level 0</SelectItem><SelectItem value="Employee">Employee — Level 1</SelectItem><SelectItem value="Manager">Manager — Level 2</SelectItem>
                    <SelectItem value="Security Officer">Security Officer — Level 3</SelectItem><SelectItem value="Administrator">Administrator — Level 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handlePost} disabled={posting || !title.trim() || !message.trim()}>{posting ? 'Posting...' : 'Post Announcement'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
