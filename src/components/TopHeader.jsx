import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopHeader({ onOpenProfile }) {
  const { getUserInitials } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="top-header">
      <button className="top-header-btn" title="Alertas" onClick={() => navigate('/alertas')}>
        <Bell size={20} />
      </button>
      <button className="avatar-btn" onClick={onOpenProfile} title="Dados Pessoais">
        {getUserInitials()}
      </button>
    </div>
  );
}
