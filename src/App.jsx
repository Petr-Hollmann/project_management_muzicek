import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import SetNewPassword from '@/pages/SetNewPassword';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, isPasswordRecovery, user } = useAuth();

  console.log("[App] render — isAuthenticated:", isAuthenticated, "isLoadingAuth:", isLoadingAuth, "app_role:", user?.app_role ?? "null");

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (isPasswordRecovery) return <SetNewPassword />;
  if (!isAuthenticated) return <Login />;
  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<LayoutWrapper currentPageName="Dashboard"><Pages.Dashboard /></LayoutWrapper>} />
      <Route path="/orders" element={<LayoutWrapper currentPageName="Orders"><Pages.Orders /></LayoutWrapper>} />
      <Route path="/orders/:id" element={<LayoutWrapper currentPageName="Orders"><Pages.OrderDetail /></LayoutWrapper>} />
      <Route path="/calendar" element={<LayoutWrapper currentPageName="Calendar"><Pages.Calendar /></LayoutWrapper>} />
      <Route path="/customers" element={<LayoutWrapper currentPageName="Customers"><Pages.Customers /></LayoutWrapper>} />
      <Route path="/customers/:id" element={<LayoutWrapper currentPageName="Customers"><Pages.CustomerDetail /></LayoutWrapper>} />
      <Route path="/vehicles" element={<LayoutWrapper currentPageName="Vehicles"><Pages.Vehicles /></LayoutWrapper>} />
      <Route path="/vehicles/:id" element={<LayoutWrapper currentPageName="Vehicles"><Pages.VehicleDetail /></LayoutWrapper>} />
      <Route path="/workers" element={<LayoutWrapper currentPageName="Workers"><Pages.Workers /></LayoutWrapper>} />
      <Route path="/notes" element={<LayoutWrapper currentPageName="Notes"><Pages.Notes /></LayoutWrapper>} />
      <Route path="/settings" element={<LayoutWrapper currentPageName="Settings"><Pages.Settings /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
