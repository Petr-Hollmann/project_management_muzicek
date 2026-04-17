import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isSuperAdmin, getRoleLabel } from "@/utils/roles";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  UserX,
  Clock,
  UserCircle,
  Car,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase-client";
import ErrorBoundary from "@/components/ErrorBoundary";

const adminNavItems = [
  { title: "Dashboard",    url: "/dashboard", icon: LayoutDashboard },
  { title: "Zakázky",      url: "/orders",    icon: FolderOpen },
  { title: "Klienti",      url: "/customers", icon: Users },
  { title: "Vozy",         url: "/vehicles",  icon: Car },
  { title: "Zaměstnanci",  url: "/workers",   icon: UserCircle },
  { title: "Poznámky",     url: "/notes",     icon: FolderOpen },
  { title: "Kalendář",     url: "/calendar",  icon: Clock },
  { title: "Nastavení",    url: "/settings",  icon: Settings },
];




// Muzicek logo paths (prefer SVG, fallback to PNG)
const LOGO_URL = "/logo_muzicek.svg";
const LOGO_FALLBACK_URL = "/logo_muzicek.png";

const PendingApprovalScreen = () => (
  <div className="flex-1 flex items-center justify-center bg-slate-50 p-4">
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle className="flex flex-col items-center gap-2">
          <Clock className="w-12 h-12 text-orange-500" />
          Účet čeká na schválení
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-700 text-lg">
          Váš účet byl úspěšně zaregistrován a nyní čeká na schválení administrátorem.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Co se děje dál?</strong><br />
            Administrátor zkontroluje váš účet a přiřadí vám odpovídající oprávnění.
            Po schválení budete moci plnohodnotně používat aplikaci.
          </p>
        </div>
        <p className="text-slate-500 text-sm">
          V případě dotazů kontaktujte svého administrátora.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [impersonatedWorkerId, setImpersonatedWorkerId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserCount, setPendingUserCount] = useState(0);

  useEffect(() => {
    const impersonatedId = localStorage.getItem('impersonated_worker_id');
    setImpersonatedWorkerId(impersonatedId);

    const initializeUser = async () => {
      setIsLoading(true);
      try {
        let currentUser = await User.me();

        if (impersonatedId && isSuperAdmin(currentUser)) {
          currentUser.worker_profile_id = impersonatedId;
          currentUser.app_role = 'installer';
        } else if (!currentUser.app_role) {
          // Edge case: upsert selhal při registraci (RLS) — vytvoříme profil z auth metadata
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const meta = authUser?.user_metadata || {};
          await User.updateMyUserData({
            app_role: 'pending',
            full_name: meta.full_name || currentUser.email,
            phone: meta.phone || null,
          });
          currentUser.app_role = 'pending';
          currentUser.full_name = meta.full_name || currentUser.email;
          currentUser.phone = meta.phone || null;
        }

        setUser(currentUser);

        // Fetch pending user count for admin badge
        if (isSuperAdmin(currentUser)) {
          const { count } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('app_role', 'pending');
          setPendingUserCount(count || 0);
        }
      } catch (error) {
        console.error("User not authenticated:", error);
      }
      setIsLoading(false);
    };
    initializeUser();
  }, [location.pathname, currentPageName]);

  const handleLogout = async () => {
    localStorage.removeItem('impersonated_worker_id');
    try {
      await User.logout();
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const stopImpersonating = () => {
    localStorage.removeItem('impersonated_worker_id');
    navigate('/', { replace: true });
  };

  const getNavItems = () => {
    if (isLoading || !user) return [];
    return adminNavItems;
  };



  // Pending user - show simple header + waiting screen
  if (user && user.app_role === 'pending') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <picture>
                <source srcSet={LOGO_URL} type="image/svg+xml" />
                <img src={LOGO_FALLBACK_URL} alt="Muzicek" className="w-10 h-10 object-contain" />
              </picture>
              <h2 className="font-bold text-slate-900 text-lg">Project Manager</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Odhlásit se
            </Button>
          </div>
        </header>
        <PendingApprovalScreen />
      </div>
    );
  }

  // Special pages rendered without the sidebar layout
  if (currentPageName === 'Invoiceprint') {
    return children;
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <picture>
            <source srcSet={LOGO_URL} type="image/svg+xml" />
            <img src={LOGO_FALLBACK_URL} alt="Muzicek" className="w-24 h-24 object-contain mx-auto mb-4" />
          </picture>
          <p className="text-white font-medium">Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar className="border-r border-[#11132b] bg-[#1a1a2e] text-white shadow-xl" collapsible="offcanvas">

        {/* Impersonation banner */}
        {impersonatedWorkerId && (
          <div className="bg-[#2a2c48] border-b border-[#11132b] p-3 text-center">
            <p className="text-sm font-semibold text-yellow-800">Režim testování</p>
            <Button variant="link" size="sm" onClick={stopImpersonating} className="text-yellow-900 h-auto p-0">
              <UserX className="w-3 h-3 mr-1" />
              Ukončit zobrazení jako
            </Button>
          </div>
        )}

        {/* Sidebar header with logo */}
        <SidebarHeader className="border-b border-[#2a2c48] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <picture>
                <source srcSet={LOGO_URL} type="image/svg+xml" />
                <img src={LOGO_FALLBACK_URL} alt="Muzicek" className="w-9 h-9 object-contain flex-shrink-0" />
              </picture>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-base leading-tight truncate">Řízení zakázek</h2>
              </div>
            </div>
            <SidebarTrigger className="text-white hover:bg-[#2a2c48] p-2 rounded-lg transition-colors flex-shrink-0" />
          </div>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-bold text-slate-300 uppercase tracking-wider px-3 py-2">
              NAVIGACE
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2">
                {isLoading ? (
                  <div className="space-y-1 px-2">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ) : (
                  getNavItems().map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`h-12 rounded-xl mb-1 transition-all duration-150 ${
                            isActive
                              ? 'bg-blue-600 text-white font-bold shadow-[0_0_20px_rgba(0,101,255,0.35)] border-l-4 border-cyan-300'
                              : 'bg-[#1d2643] text-white opacity-90 hover:opacity-100 hover:bg-[#2b3a68] hover:text-white'
                          }`}
                          tooltip={item.title}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-cyan-200'}`} />
                            <span className="text-sm tracking-wide font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer: user profile */}
        <SidebarFooter className="border-t border-[#2a2c48] p-2">
          <div className="pt-2 border-t border-[#2a2c48]">
            {isLoading ? (
              <div className="flex items-center gap-3 px-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ) : user ? (
              <div className="flex items-center justify-between gap-2 px-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src="/logo_muzicek.svg" alt="Muzicek" />
                    <AvatarFallback className="bg-indigo-500 text-white text-xs font-bold">
                      {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm truncate">
                      {user.full_name || user.email || 'Uživatel'}
                    </p>
                    <p className="text-xs text-slate-300">{getRoleLabel(user.app_role)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 text-slate-300 hover:bg-red-900/30 hover:text-red-400 flex-shrink-0"
                  title="Odhlásit se"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Main content area */}
      <SidebarInset className="min-w-0 [overflow-x:clip] bg-slate-50">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm md:hidden">
          <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" />
          <picture>
            <source srcSet={LOGO_URL} type="image/svg+xml" />
            <img src={LOGO_FALLBACK_URL} alt="Muzicek" className="w-7 h-7 object-contain" />
          </picture>
          <span className="font-semibold text-slate-900 text-sm">Řízení zakázek</span>
        </header>

        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
