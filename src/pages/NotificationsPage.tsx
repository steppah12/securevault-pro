import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationsRead } from '@/lib/api';
import { Card, CardContent, Button, Skeleton } from '@/components/ui';
import { Bell, Share2, ShieldAlert, Download, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils';

const typeIcons: Record<string, any> = { Share: Share2, Security: ShieldAlert, Download: Download, System: Megaphone };

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try { const res = await getNotifications({ offset: page * 20, limit: 20 }); setNotifications(res.records); setHasMore(res.hasMore); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [page]);

  const handleMarkAllRead = async () => {
    try { await markNotificationsRead({ markAll: true }); toast.success('All marked as read'); fetchNotifications(); } catch (e) { console.error(e); }
  };
  const handleMarkRead = async (id: string) => {
    try { await markNotificationsRead({ notificationId: id }); setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n)); } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-normal">Notifications</h1>
        <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>Mark all read</Button>
      </div>
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : notifications.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><Bell className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No notifications yet</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <Card key={n.id} className={`cursor-pointer transition-colors hover:border-primary/30 ${!n.is_read ? 'bg-primary/5 border-primary/20' : ''}`}
                onClick={() => { handleMarkRead(n.id); if (n.link_url) navigate(n.link_url); }}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${!n.is_read ? 'bg-primary/15' : 'bg-muted'}`}><Icon className={`h-4 w-4 ${!n.is_read ? 'text-primary' : 'text-muted-foreground'}`} /></div>
                    <div>
                      <p className={`text-sm ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                  {!n.is_read && <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
