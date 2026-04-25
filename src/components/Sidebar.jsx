import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Zap,
  Bell,
  BarChart3,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="18" fill="#2563EB"/>
          <path d="M10 18L16 12L22 18L16 24Z" fill="white"/>
          <path d="M16 12L22 18L28 12" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
        <span>Arsense</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/home"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>
        <NavLink
          to="/ambientes"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Building2 size={20} />
          Ambientes
        </NavLink>
        <NavLink
          to="/perifericos"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Zap size={20} />
          Periféricos
        </NavLink>
        <NavLink
          to="/alertas"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Bell size={20} />
          Alertas
        </NavLink>
        <NavLink
          to="/relatorios"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <BarChart3 size={20} />
          Relatórios
        </NavLink>
      </nav>

      <div className="sidebar-logout">
        <button onClick={handleLogout}>
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  );
}
