import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Classification } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function fileIcon(fileType: string | null | undefined): string {
  switch (fileType) {
    case 'PDF': return '📄';
    case 'Word': return '📝';
    case 'Excel': return '📊';
    case 'PowerPoint': return '📽️';
    case 'Image': return '🖼️';
    case 'ZIP': return '📦';
    case 'CSV': return '📊';
    case 'Video': return '🎬';
    case 'Audio': return '🎵';
    default: return '📄';
  }
}

export function classificationBadge(c: Classification | string | undefined): { label: string; className: string } {
  switch (c) {
    case 'Confidential': return { label: 'Confidential', className: 'stamp border-destructive/60 text-destructive' };
    case 'Restricted': return { label: 'Restricted', className: 'stamp border-primary/70 text-primary' };
    case 'Internal': return { label: 'Internal', className: 'stamp border-accent/60 text-accent' };
    case 'Public': return { label: 'Public', className: 'stamp border-muted-foreground/40 text-muted-foreground' };
    default: return { label: c || 'Unknown', className: 'stamp border-muted-foreground/40 text-muted-foreground' };
  }
}

export function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx', 'rtf'].includes(ext)) return 'Word';
  if (['xls', 'xlsx'].includes(ext)) return 'Excel';
  if (['ppt', 'pptx'].includes(ext)) return 'PowerPoint';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'Image';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  if (ext === 'txt' || ext === 'md') return 'Text';
  if (ext === 'csv') return 'CSV';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'Video';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return 'Audio';
  return 'Other';
}

export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'heic', 'tiff',
  'zip', 'rar', '7z', 'txt', 'csv', 'json', 'xml', 'log',
  'mp4', 'mov', 'avi', 'mkv', 'webm',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  'md', 'rtf',
];

/** Client-side SHA-256 of a File, computed via the Web Crypto API (subtle.digest).
 *  This is a *preview* hash shown to the user immediately; the authoritative
 *  hash + HMAC signature is recomputed server-side in the sign-document Edge
 *  Function from the bytes actually stored in Supabase Storage, so a tampered
 *  client can't lie about what it uploaded. */
export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
