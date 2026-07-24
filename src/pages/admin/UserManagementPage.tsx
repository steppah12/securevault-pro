import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getUsersByLevel, updateUser, suspendUser, deleteUser } from '@/lib/api';
import {
  Card, CardContent, Button, Input, Badge, Skeleton, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui';
import { Search, Shield, Pause, Play, Trash2, UserCog, Hash, Users as UsersIcon, AlertTriangle } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { CLEARANCE_LEVELS, type Role } from '@/types/database';
import { timeAgo } from '@/lib/utils';

export default function UserManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [counts, setCounts] = useState<any>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [editUser, setEditUser] = useState<any>(null);
  const [editRole, setEditRole] = useState('');
  const [editDept, setEditDept] = useState('');
  const [assignId, setAssignId] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsersByLevel({ role: roleFilter || undefined, status: statusFilter || undefined, search: search || undefined, offset: page * 30, limit: 30 });
      setUsers(res.users); setCounts(res.counts); setDepartments(res.departments); setHasMore(res.hasMore);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [roleFilter, statusFilter, search, page]);

  useEffect(() => {
    if (user?.role !== 'Administrator' && user?.role !== 'Security Officer') navigate('/'); else fetchUsers();
  }, [user, fetchUsers, navigate]);

  const debouncedSearch = useDebouncedCallback((val: string) => { setSearch(val); setPage(0); }, 300);

  const openEdit = (u: any) => { setEditUser(u); setEditRole(u.role || 'Employee'); setEditDept(u.department || ''); setAssignId(!u.employee_id); };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await updateUser({ userId: editUser.id, role: editRole !== editUser.role ? (editRole as any) : undefined, departmentId: editDept || undefined, assignEmployeeId: assignId && !editUser.employee_id });
      toast.success('User updated'); setEditUser(null); fetchUsers();
    } catch (e: any) { toast.error(e?.message || 'Update failed'); }
    setSaving(false);
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    try {
      const action = suspendTarget.status === 'Locked' ? 'unsuspend' : 'suspend';
      const res = await suspendUser({ userId: suspendTarget.id, action, reason: suspendReason || undefined });
      toast.success(res.message); setSuspendTarget(null); setSuspendReason(''); fetchUsers();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { const res = await deleteUser(deleteTarget.id); toast.success(res.message); setDeleteTarget(null); fetchUsers(); } catch (e: any) { toast.error(e?.message || 'Cannot delete'); }
  };

  const canDelete = (u: any) => {
    if (u.status !== 'Locked' || !u.suspended_at) return false;
    const days = (Date.now() - new Date(u.suspended_at).getTime()) / 86400000;
    return days >= 7;
  };
  const daysUntilDelete = (u: any) => {
    if (!u.suspended_at) return 7;
    const days = (Date.now() - new Date(u.suspended_at).getTime()) / 86400000;
    return Math.max(0, Math.ceil(7 - days));
  };

  const roleStats = [
    { role: 'Administrator', count: counts.administrator || 0, color: 'bg-destructive/15 text-destructive border-destructive/20' },
    { role: 'Security Officer', count: counts.securityOfficer || 0, color: 'bg-accent/15 text-accent border-accent/20' },
    { role: 'Manager', count: counts.manager || 0, color: 'bg-primary/15 text-primary border-primary/20' },
    { role: 'Employee', count: counts.employee || 0, color: 'bg-secondary text-secondary-foreground border-border' },
    { role: 'Guest', count: counts.guest || 0, color: 'bg-muted text-muted-foreground border-border' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-normal">User Management</h1><p className="text-sm text-muted-foreground">{counts.total || 0} total users across all clearance levels</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {roleStats.map(r => (
          <button key={r.role} onClick={() => { setRoleFilter(roleFilter === r.role ? '' : r.role); setPage(0); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${roleFilter === r.role ? 'ring-2 ring-primary' : ''} ${r.color}`}>
            <Shield className="h-3.5 w-3.5" /><span className="font-medium">{r.role}</span><span className="font-bold">{r.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by email..." className="pl-9" onChange={e => debouncedSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Locked">Suspended</SelectItem><SelectItem value="Disabled">Disabled</SelectItem></SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground"><UsersIcon className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No users found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Role / Clearance</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Risk</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-36">Actions</th>
                </tr></thead>
                <tbody>
                  {users.map(u => {
                    const cl = CLEARANCE_LEVELS[(u.role || 'Employee') as Role];
                    const isSuspended = u.status === 'Locked';
                    const isDisabled = u.status === 'Disabled';
                    return (
                      <tr key={u.id} className={`border-b border-border transition-colors ${isSuspended ? 'bg-destructive/5' : isDisabled ? 'opacity-40' : 'hover:bg-muted/30'}`}>
                        <td className="px-4 py-3"><div><p className="font-medium truncate max-w-[180px]">{u.first_name || ''} {u.last_name || ''}</p><p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p></div></td>
                        <td className="px-4 py-3">{u.employee_id ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">#{u.employee_id}</code> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3"><div className="flex flex-col gap-1"><Badge variant="outline" className="text-xs w-fit">{u.role || 'Employee'}</Badge><span className="text-[10px] text-muted-foreground">{cl.label}</span></div></td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge variant={isSuspended ? 'destructive' : isDisabled ? 'secondary' : 'default'} className="text-xs">{isSuspended ? 'Suspended' : u.status || 'Active'}</Badge>
                          {isSuspended && u.suspended_at && <p className="text-[10px] text-muted-foreground mt-0.5">Since {timeAgo(u.suspended_at)}</p>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell"><span className={`text-sm font-bold ${(u.risk_score || 0) >= 40 ? 'text-destructive' : (u.risk_score || 0) >= 20 ? 'text-accent' : 'text-muted-foreground'}`}>{u.risk_score || 0}</span></td>
                        <td className="px-4 py-3">
                          {u.role !== 'Administrator' && !isDisabled && (
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip><TooltipTrigger><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><UserCog className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Edit role & clearance</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSuspendTarget(u)}>{isSuspended ? <Play className="h-4 w-4 text-primary" /> : <Pause className="h-4 w-4 text-accent" />}</Button></TooltipTrigger><TooltipContent>{isSuspended ? 'Reactivate' : 'Suspend'}</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger><Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canDelete(u)} onClick={() => canDelete(u) && setDeleteTarget(u)}><Trash2 className={`h-4 w-4 ${canDelete(u) ? 'text-destructive' : 'text-muted-foreground/30'}`} /></Button></TooltipTrigger>
                                  <TooltipContent>{canDelete(u) ? 'Permanently delete' : isSuspended ? `Delete available in ${daysUntilDelete(u)} day(s)` : 'Must suspend first (7-day wait)'}</TooltipContent></Tooltip>
                              </TooltipProvider>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User: {editUser?.email}</DialogTitle><DialogDescription>Assign clearance level, department, and employee ID</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Clearance Level / Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Guest">Guest — Level 0</SelectItem>
                  <SelectItem value="Employee">Employee — Level 1</SelectItem>
                  <SelectItem value="Manager">Manager — Level 2</SelectItem>
                  <SelectItem value="Security Officer">Security Officer — Level 3</SelectItem>
                  {user?.role === 'Administrator' && <SelectItem value="Administrator">Administrator — Level 4</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Department</Label>
              <Select value={editDept} onValueChange={setEditDept}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department..." /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!editUser?.employee_id && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Assign Employee ID</p><p className="text-xs text-muted-foreground">Auto-generate from department range</p></div></div>
                <input type="checkbox" checked={assignId} onChange={e => setAssignId(e.target.checked)} className="h-4 w-4 rounded" />
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{suspendTarget?.status === 'Locked' ? <Play className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-accent" />}{suspendTarget?.status === 'Locked' ? 'Reactivate Account' : 'Suspend Account'}</DialogTitle>
            <DialogDescription>{suspendTarget?.status === 'Locked' ? `Reactivate ${suspendTarget?.email}?` : `Suspend ${suspendTarget?.email}? Deletion available after 7 days.`}</DialogDescription>
          </DialogHeader>
          {suspendTarget?.status !== 'Locked' && <div><Label className="text-xs">Reason</Label><Input className="mt-1" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} /></div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant={suspendTarget?.status === 'Locked' ? 'default' : 'destructive'} onClick={handleSuspend}>{suspendTarget?.status === 'Locked' ? 'Reactivate' : 'Suspend Account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Permanently Delete Account</AlertDialogTitle><AlertDialogDescription>This will permanently disable {deleteTarget?.email}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete Permanently</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
