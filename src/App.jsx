import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }  from './context/ToastContext';
import { ClaimsProvider } from './context/ClaimsContext';
import { SupplierClaimsProvider } from './context/SupplierClaimsContext';
import { PrintProvider }  from './context/PrintContext';
import { canViewSupplierClaims } from './lib/supabase';
import Layout             from './components/Layout';
import LoginGate          from './components/LoginGate';
import PasswordResetPage  from './components/PasswordResetPage';
import Dashboard   from './pages/Dashboard';
import ClaimList   from './pages/ClaimList';
import ClaimDetail from './pages/ClaimDetail';
import ClaimReport  from './pages/ClaimReport';
import UserManual  from './pages/UserManual';
import NewClaim    from './pages/NewClaim';
import Analytics   from './pages/Analytics';
import Parts       from './pages/Parts';
import SupplierClaimList   from './pages/SupplierClaimList';
import SupplierClaimDetail from './pages/SupplierClaimDetail';
import NewSupplierClaim    from './pages/NewSupplierClaim';
import Suppliers           from './pages/Suppliers';
import AnalysisReport      from './pages/AnalysisReport';
import SupplierAnalytics   from './pages/SupplierAnalytics';

function SupplierGuard({ children }) {
  const { profile } = useAuth();
  if (!canViewSupplierClaims(profile?.department, profile?.is_admin)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AdminGuard({ children }) {
  const { profile } = useAuth();
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading, isPasswordRecovery } = useAuth();

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', fontSize: 14, color: '#94a3b8', gap: 10,
      fontFamily: "'Helvetica Neue',Arial,sans-serif",
    }}>
      <div style={{
        width: 24, height: 24, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6',
        borderRadius: '50%', animation: 'spin .7s linear infinite',
      }} />
      로딩 중...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return <LoginGate />;
  if (isPasswordRecovery) return <PasswordResetPage />;

  return (
    <ClaimsProvider>
      <SupplierClaimsProvider>
        <BrowserRouter>
          <PrintProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="claims" element={<ClaimList />} />
              <Route path="claims/new" element={<NewClaim />} />
              <Route path="claims/:id" element={<ClaimDetail />} />
              <Route path="claims/:id/report" element={<ClaimReport />} />
              <Route path="manual" element={<UserManual />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="parts" element={<Parts />} />
              <Route path="supplier-claims" element={<SupplierGuard><SupplierClaimList /></SupplierGuard>} />
              <Route path="supplier-claims/new" element={<SupplierGuard><NewSupplierClaim /></SupplierGuard>} />
              <Route path="supplier-claims/:id" element={<SupplierGuard><SupplierClaimDetail /></SupplierGuard>} />
              <Route path="suppliers" element={<AdminGuard><Suppliers /></AdminGuard>} />
              <Route path="supplier-analytics" element={<SupplierGuard><SupplierAnalytics /></SupplierGuard>} />
              <Route path="analysis" element={<SupplierGuard><AnalysisReport /></SupplierGuard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          </PrintProvider>
        </BrowserRouter>
      </SupplierClaimsProvider>
    </ClaimsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
