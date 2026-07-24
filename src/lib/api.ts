import { supabase } from '@/lib/supabase';
import { getFileType, ALLOWED_EXTENSIONS } from '@/lib/utils';
import type { Classification, Permission, Role } from '@/types/database';

// ---------- Documents ----------

export async function getDocuments(opts: { search?: string; classification?: string; fileType?: string; offset?: number; limit?: number }) {
  let q = supabase.from('documents').select('*', { count: 'exact' }).eq('owner', (await supabase.auth.getUser()).data.user?.id);
  if (opts.search) q = q.ilike('filename', `%${opts.search}%`);
  if (opts.classification) q = q.eq('classification', opts.classification);
  if (opts.fileType) q = q.eq('file_type', opts.fileType);
  const from = opts.offset || 0;
  const to = from + (opts.limit || 20) - 1;
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return { records: data || [], hasMore: (count || 0) > to + 1 };
}

// Search now only ever sees rows RLS allows (owned + explicitly shared +
// clearance-gated) — this is the IDOR fix for the prototype's searchDocuments.
export async function searchDocuments(opts: { query: string; classification?: string; fileType?: string; offset?: number }) {
  let q = supabase.from('documents').select('*, owner_profile:owner(first_name,last_name)', { count: 'exact' }).ilike('filename', `%${opts.query}%`);
  if (opts.classification) q = q.eq('classification', opts.classification);
  if (opts.fileType) q = q.eq('file_type', opts.fileType);
  const from = opts.offset || 0;
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, from + 19);
  if (error) throw error;
  const records = (data || []).map((d: any) => ({ ...d, ownerName: `${d.owner_profile?.first_name || ''} ${d.owner_profile?.last_name || ''}`.trim() }));
  return { records, hasMore: (count || 0) > from + 20, total: count || 0 };
}

export async function getDocumentDetail(documentId: string) {
  const { data: doc, error } = await supabase.from('documents').select('*, owner_profile:owner(first_name,last_name,email)').eq('id', documentId).single();
  if (error) throw error;
  const [{ data: versions }, { data: shares }] = await Promise.all([
    supabase.from('document_versions').select('*').eq('document', documentId).order('created_at', { ascending: false }),
    supabase.from('shared_documents').select('*, recipient:shared_with_user(first_name,last_name,role)').eq('document', documentId),
  ]);
  const ownerProfile: any = (doc as any).owner_profile;
  return {
    document: doc,
    ownerName: `${ownerProfile?.first_name || ''} ${ownerProfile?.last_name || ''}`.trim() || ownerProfile?.email,
    versions: versions || [],
    shares: (shares || []).map((s: any) => ({ ...s, recipientName: `${s.recipient?.first_name || ''} ${s.recipient?.last_name || ''}`.trim(), recipientRole: s.recipient?.role })),
    signatureInfo: {
      signature: doc.hmac_signature || 'Pending',
      status: doc.signature_status,
      contentHash: doc.sha256_hash || 'Pending',
      isVerified: doc.signature_status === 'Verified',
    },
  };
}

export async function uploadDocument(file: File, classification: Classification, userId: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) throw new Error(`.${ext} files aren't supported. Allowed: documents, spreadsheets, presentations, images, audio/video, and archives.`);
  if (file.size > 100 * 1024 * 1024) throw new Error('File size exceeds 100MB limit');

  const path = `${userId}/${crypto.randomUUID()}/${file.name}`;
  const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false });
  if (uploadErr) throw uploadErr;

  const { data: doc, error: insertErr } = await supabase.from('documents').insert({
    filename: file.name,
    file_path: path,
    owner: userId,
    classification,
    file_type: getFileType(file.name),
    size_bytes: file.size,
    signature_status: 'Pending',
  }).select().single();
  if (insertErr) throw insertErr;

  await supabase.rpc('log_audit', { p_action: 'Upload', p_details: `Uploaded ${file.name} (${getFileType(file.name)})`, p_status: 'Success', p_risk: 'Normal' });

  // Sign the document server-side. Uses the Supabase client's own
  // functions.invoke() rather than a hand-rolled fetch() — the client
  // library attaches the correct auth headers itself and is Supabase's
  // own tested path for calling functions from a browser, sidestepping
  // the platform-gateway/CORS-preflight issues a manual fetch() can hit.
  try {
    const { error: fnError } = await supabase.functions.invoke('sign-document', {
      body: { documentId: doc.id },
    });
    if (fnError) {
      console.error('sign-document failed:', fnError);
      await supabase.from('documents').update({ signature_status: 'Unverified' }).eq('id', doc.id);
    }
  } catch (e) {
    console.error('sign-document unreachable:', e);
    await supabase.from('documents').update({ signature_status: 'Unverified' }).eq('id', doc.id);
  }

  return { document: doc };
}

export async function getFileUrl(path: string) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(documentId: string) {
  const { data: doc } = await supabase.from('documents').select('filename,file_path').eq('id', documentId).single();
  const { error } = await supabase.from('documents').delete().eq('id', documentId); // RLS enforces owner/admin
  if (error) throw error;
  if (doc) await supabase.storage.from('documents').remove([doc.file_path]);
  await supabase.rpc('log_audit', { p_action: 'Delete', p_details: `Deleted ${doc?.filename || documentId}`, p_status: 'Success', p_risk: 'Normal' });
  return { success: true };
}

export async function shareDocumentMultiple(input: {
  documentId: string; recipients: { userId: string; permission: Permission }[];
  noDownload?: boolean; noShare?: boolean; expiresAt?: string; downloadLimit?: number; allowOverride?: boolean;
}) {
  const { data, error } = await supabase.rpc('share_document', {
    p_document_id: input.documentId,
    p_recipients: input.recipients.map(r => ({ user_id: r.userId, permission: r.permission })),
    p_no_download: input.noDownload || false,
    p_no_share: input.noShare || false,
    p_expires_at: input.expiresAt || null,
    p_download_limit: input.downloadLimit || null,
    p_allow_override: input.allowOverride || false,
  });
  if (error) throw error;
  return { shares: data.shared, clearanceViolations: (data.blocked || []).map((b: any) => `${b.name} (${b.role}) lacks clearance — share blocked`) };
}

export async function broadcastDocument(input: { documentId: string; permission: Permission; noDownload?: boolean; noShare?: boolean; message?: string }) {
  const { data, error } = await supabase.rpc('broadcast_document', {
    p_document_id: input.documentId, p_permission: input.permission,
    p_no_download: input.noDownload || false, p_no_share: input.noShare ?? true, p_message: input.message || null,
  });
  if (error) throw error;
  return { count: data as number };
}

export async function getSharedWithMe(opts: { search?: string; permission?: string; offset?: number; limit?: number }) {
  let q = supabase.from('shared_documents').select('*, doc:document(filename,file_path,classification), sharer:shared_by(first_name,last_name)', { count: 'exact' });
  if (opts.permission) q = q.eq('permission', opts.permission);
  const from = opts.offset || 0;
  const to = from + (opts.limit || 20) - 1;
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  let records = (data || []).map((s: any) => ({
    ...s, documentName: s.doc?.filename, documentPath: s.doc?.file_path,
    sharerName: `${s.sharer?.first_name || ''} ${s.sharer?.last_name || ''}`.trim(),
  }));
  if (opts.search) records = records.filter((r: any) => r.documentName?.toLowerCase().includes(opts.search!.toLowerCase()));
  return { records, hasMore: (count || 0) > to + 1 };
}

// ---------- Users / Admin ----------

// Minimal fields only — used for the share-recipient picker so a regular
// Employee can address a colleague without pulling every user's risk
// score, suspension reason, phone number, etc. (that full dump was the
// getAllUsers IDOR in the prototype).
export async function listShareableUsers() {
  const { data, error } = await supabase.rpc('list_active_profiles');
  if (error) throw error;
  return { users: data || [] };
}

export async function getUsersByLevel(opts: { role?: string; status?: string; search?: string; offset?: number; limit?: number }) {
  let q = supabase.from('profiles').select('*', { count: 'exact' });
  if (opts.role) q = q.eq('role', opts.role);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.search) q = q.or(`email.ilike.%${opts.search}%`);
  const from = opts.offset || 0;
  const to = from + (opts.limit || 30) - 1;
  const [{ data, count, error }, { data: all }, { data: departments }] = await Promise.all([
    q.order('created_at', { ascending: false }).range(from, to),
    supabase.from('profiles').select('role'),
    supabase.from('departments').select('*'),
  ]);
  if (error) throw error;
  const counts = {
    total: all?.length || 0,
    guest: all?.filter(u => u.role === 'Guest').length || 0,
    employee: all?.filter(u => u.role === 'Employee').length || 0,
    manager: all?.filter(u => u.role === 'Manager').length || 0,
    securityOfficer: all?.filter(u => u.role === 'Security Officer').length || 0,
    administrator: all?.filter(u => u.role === 'Administrator').length || 0,
  };
  return { users: data || [], hasMore: (count || 0) > to + 1, counts, departments: departments || [] };
}

export async function updateUser(input: { userId: string; role?: Role; departmentId?: string; assignEmployeeId?: boolean }) {
  const { data, error } = await supabase.rpc('admin_update_user', {
    p_user_id: input.userId, p_role: input.role || null, p_department: input.departmentId || null, p_assign_employee_id: input.assignEmployeeId || false,
  });
  if (error) throw error;
  return { user: data, message: 'User updated' };
}

export async function suspendUser(input: { userId: string; action: 'suspend' | 'unsuspend'; reason?: string }) {
  const { data, error } = await supabase.rpc('admin_suspend_user', { p_user_id: input.userId, p_action: input.action, p_reason: input.reason || null });
  if (error) throw error;
  return { success: true, message: data as string };
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
  if (error) throw error;
  return { success: true, message: data as string };
}

export async function compareUsers(userIds: string[]) {
  const { data, error } = await supabase.rpc('admin_compare_users', { p_user_ids: userIds });
  if (error) throw error;
  return { comparisons: data as any[] };
}

export async function updateProfile(input: { firstName?: string; lastName?: string; phone?: string; profilePhotoUrl?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const record: Record<string, any> = {};
  if (input.firstName !== undefined) record.first_name = input.firstName;
  if (input.lastName !== undefined) record.last_name = input.lastName;
  if (input.phone !== undefined) record.phone = input.phone;
  if (input.profilePhotoUrl) record.profile_photo_url = input.profilePhotoUrl;
  const { error } = await supabase.from('profiles').update(record).eq('id', userData.user!.id);
  if (error) throw error;
  return { success: true };
}

export async function uploadAvatar(file: File, userId: string) {
  const path = `${userId}/avatar-${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60 * 24 * 365);
  return { fileUrl: data?.signedUrl || '' };
}

// ---------- Audit / Alerts ----------

export async function getAuditLogs(opts: { action?: string; search?: string; offset?: number; limit?: number }) {
  let q = supabase.from('audit_logs').select('*, user_profile:user_id(email)', { count: 'exact' });
  if (opts.action) q = q.eq('action', opts.action);
  if (opts.search) q = q.ilike('details', `%${opts.search}%`);
  const from = opts.offset || 0;
  const to = from + (opts.limit || 30) - 1;
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  const records = (data || []).map((l: any) => ({ ...l, userEmail: l.user_profile?.email || 'Unknown', createdAt: l.created_at, riskLevel: l.risk_level }));
  return { records, hasMore: (count || 0) > to + 1 };
}

export async function exportAuditLogs(opts: { action?: string }) {
  let q = supabase.from('audit_logs').select('*').limit(2000);
  if (opts.action) q = q.eq('action', opts.action);
  const { data, error } = await q;
  if (error) throw error;
  const header = 'Time,User,Action,Details,Status,Risk';
  const rows = (data || []).map(r => `"${r.created_at}","${r.user_id || ''}","${r.action}","${(r.details || '').replace(/"/g, '""')}","${r.status}","${r.risk_level}"`);
  return { csv: [header, ...rows].join('\n') };
}

export async function getSecurityAlerts(opts: { severity?: string; alertStatus?: string; offset?: number; limit?: number }) {
  let q = supabase.from('security_alerts').select('*, affected:affected_user(email)', { count: 'exact' });
  if (opts.severity) q = q.eq('severity', opts.severity);
  if (opts.alertStatus) q = q.eq('alert_status', opts.alertStatus);
  const from = opts.offset || 0;
  const to = from + (opts.limit || 20) - 1;
  const [{ data, count, error }, { count: active }, { count: ack }, { count: resolved }] = await Promise.all([
    q.order('created_at', { ascending: false }).range(from, to),
    supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('alert_status', 'Active'),
    supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('alert_status', 'Acknowledged'),
    supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('alert_status', 'Resolved'),
  ]);
  if (error) throw error;
  const records = (data || []).map((a: any) => ({ ...a, affectedUserName: a.affected?.email, createdAt: a.created_at, alertStatus: a.alert_status }));
  return { records, hasMore: (count || 0) > to + 1, counts: { active: active || 0, acknowledged: ack || 0, resolved: resolved || 0 } };
}

export async function updateAlertStatus(input: { alertId: string; status: string }) {
  const { error } = await supabase.from('security_alerts').update({ alert_status: input.status }).eq('id', input.alertId);
  if (error) throw error;
  await supabase.rpc('log_audit', { p_action: 'Admin Action', p_details: `Changed alert ${input.alertId} status to ${input.status}`, p_status: 'Success', p_risk: 'Normal' });
  return { success: true };
}

// ---------- Notifications / Dashboard / Announcements ----------

export async function getNotifications(opts: { offset?: number; limit?: number }) {
  const { data: userData } = await supabase.auth.getUser();
  const from = opts.offset || 0;
  const to = from + (opts.limit || 20) - 1;
  const [{ data, count, error }, { count: unread }] = await Promise.all([
    supabase.from('notifications').select('*', { count: 'exact' }).eq('recipient', userData.user!.id).order('created_at', { ascending: false }).range(from, to),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient', userData.user!.id).eq('is_read', false),
  ]);
  if (error) throw error;
  return { records: data || [], hasMore: (count || 0) > to + 1, unreadCount: unread || 0 };
}

export async function markNotificationsRead(input: { notificationId?: string; markAll?: boolean }) {
  const { data: userData } = await supabase.auth.getUser();
  if (input.markAll) {
    await supabase.from('notifications').update({ is_read: true }).eq('recipient', userData.user!.id).eq('is_read', false);
  } else if (input.notificationId) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', input.notificationId);
  }
  return { success: true };
}

export async function getDashboardData() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user!.id;
  const [{ count: myDocs }, { count: shared }, { count: unread }, { data: recentDocs }, { data: recentNotifs }] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('owner', uid),
    supabase.from('shared_documents').select('*', { count: 'exact', head: true }).eq('shared_with_user', uid),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient', uid).eq('is_read', false),
    supabase.from('documents').select('*').eq('owner', uid).order('created_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('*').eq('recipient', uid).order('created_at', { ascending: false }).limit(5),
  ]);
  return {
    myDocumentsCount: myDocs || 0, sharedWithMeCount: shared || 0, unreadAlertsCount: unread || 0,
    recentDocuments: recentDocs || [], recentNotifications: recentNotifs || [],
  };
}

export async function getAdminDashboard() {
  const [{ data: users }, { count: docs }, { count: alerts }, { count: locked }, { data: recentAlerts }, { data: recentLogs }] = await Promise.all([
    supabase.from('profiles').select('risk_score'),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('alert_status', 'Active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Locked'),
    supabase.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  const all = users || [];
  return {
    totalUsers: all.length,
    totalDocuments: docs || 0,
    activeAlerts: alerts || 0,
    lockedAccounts: locked || 0,
    riskDistribution: {
      normal: all.filter(u => (u.risk_score || 0) < 20).length,
      medium: all.filter(u => (u.risk_score || 0) >= 20 && (u.risk_score || 0) < 40).length,
      high: all.filter(u => (u.risk_score || 0) >= 40 && (u.risk_score || 0) < 60).length,
      critical: all.filter(u => (u.risk_score || 0) >= 60).length,
    },
    recentAlerts: recentAlerts || [],
    recentActivity: (recentLogs || []).map((l: any) => ({ ...l, createdAt: l.created_at })),
  };
}

export async function getDepartments() {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw error;
  return { departments: data || [] };
}

export async function getAnnouncements(opts: { offset?: number; limit?: number }) {
  const from = opts.offset || 0;
  const to = from + (opts.limit || 20) - 1;
  const { data, count, error } = await supabase.from('announcements').select('*, poster:posted_by(first_name,last_name,email)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  const records = (data || []).map((a: any) => ({ ...a, posterName: `${a.poster?.first_name || ''} ${a.poster?.last_name || ''}`.trim() || a.poster?.email, targetType: a.target_type, targetClearance: a.target_clearance, createdAt: a.created_at }));
  return { records, hasMore: (count || 0) > to + 1 };
}

export async function createAnnouncement(input: { title: string; message: string; targetType: string; targetDepartmentId?: string; targetClearance?: string; priority?: string }) {
  const { data, error } = await supabase.rpc('create_announcement', {
    p_title: input.title, p_message: input.message, p_target_type: input.targetType,
    p_target_department: input.targetDepartmentId || null, p_target_clearance: input.targetClearance || null, p_priority: input.priority || 'Normal',
  });
  if (error) throw error;
  return { notifiedCount: data as number };
}

// ---------- Admin: ID ranges ----------

export async function manageIdRanges(input: { action: 'list' | 'create' | 'delete'; id?: string; rangeLabel?: string; startId?: number; endId?: number; departmentId?: string }) {
  if (input.action === 'list') {
    const [{ data: ranges }, { data: departments }] = await Promise.all([
      supabase.from('id_ranges').select('*, dept:department(name)').order('range_label'),
      supabase.from('departments').select('*'),
    ]);
    return { ranges: (ranges || []).map((r: any) => ({ ...r, rangeLabel: r.range_label, startId: r.start_id, endId: r.end_id, nextAvailableId: r.next_available_id, departmentName: r.dept?.name })), departments: departments || [] };
  }
  const { data, error } = await supabase.rpc('manage_id_ranges', {
    p_action: input.action, p_id: input.id || null, p_label: input.rangeLabel || null, p_start: input.startId || null, p_end: input.endId || null, p_department: input.departmentId || null,
  });
  if (error) throw error;
  return { ranges: (data || []).map((r: any) => ({ ...r, rangeLabel: r.range_label, startId: r.start_id, endId: r.end_id, nextAvailableId: r.next_available_id })), message: input.action === 'create' ? `Range "${input.rangeLabel}" created` : 'Range deleted' };
}
