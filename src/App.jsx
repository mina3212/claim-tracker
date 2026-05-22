import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }  from './context/ToastContext';
import { ClaimsProvider } from './context/ClaimsContext';
import { PrintProvider }  from './context/PrintContext';
import Layout      from './components/Layout';
import LoginGate   from './components/LoginGate';
import Dashboard   from './pages/Dashboard';
import ClaimList   from './pages/ClaimList';
import ClaimDetail from './pages/ClaimDetail';
import ClaimReport from './pages/ClaimReport';
import NewClaim    from './pages/NewClaim';
import Analytics   from './pages/Analytics';
import Parts       from './pages/Parts';

function AppRoutes() {
  const { user, loading } = useAuth();

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

  return (
    <ClaimsProvider>
      <BrowserRouter>
        <PrintProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="claims" element={<ClaimList />} />
            <Route path="claims/new" element={<NewClaim />} />
            <Route path="claims/:id" element={<ClaimDetail />} />
            <Route path="claims/:id/report" element={<ClaimReport />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="parts" element={<Parts />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </PrintProvider>
      </BrowserRouter>
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
