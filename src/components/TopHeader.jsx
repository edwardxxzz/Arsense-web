import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TopHeader({ onOpenProfile }) {
  const { getUserInitials } = useAuth();

  return (
    <div className="top-header">
      <button className="top-header-btn" title="Notificações">
        <Bell size={20} />
      </button>
      <button className="avatar-btn" onClick={onOpenProfile} title="Dados Pessoais">
        {getUserInitials()}
      </button>
    </div>
  );
}
