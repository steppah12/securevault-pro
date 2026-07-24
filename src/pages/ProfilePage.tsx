import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { updateProfile, uploadAvatar } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Avatar, AvatarFallback, AvatarImage, Badge, Separator } from '@/components/ui';
import { Camera, Shield, Lock, Eye, FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { CLEARANCE_LEVELS } from '@/types/database';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const initials = `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || 'U';
  const clearance = CLEARANCE_LEVELS[user?.role || 'Employee'];
  const riskScore = user?.risk_score || 0;

  const handleSave = async () => {
    setSaving(true);
    try { await updateProfile({ firstName, lastName, phone }); await refreshProfile(); toast.success('Profile updated'); } catch { toast.error('Update failed'); }
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const { fileUrl } = await uploadAvatar(file, user.id);
      await updateProfile({ profilePhotoUrl: fileUrl });
      await refreshProfile();
      toast.success('Photo updated');
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const clearancePerms = [
    { level: 0, label: 'Public', desc: 'Access public documents', icon: Eye },
    { level: 1, label: 'Internal', desc: 'View internal company files', icon: FileText },
    { level: 2, label: 'Confidential', desc: 'Handle confidential data', icon: Lock },
    { level: 3, label: 'Restricted', desc: 'Access restricted materials', icon: Shield },
    { level: 4, label: 'Top Secret', desc: 'Full administrative access', icon: ShieldCheck },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-normal">Profile & Settings</h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-28 w-28 border-2 border-primary/20">
                  {user?.profile_photo_url && <AvatarImage src={user.profile_photo_url} />}
                  <AvatarFallback className="bg-primary/15 text-primary text-2xl font-display font-normal">{initials}</AvatarFallback>
                </Avatar>
                <label className="absolute bottom-1 right-1 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" /><input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              {uploading && <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>}
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-xs text-muted-foreground">First Name</Label><Input className="mt-1" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div><Label className="text-xs text-muted-foreground">Last Name</Label><Input className="mt-1" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><Input className="mt-1 bg-muted/50" value={user?.email || ''} disabled /></div>
              {user?.employee_id && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><span className="font-mono font-bold text-primary text-sm">ID</span></div>
                  <div><p className="text-xs text-muted-foreground">Employee ID</p><p className="text-lg font-mono font-bold">#{user.employee_id}</p></div>
                </div>
              )}
              <div><Label className="text-xs text-muted-foreground">Phone</Label><Input className="mt-1" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0000" /></div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                <Button variant="outline" onClick={() => { setFirstName(user?.first_name || ''); setLastName(user?.last_name || ''); setPhone(user?.phone || ''); }}>Cancel</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Security Clearance</CardTitle>
            <span className={`${clearance.color} font-semibold`}>{clearance.label}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {clearancePerms.map(perm => {
              const granted = clearance.level >= perm.level;
              return (
                <div key={perm.level} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${granted ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30 opacity-40'}`}>
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center ${granted ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}><perm.icon className="h-4 w-4" /></div>
                  <div className="flex-1"><p className="text-sm font-medium">{perm.label}</p><p className="text-xs text-muted-foreground">{perm.desc}</p></div>
                  {granted ? <Badge variant="outline" className="text-xs text-primary border-primary/30">✓ Granted</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Locked</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" /> Account Security</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-muted/20"><p className="text-xs text-muted-foreground">Account Status</p><Badge variant={user?.status === 'Locked' ? 'destructive' : 'default'} className="mt-1.5">{user?.status || 'Active'}</Badge></div>
            <div className="p-4 rounded-lg border border-border bg-muted/20"><p className="text-xs text-muted-foreground">Risk Score</p><p className={`text-xl font-display font-normal mt-1 ${riskScore >= 40 ? 'text-destructive' : riskScore >= 20 ? 'text-accent' : 'text-primary'}`}>{riskScore}</p></div>
            <div className="p-4 rounded-lg border border-border bg-muted/20"><p className="text-xs text-muted-foreground">Role</p><Badge variant="outline" className="mt-1.5">{user?.role || 'Employee'}</Badge></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
