import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isPrivileged, isSuperAdmin, getRoleLabel } from "@/utils/roles";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Car,
  Settings,
  LogOut,
  Wrench,
  Sheet,
  UserX,
  Clock,
  UserCircle,
  Receipt,
  CheckSquare,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase-client";
import ErrorBoundary from "@/components/ErrorBoundary";

const adminNavItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Projekty", url: createPageUrl("Projects"), icon: FolderOpen },
  { title: "Montážníci", url: createPageUrl("Workers"), icon: Users },
  { title: "Vozidla", url: createPageUrl("Vehicles"), icon: Car },
  { title: "Schvalování hodin", url: createPageUrl("TimesheetApproval"), icon: Clock },
  { title: "Objednávky", url: createPageUrl("Invoices"), icon: Receipt },
  { title: "Úkoly", url: createPageUrl("Tasks"), icon: CheckSquare },
];

const installerNavItems = [
  { title: "Můj Dashboard", url: createPageUrl("InstallerDashboard"), icon: Wrench },
  { title: "Můj profil", url: createPageUrl("WorkerDetail"), icon: UserCircle },
  { title: "Moje výkazy", url: createPageUrl("MyTimesheets"), icon: Sheet },
  { title: "Moje objednávky", url: createPageUrl("MyInvoices"), icon: Receipt },
  { title: "Moje úkoly", url: createPageUrl("Tasks"), icon: CheckSquare },
];

const settingsNav = [
  { title: "Nastavení", url: createPageUrl("Settings"), icon: Settings },
];

// TODO: Replace with Muzicek logo URL once Supabase storage is set up
const LOGO_URL = "/logo_muzicek.png";

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

        const adminPages = ["Dashboard", "Projects", "Workers", "Vehicles", "Settings", "ProjectDetail", "WorkerDetail", "VehicleDetail", "Calendar", "Invoices", "TimesheetApproval"];
        const installerOnlyPages = ["InstallerDashboard", "InstallerProjectDetail", "MyTimesheets", "MyInvoices"];

        if (isPrivileged(currentUser) && installerOnlyPages.includes(currentPageName)) {
          navigate(createPageUrl('Dashboard'), { replace: true });
          return;
        }

        if (currentUser.app_role === 'installer' && adminPages.includes(currentPageName)) {
          if (currentPageName !== 'WorkerDetail') {
            navigate(createPageUrl('InstallerDashboard'), { replace: true });
            return;
          }
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
    if (user.app_role === 'installer') return installerNavItems;
    if (isPrivileged(user)) return adminNavItems;
    return [];
  };

  const showSettings = !isLoading && isSuperAdmin(user);

  // Pending user - show simple header + waiting screen
  if (user && user.app_role === 'pending') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Muzicek" className="w-10 h-10 object-contain" />
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <img src={LOGO_URL} alt="Muzicek" className="w-24 h-24 object-contain mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    // defaultOpen=true: sidebar starts expanded on tablet/desktop
    <SidebarProvider defaultOpen={true}>
      <Sidebar className="border-r border-slate-200 bg-white" collapsible="icon">

        {/* Impersonation banner */}
        {impersonatedWorkerId && (
          <div className="bg-yellow-100 border-b-2 border-yellow-300 p-3 text-center group-data-[collapsible=icon]:p-2">
            <p className="text-sm font-semibold text-yellow-800 group-data-[collapsible=icon]:hidden">Režim testování</p>
            <Button variant="link" size="sm" onClick={stopImpersonating} className="text-yellow-900 h-auto p-0">
              <UserX className="w-3 h-3 mr-1 group-data-[collapsible=icon]:w-4 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:mr-0" />
              <span className="group-data-[collapsible=icon]:hidden">Ukončit zobrazení jako</span>
            </Button>
          </div>
        )}

        {/* Sidebar header with logo */}
        <SidebarHeader className="border-b border-slate-100 p-4 group-data-[collapsible=icon]:p-3">
          {/* Collapsed: only trigger button centered */}
          <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors" />
          </div>
          {/* Expanded: logo + title + trigger */}
          <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={LOGO_URL} alt="Muzicek" className="w-9 h-9 object-contain flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900 text-base leading-tight truncate">Project Manager</h2>
                <p className="text-xs text-slate-500 truncate">Řízení projektů a zdrojů</p>
              </div>
            </div>
            <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors flex-shrink-0" />
          </div>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 group-data-[collapsible=icon]:hidden">
              Navigace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2 group-data-[collapsible=icon]:px-1">
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
                          className={`h-10 rounded-lg mb-0.5 transition-all duration-150 ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                          tooltip={item.title}
                        >
                          <Link
                            to={item.url}
                            className="flex items-center gap-3 px-3 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                          >
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
                            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
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

        {/* Footer: settings + user profile */}
        <SidebarFooter className="border-t border-slate-100 p-2 group-data-[collapsible=icon]:px-1">
          {showSettings && (
            <SidebarMenu className="mb-1">
              {settingsNav.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`h-9 rounded-lg transition-all duration-150 ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                      tooltip={item.title}
                    >
                      <Link
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        {pendingUserCount > 0 && (
                          <Badge className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0 min-w-[1.25rem] h-5 hover:bg-red-500 group-data-[collapsible=icon]:hidden">
                            {pendingUserCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}

          {/* User profile row */}
          <div className="pt-2 border-t border-slate-100">
            {isLoading ? (
              <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5 group-data-[collapsible=icon]:hidden">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ) : user ? (
              <>
                {/* Expanded */}
                <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
                        {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {user.full_name || user.email || 'Uživatel'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {getRoleLabel(user.app_role)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                    title="Odhlásit se"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
                {/* Collapsed: only logout icon */}
                <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="h-9 w-9 hover:bg-red-50 hover:text-red-600"
                    title="Odhlásit se"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Main content area */}
      <SidebarInset className="min-w-0 [overflow-x:clip]">
        {/* Mobile top bar — only shown on small screens */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors" />
          <img src={LOGO_URL} alt="Muzicek" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-slate-900 text-sm">Project Manager</span>
        </header>

        {/* Page content — no overflow-auto so body scroll works correctly */}
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
