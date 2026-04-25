import { useState } from 'react';
import { X, User, Phone, Mail, Building2, MapPin, Lock, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateDoc, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword, deleteUser } from 'firebase/auth';
import { db } from '../firebase';

export default function DadosPessoais({ onClose }) {
  const { user, userData, empresaId, getUserInitials } = useAuth();

  const [nome, setNome] = useState(userData?.userName || '');
  const [telefone, setTelefone] = useState(userData?.telefone || '');
  const [email, setEmail] = useState(userData?.email || user?.email || '');
  const [empresa, setEmpresa] = useState(empresaId || '');
  const [localizacao, setLocalizacao] = useState(userData?.localizacao || '');

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [senhaSuccess, setSenhaSuccess] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = async () => {
    if (!empresaId || !userData?.docId) return;
    setSaving(true);
    try {
      const userDocRef = doc(db, 'empresas', empresaId, 'usuarios', userData.docId);

      // Check if empresa changed (company transfer)
      if (empresa !== empresaId) {
        const newCompanyDoc = await getDoc(doc(db, 'empresas', empresa));
        if (newCompanyDoc.exists()) {
          // Create user doc in new company
          await setDoc(doc(db, 'empresas', empresa, 'usuarios', userData.docId), {
            email,
            userName: nome,
            userId: user.uid,
            telefone,
            localizacao,
            dataLogin: userData.dataLogin,
            dataAtualizacao: new Date().toISOString(),
            senha: 'Gerenciada pelo Firebase Auth',
          });
          // Delete from old company
          await deleteDoc(userDocRef);
        }
      } else {
        await updateDoc(userDocRef, {
          userName: nome,
          email,
          telefone,
          localizacao,
          dataAtualizacao: new Date().toISOString(),
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setSenhaError('');
    setSenhaSuccess('');

    if (novaSenha.length < 8) {
      setSenhaError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaError('As senhas não coincidem.');
      return;
    }
    if (!senhaAtual) {
      setSenhaError('Insira sua senha atual.');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, novaSenha);
      setSenhaSuccess('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setTimeout(() => setSenhaSuccess(''), 4000);
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setSenhaError('Senha atual incorreta.');
      } else {
        setSenhaError('Erro ao alterar senha. Tente novamente.');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Tem certeza que deseja deletar sua conta? Esta ação é irreversível.')) return;

    try {
      if (empresaId && userData?.docId) {
        await deleteDoc(doc(db, 'empresas', empresaId, 'usuarios', userData.docId));
      }
      await deleteUser(user);
      onClose();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        alert('Por segurança, faça login novamente antes de deletar sua conta.');
      } else {
        alert('Erro ao deletar conta. Tente novamente.');
      }
    }
  };

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <div className="side-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Dados Pessoais</h1>
            <p style={{ fontSize: 14, color: '#6B7280' }}>Gerencie as informações de perfil</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Profile Info Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', backgroundColor: '#2563EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 20, fontWeight: 700, position: 'relative'
            }}>
              {getUserInitials()}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{userData?.userName || 'Usuário'}</p>
              <p style={{ fontSize: 14, color: '#6B7280' }}>Administrador</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>{empresaId}</p>
            </div>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Informações de Perfil</h3>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Atualize seus dados pessoais e de contato</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Nome completo</label>
              <div className="input-with-icon">
                <User size={18} />
                <input className="input-field" placeholder="Usuário" value={nome} onChange={e => setNome(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Telefone</label>
                <div className="input-with-icon">
                  <Phone size={18} />
                  <input className="input-field" placeholder="(92) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Email</label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input className="input-field" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Empresa</label>
                <div className="input-with-icon">
                  <Building2 size={18} />
                  <input className="input-field" placeholder="Empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Localização</label>
                <div className="input-with-icon">
                  <MapPin size={18} />
                  <input className="input-field" placeholder="Manaus, AM" value={localizacao} onChange={e => setLocalizacao(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {saveSuccess && (
            <p style={{ fontSize: 14, color: '#22C55E', marginTop: 12 }}>Alterações salvas com sucesso!</p>
          )}

          <button className="btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={handleSaveProfile} disabled={saving}>
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>

        {/* Password Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Alterar Senha</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Senha Atual</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input className="input-field" type="password" placeholder="Senha atual" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Nova Senha</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input className="input-field" type="password" placeholder="Mínimo 8 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>Confirmar Nova Senha</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input className="input-field" type="password" placeholder="Confirmar nova senha" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} />
              </div>
            </div>
          </div>

          {senhaError && <p style={{ fontSize: 14, color: '#EF4444', marginTop: 12 }}>{senhaError}</p>}
          {senhaSuccess && <p style={{ fontSize: 14, color: '#22C55E', marginTop: 12 }}>{senhaSuccess}</p>}

          <button className="btn-secondary" style={{ marginTop: 16, width: '100%' }} onClick={handleChangePassword}>
            <Lock size={16} />
            Confirmar Senha
          </button>
        </div>

        {/* Delete Account */}
        <button className="btn-danger" style={{ width: '100%' }} onClick={handleDeleteAccount}>
          <Trash2 size={16} />
          Deletar Conta
        </button>
      </div>
    </>
  );
}
