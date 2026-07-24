import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchDocuments } from '@/lib/api';
import { Card, CardContent, Button, Input, Badge, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Search } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { formatDate, classificationBadge, fileIcon } from '@/lib/utils';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [classification, setClassification] = useState('');
  const [fileType, setFileType] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setHasSearched(false); return; }
    setLoading(true); setHasSearched(true);
    try {
      const res = await searchDocuments({ query: q, classification: classification || undefined, fileType: fileType || undefined });
      setResults(res.records);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [classification, fileType]);

  const debouncedSearch = useDebouncedCallback((val: string) => doSearch(val), 300);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-normal">Search Documents</h1>
      <p className="text-xs text-muted-foreground -mt-4">Results are limited to documents you own or have been explicitly shared, within your clearance.</p>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Search by filename..." className="pl-11 h-12 text-base" value={query} onChange={e => { setQuery(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      <div className="flex gap-3">
        <Select value={classification} onValueChange={v => { setClassification(v === 'all' ? '' : v); if (query) doSearch(query); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Classification" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="Public">Public</SelectItem><SelectItem value="Internal">Internal</SelectItem><SelectItem value="Confidential">Confidential</SelectItem><SelectItem value="Restricted">Restricted</SelectItem></SelectContent>
        </Select>
        <Select value={fileType} onValueChange={v => { setFileType(v === 'all' ? '' : v); if (query) doSearch(query); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="File Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="PDF">PDF</SelectItem><SelectItem value="Word">Word</SelectItem><SelectItem value="Excel">Excel</SelectItem><SelectItem value="Image">Image</SelectItem></SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !hasSearched ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground"><Search className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">Type to search documents you can access</p></div>
      ) : results.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground">No results found for "{query}"</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{results.length} results for "{query}"</p>
          <div className="space-y-2">
            {results.map(doc => {
              const cls = classificationBadge(doc.classification);
              return (
                <Card key={doc.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(`/documents/${doc.id}`)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{fileIcon(doc.file_type)}</span>
                      <div><p className="text-sm font-medium">{doc.filename}</p><p className="text-xs text-muted-foreground">{doc.ownerName} · <span className={cls.className}>{cls.label}</span> · {formatDate(doc.created_at)}</p></div>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs">Open</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
