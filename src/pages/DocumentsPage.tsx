import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getDocuments, uploadDocument, deleteDocument, getFileUrl } from '@/lib/api';
import {
  Card, CardContent, Button, Input, Badge, Skeleton, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui';
import { Upload, Search, MoreHorizontal, Download, Trash2, Eye, FileText, ShieldCheck } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { formatDate, formatBytes, classificationBadge, fileIcon } from '@/lib/utils';

export default function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState('');
  const [fileType, setFileType] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadClassification, setUploadClassification] = useState('Internal');

  const fetchDocs = useCallback(async (s?: string) => {
    setLoading(true);
    try {
      const result = await getDocuments({ search: s ?? search, classification: classification || undefined, fileType: fileType || undefined, offset: page * 20, limit: 20 });
      setDocs(result.records);
      setHasMore(result.hasMore);
    } catch (e: any) { toast.error(e.message || 'Failed to load documents'); }
    setLoading(false);
  }, [search, classification, fileType, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  const debouncedSearch = useDebouncedCallback((val: string) => { setPage(0); fetchDocs(val); }, 300);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await uploadDocument(file, uploadClassification as any, user.id);
      toast.success('File uploaded and signed');
      setUploadOpen(false);
      fetchDocs();
    } catch (err: any) { toast.error(err?.message || 'Upload failed'); }
    setUploading(false);
  };

  const handleDownload = async (path: string) => {
    try { const url = await getFileUrl(path); window.open(url, '_blank'); } catch { toast.error('Could not generate download link'); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteDocument(deleteId); toast.success('Document deleted'); setDeleteId(null); fetchDocs(); } catch (e: any) { toast.error(e.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-normal">My Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload and manage all your files</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Upload</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
        </div>
        <Select value={classification} onValueChange={v => { setClassification(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Classification" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Public">Public</SelectItem>
            <SelectItem value="Internal">Internal</SelectItem>
            <SelectItem value="Confidential">Confidential</SelectItem>
            <SelectItem value="Restricted">Restricted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fileType} onValueChange={v => { setFileType(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="File Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="Word">Word</SelectItem>
            <SelectItem value="Excel">Excel</SelectItem>
            <SelectItem value="Image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" /><p className="text-sm">No files found</p>
              <Button variant="outline" className="mt-3" onClick={() => setUploadOpen(true)}>Upload your first file</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Classification</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Signature</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Size</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Uploaded</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(doc => {
                    const cls = classificationBadge(doc.classification);
                    return (
                      <tr key={doc.id} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><span>{fileIcon(doc.file_type)}</span><span className="truncate max-w-[250px] font-medium">{doc.filename}</span></div></td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{doc.file_type}</td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className={cls.className}>{cls.label}</span></td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {doc.signature_status === 'Verified' ? <div className="flex items-center gap-1 text-primary text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Verified</div> : <span className="text-xs text-muted-foreground">{doc.signature_status}</span>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{formatBytes(doc.size_bytes)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{formatDate(doc.created_at)}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/documents/${doc.id}`)}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(doc.file_path)}><Download className="h-4 w-4 mr-2" /> Download</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(doc.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Page {page + 1}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>Files are hashed (SHA-256) and HMAC-signed server-side upon upload.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label>File</Label>
              <Input type="file" className="mt-1" required />
              <p className="text-xs text-muted-foreground mt-1">Max 100MB · Documents, spreadsheets, presentations, images, audio, video, archives</p>
            </div>
            <div>
              <Label>Classification</Label>
              <Select value={uploadClassification} onValueChange={setUploadClassification}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="Confidential">Confidential</SelectItem>
                  <SelectItem value="Restricted">Restricted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" /> This file will be hashed and HMAC-signed after upload.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload & Sign'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Document</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
