import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedLayout } from './components/layout/ProtectedLayout';
import { RequireAdmin } from './components/layout/RequireAdmin';
import { caricaPagina } from './lib/caricaPagina';

// Ogni pagina si scarica solo quando la si apre: i genitori non scaricano le pagine degli allenatori.
const LoginPage = caricaPagina(() => import('./pages/LoginPage'));
const PublicProgramPage = caricaPagina(() => import('./pages/PublicProgramPage'));
const PublicSeasonPage = caricaPagina(() => import('./pages/PublicSeasonPage'));
const TrainingsPage = caricaPagina(() => import('./pages/TrainingsPage'));
const MatchesPage = caricaPagina(() => import('./pages/MatchesPage'));
const WeekPlanPage = caricaPagina(() => import('./pages/WeekPlanPage'));
const StatsPage = caricaPagina(() => import('./pages/StatsPage'));
const ReportMensilePage = caricaPagina(() => import('./pages/ReportMensilePage'));
const DivisePage = caricaPagina(() => import('./pages/DivisePage'));
const RosterPage = caricaPagina(() => import('./pages/RosterPage'));
const StaffPage = caricaPagina(() => import('./pages/StaffPage'));
const VenuesPage = caricaPagina(() => import('./pages/VenuesPage'));
const OpponentsPage = caricaPagina(() => import('./pages/OpponentsPage'));
const SettingsPage = caricaPagina(() => import('./pages/SettingsPage'));

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="center-page">Caricamento…</div>;
  }

  return (
    <Suspense fallback={<div className="center-page">Caricamento…</div>}>
    <Routes>
      <Route path="/programma/:token" element={<PublicProgramPage />} />
      <Route path="/campionato" element={<PublicSeasonPage />} />
      <Route path="/programma" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={session ? <Navigate to="/app/allenamenti" replace /> : <LoginPage />} />

      <Route path="/app" element={session ? <ProtectedLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="allenamenti" replace />} />
        <Route path="allenamenti" element={<TrainingsPage />} />
        <Route path="weekend" element={<MatchesPage />} />
        <Route path="piano" element={<WeekPlanPage />} />
        <Route path="statistiche" element={<StatsPage />} />
        <Route path="statistiche/report" element={<ReportMensilePage />} />
        <Route path="rosa" element={<RosterPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route
          path="divise"
          element={
            <RequireAdmin>
              <DivisePage />
            </RequireAdmin>
          }
        />
        <Route
          path="palestre"
          element={
            <RequireAdmin>
              <VenuesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="avversari"
          element={
            <RequireAdmin>
              <OpponentsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="impostazioni"
          element={
            <RequireAdmin>
              <SettingsPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={session ? '/app/allenamenti' : '/login'} replace />} />
    </Routes>
    </Suspense>
  );
}

export default App;
