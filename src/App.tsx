import { Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider, useAppContext } from './hooks/AppDataContext';
import { AppLayout } from './components/layout/AppLayout';
import { ToastStack } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { SummaryPage } from './pages/SummaryPage';
import { DetailsPage } from './pages/DetailsPage';
import { CalendarPage } from './pages/CalendarPage';
import { UploadPage } from './pages/UploadPage';
import { ManagementPage } from './pages/ManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { PeoplePage } from './pages/PeoplePage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { LoginProfilePage } from './pages/LoginProfilePage';
import { isSelfServiceOnly } from './lib/permissions';

function LoadingScreen() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--background)' }}>
      <p className="muted">Carregando dados do Supabase…</p>
    </div>
  );
}

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--background)', padding: 24 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 className="section-title">Configuração pendente</h2>
        <p className="section-subtitle" style={{ margin: '4px 0 0' }}>
          {message}
        </p>
      </div>
    </div>
  );
}

function AppShell() {
  const { data, access, toast } = useAppContext();

  if (data.error) return <ConfigErrorScreen message={data.error} />;
  if (data.loading) return <LoadingScreen />;
  if (!access.context.matricula) return <LoginProfilePage />;
  if (!access.context.authorized) return <AccessDeniedPage />;

  const footerText = `${access.context.profile?.name ?? access.context.matricula} · ${access.context.role}`;
  const selfServiceOnly = isSelfServiceOnly(access.context.profile?.access_type);

  return (
    <AppLayout footerText={footerText} accessType={access.context.profile?.access_type} restrictToSelfService={selfServiceOnly}>
      <Routes>
        {selfServiceOnly ? (
          <>
            {/* Perfil "Colaborador": único módulo acessível é o próprio Controle de Horas. */}
            <Route path="/controle-horas" element={<DetailsPage />} />
            <Route path="*" element={<Navigate to="/controle-horas" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/resumo" element={<SummaryPage />} />
            <Route path="/controle-horas" element={<DetailsPage />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/gestao-bh" element={<ManagementPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/colaboradores" element={<PeoplePage />} />
            <Route path="/acesso-negado" element={<AccessDeniedPage />} />
            <Route path="/login" element={<LoginProfilePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
      <ToastStack toasts={toast.toasts} />
    </AppLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </ErrorBoundary>
  );
}
