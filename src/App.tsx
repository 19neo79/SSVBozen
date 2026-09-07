import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedLayout } from './components/layout/ProtectedLayout';
import { RequireAdmin } from './components/layout/RequireAdmin';
import LoginPage from './pages/LoginPage';
import PublicProgramPage from './pages/PublicProgramPage';
import TrainingsPage from './pages/TrainingsPage';
import MatchesPage from './pages/MatchesPage';
import WeekPlanPage from './pages/WeekPlanPage';
import StatsPage from './pages/StatsPage';
import RosterPage from './pages/RosterPage';
import StaffPage from './pages/StaffPage';
import VenuesPage from './pages/VenuesPage';
import OpponentsPage from './pages/OpponentsPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="center-page">Caricamento…</div>;
  }

  return (
    <Routes>
      <Route path="/programma" element={<PublicProgramPage />} />
      <Route path="/login" element={session ? <Navigate to="/app/allenamenti" replace /> : <LoginPage />} />

      <Route path="/app" element={session ? <ProtectedLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="allenamenti" replace />} />
        <Route path="allenamenti" element={<TrainingsPage />} />
        <Route path="weekend" element={<MatchesPage />} />
        <Route path="piano" element={<WeekPlanPage />} />
        <Route path="statistiche" element={<StatsPage />} />
        <Route path="rosa" element={<RosterPage />} />
        <Route path="staff" element={<StaffPage />} />
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
  );
}

export default App;
