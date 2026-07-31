import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }  from './context/ToastContext';
import { ClaimsProvider } from './context/ClaimsContext';
import { SupplierClaimsProvider } from './context/SupplierClaimsContext';
import { PrintProvider }  from './context/PrintContext';
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
import UserAdmin           from './pages/UserAdmin';

function PermGuard({ perm, children }) {
  const { canDo, loading } = useAuth();
  if (loading) return null;
  if (!canDo(perm)) return <Navigate to="/" replace />;
  return children;
}

function AdminGuard({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
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
              <Route path="claims" element={<PermGuard perm="customer_read"><ClaimList /></PermGuard>} />
              <Route path="claims/new" element={<PermGuard perm="customer_write"><NewClaim /></PermGuard>} />
              <Route path="claims/:id" element={<PermGuard perm="customer_read"><ClaimDetail /></PermGuard>} />
              <Route path="claims/:id/report" element={<PermGuard perm="customer_read"><ClaimReport /></PermGuard>} />
              <Route path="manual" element={<UserManual />} />
              <Route path="analytics" element={<PermGuard perm="customer_analytics"><Analytics /></PermGuard>} />
              <Route path="parts" element={<AdminGuard><Parts /></AdminGuard>} />
              <Route path="supplier-claims" element={<PermGuard perm="supplier_read"><SupplierClaimList /></PermGuard>} />
              <Route path="supplier-claims/new" element={<PermGuard perm="supplier_write"><NewSupplierClaim /></PermGuard>} />
              <Route path="supplier-claims/:id" element={<PermGuard perm="supplier_read"><SupplierClaimDetail /></PermGuard>} />
              <Route path="suppliers" element={<AdminGuard><Suppliers /></AdminGuard>} />
              <Route path="admin/users" element={<AdminGuard><UserAdmin /></AdminGuard>} />
              <Route path="supplier-analytics" element={<PermGuard perm="supplier_analytics"><SupplierAnalytics /></PermGuard>} />
              <Route path="analysis" element={<PermGuard perm="report"><AnalysisReport /></PermGuard>} />
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
