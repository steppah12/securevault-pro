import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Toaster } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import DocumentsPage from '@/pages/DocumentsPage';
import DocumentDetailPage from '@/pages/DocumentDetailPage';
import SharedWithMePage from '@/pages/SharedWithMePage';
import SearchPage from '@/pages/SearchPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import AuditLogsPage from '@/pages/admin/AuditLogsPage';
import SecurityAlertsPage from '@/pages/admin/SecurityAlertsPage';
import AdminAnnouncementsPage from '@/pages/admin/AdminAnnouncementsPage';
import ClearanceLevelsPage from '@/pages/admin/ClearanceLevelsPage';
import UserComparisonPage from '@/pages/admin/UserComparisonPage';
import AdminIdRangesPage from '@/pages/admin/AdminIdRangesPage';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading SecureVault...</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  if (!user) {
    // Session exists but profile row hasn't landed yet (trigger race on first sign-up)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Setting up your account...</p>
      </div>
    );
  }

  if (user.status !== 'Active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-bold mb-2">Account {user.status}</h1>
          <p className="text-sm text-muted-foreground">Your account is currently {user.status.toLowerCase()}. Contact an administrator if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/shared" element={<SharedWithMePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/audit" element={<AuditLogsPage />} />
            <Route path="/admin/alerts" element={<SecurityAlertsPage />} />
            <Route path="/admin/clearance" element={<ClearanceLevelsPage />} />
            <Route path="/admin/compare" element={<UserComparisonPage />} />
            <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/id-ranges" element={<AdminIdRangesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthGate>
      <Toaster theme="dark" position="top-right" />
    </BrowserRouter>
  );
}
