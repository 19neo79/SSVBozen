import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

export function ProtectedLayout() {
  const { isAdmin, signOut } = useAuth();
  const { data: settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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
          <button
            className="icon-btn menu-toggle"
            aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <button className="icon-btn" onClick={signOut}>
            Esci
          </button>
        </div>
      </header>

      <nav className={`tabs no-print${menuOpen ? ' open' : ''}`}>
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
        <NavLink to="/app/staff" className={({ isActive }) => (isActive ? 'active' : '')}>
          Staff tecnico
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

      <footer className="app-footer no-print">
        Creato da <a href="https://www.manuelriccadonna.it" target="_blank" rel="noopener noreferrer">Manuel Riccadonna</a>
      </footer>
    </div>
  );
}
