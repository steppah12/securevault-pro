import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, Share2, Search, Shield, Users, ScrollText,
  AlertTriangle, Bell, User, LogOut, ChevronDown, Menu, X,
  ShieldCheck, Megaphone, BarChart3, Hash, Crown,
} from 'lucide-react';
import { getNotifications } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Badge, Button } from '@/components/ui';
import { CLEARANCE_LEVELS } from '@/types/database';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/shared', label: 'Shared', icon: Share2 },
  { to: '/search', label: 'Search', icon: Search },
];

const adminNavItems = [
  { to: '/admin', label: 'Command', icon: Crown },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/clearance', label: 'Clearance', icon: Shield },
  { to: '/admin/compare', label: 'Compare', icon: BarChart3 },
  { to: '/admin/announcements', label: 'Posts', icon: Megaphone },
  { to: '/admin/audit', label: 'Audit', icon: ScrollText },
  { to: '/admin/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/admin/id-ranges', label: 'ID Config', icon: Hash },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === 'Administrator' || user?.role === 'Security Officer';
  const isOnAdminPage = location.pathname.startsWith('/admin');
  const initials = `${(user?.first_name || '')[0] || ''}${(user?.last_name || '')[0] || ''}`.toUpperCase() || 'U';
  const clearance = CLEARANCE_LEVELS[user?.role || 'Employee'];

  useEffect(() => {
    if (!user?.id) return;
    getNotifications({ offset: 0, limit: 1 }).then(d => setUnreadCount(d.unreadCount)).catch((e) => console.error(e));
  }, [user?.id]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
    }`;

  return (
    <div className="min-h-screen bg-background">
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${isOnAdminPage && isAdmin ? 'bg-card/90 border-primary/10' : 'bg-card/80 border-border'}`}>
        <div className="container mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(isAdmin ? '/admin' : '/')} className="flex items-center gap-2 group">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isOnAdminPage && isAdmin ? 'bg-primary/20' : 'bg-primary/15'}`}>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-semibold text-foreground tracking-tight text-base">SecureVault</span>
                {isOnAdminPage && isAdmin && <span className="text-[10px] text-primary ml-1.5 font-medium">Admin</span>}
              </div>
            </button>

            <nav className="hidden lg:flex items-center gap-0.5">
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                  <item.icon className="h-3.5 w-3.5" /> {item.label}
                </NavLink>
              ))}
              {isAdmin && (
                <>
                  <div className="w-px h-5 bg-border mx-1.5" />
                  {adminNavItems.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={linkClass}>
                      <item.icon className="h-3.5 w-3.5" /> {item.label}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => navigate('/notifications')}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" className="gap-2 px-2 h-9">
                  <Avatar className="h-7 w-7">
                    {user?.profile_photo_url && <AvatarImage src={user.profile_photo_url} />}
                    <AvatarFallback className={`text-xs font-semibold ${isAdmin ? 'bg-primary/20 text-primary' : 'bg-primary/15 text-primary'}`}>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <span className="text-sm font-medium block leading-tight">{user?.first_name || user?.email?.split('@')[0]}</span>
                    {user?.employee_id && <span className="text-[10px] text-muted-foreground font-mono">#{user.employee_id}</span>}
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{user?.role || 'Employee'}</Badge>
                    <span className={clearance.color}>{clearance.label}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}><User className="h-4 w-4 mr-2" /> Profile & Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive"><LogOut className="h-4 w-4 mr-2" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-card px-4 py-3 space-y-1 max-h-[60vh] overflow-y-auto">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)} className={linkClass}>
                <item.icon className="h-4 w-4" /> {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <>
                <div className="h-px bg-border my-2" />
                <p className="text-[10px] text-muted-foreground font-semibold uppercase px-2.5 py-1">Admin</p>
                {adminNavItems.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/admin'} onClick={() => setMobileOpen(false)} className={linkClass}>
                    <item.icon className="h-4 w-4" /> {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
