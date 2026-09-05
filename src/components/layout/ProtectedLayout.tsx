import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

export function ProtectedLayout() {
  const { isAdmin, signOut } = useAuth();
  const { data: settings } = useSettings();

  const clubName = settings?.club_name || 'SSV Bozen Volley';
  const initials = clubName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <div className="stripe">
        <span className="r" />
        <span className="b" />
      </div>
      <header className="top">
        <div className="club">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={clubName} />
          ) : (
            <div className="logo-fallback">{initials}</div>
          )}
          <div>
            <div className="club-name">{clubName}</div>
            <div className="club-sub">Gruppo Under 14-15</div>
          </div>
        </div>
        <div className="top-actions no-print">
          <button className="icon-btn" onClick={signOut}>
            Esci
          </button>
        </div>
      </header>

      <nav className="tabs no-print">
        <NavLink to="/app/allenamenti" className={({ isActive }) => (isActive ? 'active' : '')}>
          Allenamenti
        </NavLink>
        <NavLink to="/app/weekend" className={({ isActive }) => (isActive ? 'active' : '')}>
          Weekend
        </NavLink>
        <NavLink to="/app/piano" className={({ isActive }) => (isActive ? 'active' : '')}>
          Piano settimanale
        </NavLink>
        <NavLink to="/app/statistiche" className={({ isActive }) => (isActive ? 'active' : '')}>
          Statistiche
        </NavLink>
        <NavLink to="/app/rosa" className={({ isActive }) => (isActive ? 'active' : '')}>
          Rosa
        </NavLink>
        {isAdmin && (
          <>
            <NavLink to="/app/palestre" className={({ isActive }) => (isActive ? 'active' : '')}>
              Palestre
            </NavLink>
            <NavLink to="/app/avversari" className={({ isActive }) => (isActive ? 'active' : '')}>
              Avversari
            </NavLink>
            <NavLink to="/app/impostazioni" className={({ isActive }) => (isActive ? 'active' : '')}>
              Impostazioni
            </NavLink>
          </>
        )}
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
