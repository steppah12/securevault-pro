import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getDashboardData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@/components/ui';
import { FileText, Share2, Shield, Bell } from 'lucide-react';
import { timeAgo, fileIcon } from '@/lib/utils';
import { CLEARANCE_LEVELS } from '@/types/database';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getDashboardData().then(setData).catch((e) => console.error(e)).finally(() => setLoading(false));
  }, [user?.id]);

  const clearance = CLEARANCE_LEVELS[user?.role || 'Employee'];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      </div>
    );
  }

  const stats = [
    { label: 'My Documents', value: data?.myDocumentsCount || 0, icon: FileText, accent: 'bg-primary/15 text-primary', onClick: () => navigate('/documents') },
    { label: 'Shared With Me', value: data?.sharedWithMeCount || 0, icon: Share2, accent: 'bg-primary/15 text-primary', onClick: () => navigate('/shared') },
    { label: 'Clearance', value: `Level ${clearance.level}`, icon: Shield, accent: 'bg-accent/15 text-accent', onClick: () => navigate('/profile') },
    { label: 'Unread Alerts', value: data?.unreadAlertsCount || 0, icon: Bell, accent: 'bg-destructive/15 text-destructive', onClick: () => navigate('/notifications') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-normal">Welcome back, {user?.first_name || 'User'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.role || 'Employee'} · <span className={clearance.color}>{clearance.label}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="cursor-pointer hover:border-primary/30 transition-colors group" onClick={s.onClick}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground font-medium">{s.label}</p><p className="text-2xl font-display font-normal mt-1.5">{s.value}</p></div>
                <div className={`h-11 w-11 rounded-xl ${s.accent} flex items-center justify-center group-hover:scale-110 transition-transform`}><s.icon className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Recent Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.recentDocuments || []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No documents yet</p>}
            {(data?.recentDocuments || []).map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/documents/${doc.id}`)}>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{fileIcon(doc.file_type)}</span>
                  <div><span className="text-sm font-medium truncate block max-w-[200px]">{doc.filename}</span><span className="text-xs text-muted-foreground">{doc.file_type}</span></div>
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(doc.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Recent Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.recentNotifications || []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No notifications</p>}
            {(data?.recentNotifications || []).map((n: any) => (
              <div key={n.id} className={`p-3 rounded-lg border border-border cursor-pointer transition-colors hover:bg-muted/30 ${!n.is_read ? 'bg-primary/5 border-primary/20' : ''}`} onClick={() => navigate('/notifications')}>
                <div className="flex items-center justify-between"><p className="text-sm font-medium">{n.title}</p>{!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
