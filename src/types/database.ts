// Hand-written types mirroring supabase/schema.sql.
// If you use the Supabase CLI you can replace this with `supabase gen types typescript`.

export type Role = 'Guest' | 'Employee' | 'Manager' | 'Security Officer' | 'Administrator';
export type Classification = 'Public' | 'Internal' | 'Confidential' | 'Restricted';
export type Permission = 'Read Only' | 'Editable';
export type UserStatus = 'Active' | 'Locked' | 'Disabled';
export type RiskLevel = 'Normal' | 'Elevated' | 'Suspicious' | 'Critical';
export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Info';
export type AlertStatus = 'Active' | 'Acknowledged' | 'Resolved' | 'Dismissed';
export type AnnouncementTarget = 'All Employees' | 'Specific Department' | 'Clearance Level';
export type AnnouncementPriority = 'Normal' | 'Important' | 'Urgent';

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: Role;
  department: string | null;
  status: UserStatus;
  risk_score: number;
  profile_photo_url: string | null;
  employee_id: number | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  last_login: string | null;
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_url: string | null;
  owner: string;
  department: string | null;
  classification: Classification;
  file_type: string;
  size_bytes: number;
  sha256_hash: string | null;
  hmac_signature: string | null;
  signature_status: 'Pending' | 'Verified' | 'Unverified';
  version: number;
  retention_period: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document: string;
  version_label: string | null;
  version_number: number;
  file_path: string;
  uploaded_by: string;
  sha256_hash: string | null;
  created_at: string;
}

export interface SharedDocument {
  id: string;
  share_label: string | null;
  document: string;
  shared_by: string;
  shared_with_user: string | null;
  shared_with_department: string | null;
  permission: Permission;
  expires_at: string | null;
  download_limit: number | null;
  downloads_used: number;
  no_download: boolean;
  no_share: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  browser: string | null;
  status: 'Success' | 'Failed';
  risk_level: RiskLevel;
  created_at: string;
}

export interface SecurityAlert {
  id: string;
  title: string;
  severity: AlertSeverity;
  rule: string | null;
  description: string | null;
  affected_user: string | null;
  alert_status: AlertStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string | null;
  recipient: string;
  type: 'Share' | 'Security' | 'System' | 'Download';
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

export interface IdRange {
  id: string;
  range_label: string;
  start_id: number;
  end_id: number;
  department: string | null;
  next_available_id: number;
  is_active: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  posted_by: string;
  target_type: AnnouncementTarget;
  target_department: string | null;
  target_clearance: Role | null;
  priority: AnnouncementPriority;
  is_active: boolean;
  created_at: string;
}

export const CLEARANCE_LEVELS: Record<Role, { level: number; label: string; color: string }> = {
  Guest: { level: 0, label: 'Level 0 — Guest', color: 'stamp border-muted-foreground/40 text-muted-foreground' },
  Employee: { level: 1, label: 'Level 1 — Standard', color: 'stamp border-accent/50 text-accent' },
  Manager: { level: 2, label: 'Level 2 — Elevated', color: 'stamp border-accent/70 text-accent' },
  'Security Officer': { level: 3, label: 'Level 3 — High', color: 'stamp border-primary/70 text-primary' },
  Administrator: { level: 4, label: 'Level 4 — Top Secret', color: 'stamp border-destructive/70 text-destructive' },
};

export const CLASSIFICATION_LEVELS: Record<Classification, number> = {
  Public: 0,
  Internal: 1,
  Confidential: 2,
  Restricted: 3,
};

// Minimal Database type so supabase-js generics don't complain.
// Extend with `supabase gen types typescript` for full inference.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Database {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any }>;
    Views: Record<string, never>;
    Functions: Record<string, { Args: any; Returns: any }>;
  };
}
