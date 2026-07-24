import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSharedWithMe, getFileUrl } from '@/lib/api';
import { Card, CardContent, Button, Input, Badge, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Search, Download, Share2, Lock, EyeOff, Clock, ShieldCheck } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

export default function SharedWithMePage() {
  const navigate = useNavigate();
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [permission, setPermission] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSharedWithMe({ search: search || undefined, permission: permission || undefined, offset: page * 20, limit: 20 });
      setShares(result.records);
      setHasMore(result.hasMore);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, permission, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const debouncedSearch = useDebouncedCallback((val: string) => { setSearch(val); setPage(0); }, 300);

  const isExpired = (s: any) => s.expires_at && new Date(s.expires_at) < new Date();
  const downloadsExhausted = (s: any) => s.download_limit && s.downloads_used >= s.download_limit;

  const handleDownload = async (path: string) => {
    try { window.open(await getFileUrl(path), '_blank'); } catch { toast.error('Could not generate link'); }
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-display font-normal">Shared With Me</h1><p className="text-sm text-muted-foreground mt-0.5">Files others have shared with you</p></div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search shared files..." className="pl-9" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        <Select value={permission} onValueChange={v => { setPermission(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Permission" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="Read Only">Read Only</SelectItem><SelectItem value="Editable">Editable</SelectItem></SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : shares.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground"><Share2 className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No shared files</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {shares.map(share => {
            const expired = isExpired(share);
            const noDownloads = downloadsExhausted(share);
            const restricted = expired || noDownloads;
            return (
              <Card key={share.id} className={`transition-colors ${restricted ? 'opacity-50' : 'hover:border-primary/30 cursor-pointer'}`} onClick={() => !restricted && navigate(`/documents/${share.document}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">📄</div>
                      <div><p className="font-medium text-sm">{share.documentName}</p><p className="text-xs text-muted-foreground">from {share.sharerName} · {timeAgo(share.created_at)}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{share.permission}</Badge>
                      {!restricted && !share.no_download && share.documentPath && (
                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={e => { e.stopPropagation(); handleDownload(share.documentPath); }}><Download className="h-3 w-3" /> Download</Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[10px] gap-0.5"><ShieldCheck className="h-2.5 w-2.5" /> Encrypted</Badge>
                    {share.no_download && <Badge variant="secondary" className="text-[10px] gap-0.5"><EyeOff className="h-2.5 w-2.5" /> No Download</Badge>}
                    {share.no_share && <Badge variant="secondary" className="text-[10px] gap-0.5"><Lock className="h-2.5 w-2.5" /> No Reshare</Badge>}
                    {share.expires_at && <Badge variant={expired ? 'destructive' : 'secondary'} className="text-[10px] gap-0.5"><Clock className="h-2.5 w-2.5" /> {expired ? `Expired ${formatDate(share.expires_at)}` : `Exp ${formatDate(share.expires_at)}`}</Badge>}
                    {share.download_limit && <Badge variant="secondary" className="text-[10px]">{share.downloads_used || 0}/{share.download_limit} downloads</Badge>}
                  </div>
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
