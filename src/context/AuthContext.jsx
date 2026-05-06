import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collectionGroup, query, where, getDocs, doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsCompanySetup, setNeedsCompanySetup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setNeedsCompanySetup(false);
        try {
          // 1. Buscar por UID (login normal ou Google já vinculado)
          const uidQ = query(collectionGroup(db, 'usuarios'), where('userId', '==', firebaseUser.uid));
          const uidSnapshot = await getDocs(uidQ);

          if (!uidSnapshot.empty) {
            // Usuário encontrado por UID — fluxo normal
            const userDoc = uidSnapshot.docs[0];
            const data = userDoc.data();
            const companyId = userDoc.ref.parent.parent?.id;
            setUserData({ ...data, docId: userDoc.id });
            setEmpresaId(companyId);
            setNeedsCompanySetup(false);
          } else {
            // 2. Não encontrado por UID — buscar por email para vincular contas
            const emailQ = query(collectionGroup(db, 'usuarios'), where('email', '==', firebaseUser.email));
            const emailSnapshot = await getDocs(emailQ);

            if (!emailSnapshot.empty) {
              // Email já existe em outra conta — vincular Google UID à mesma empresa
              const existingDoc = emailSnapshot.docs[0];
              const existingData = existingDoc.data();
              const companyId = existingDoc.ref.parent.parent?.id;

              // Criar documento de usuário com o UID do Google na mesma empresa
              await setDoc(doc(db, 'empresas', companyId, 'usuarios', firebaseUser.uid), {
                ...existingData,
                userId: firebaseUser.uid,
                photoURL: firebaseUser.photoURL || existingData.photoURL || '',
                authProvider: 'google',
              });

              setUserData({
                ...existingData,
                userId: firebaseUser.uid,
                photoURL: firebaseUser.photoURL || existingData.photoURL || '',
              });
              setEmpresaId(companyId);
              setNeedsCompanySetup(false);
            } else {
              // 3. Nem por UID nem por email — usuário novo, precisa completar cadastro
              setNeedsCompanySetup(true);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
          setNeedsCompanySetup(true);
        }
      } else {
        setUser(null);
        setUserData(null);
        setEmpresaId(null);
        setNeedsCompanySetup(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const completeCompanySetup = async (companyName) => {
    if (!user) return;

    const uid = user.uid;
    const nomeEmpresa = companyName.trim();
    const nomeUsuario = user.displayName || user.email?.split('@')[0] || 'Usuário';
    const emailUsuario = user.email || '';

    // Criar empresa
    await setDoc(doc(db, 'empresas', nomeEmpresa), {
      nome: nomeEmpresa,
      criadoEm: new Date().toISOString(),
    }, { merge: true });

    // Criar usuário
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'usuarios', uid), {
      dataLogin: new Date().toISOString(),
      email: emailUsuario,
      senha: user.providerData?.[0]?.providerId === 'google.com' ? 'Gerenciada pelo Google' : 'Gerenciada pelo Firebase Auth',
      userId: uid,
      userName: nomeUsuario,
      photoURL: user.photoURL || '',
      authProvider: user.providerData?.[0]?.providerId || 'password',
    });

    // Criar central
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'centrais', 'macRPI'), {
      ip_local: '',
      nome: '',
      online: false,
    });

    // Criar ambiente padrão
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1'), {
      config: { andar: '', area: '', nome: '', tipo: '' },
      dados: { central_id: 'central 1', criadoEM: new Date().toISOString(), nome: 'ambiente 1', receptor_id: 'receptor1' },
      sensores: { iluminação: 0, presenca: false, temperatura: 0, umidade: 0 },
    }, { merge: true });

    // Histórico do ambiente
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1', 'historico', 'registro_inicial'), {
      co2: 0, qualidade_ar: 100, temperatura: 0, umidade: 0,
      timestamp: new Date().toISOString(), luminosidade: 0, presenca: 0,
    });

    // Periféricos
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1', 'perifericos', 'ar_condicionado'), {
      geral: { ligado: false, marca: '', modelo: '', temperatura: 24 },
    });

    // Agendamentos
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1', 'agendamentos', 'registro_inicial'), {
      timestamp: new Date().toISOString(), status: 'inicializado', observacao: 'Registro inicial',
    });

    // Histórico geral
    await addDoc(collection(db, 'empresas', nomeEmpresa, 'historico_geral'), {
      co2_medio: 0, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      indice_conforto: 0, qual_do_ar: 0, temperatura_media: 0,
      timestamp: Date.now(), luminosidade: 0, presenca: 0,
    });

    // Atualizar estado
    setEmpresaId(nomeEmpresa);
    setUserData({
      dataLogin: new Date().toISOString(),
      email: emailUsuario,
      userId: uid,
      userName: nomeUsuario,
      photoURL: user.photoURL || '',
    });
    setNeedsCompanySetup(false);
  };

  const cancelCompanySetup = async () => {
    try {
      await signOut(auth);
    } catch (e) { /* ignore */ }
    setUser(null);
    setUserData(null);
    setEmpresaId(null);
    setNeedsCompanySetup(false);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setEmpresaId(null);
      setNeedsCompanySetup(false);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const getUserInitials = () => {
    if (userData?.userName) {
      return userData.userName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  return (
    <AuthContext.Provider value={{
      user, userData, empresaId, loading, logout, getUserInitials,
      needsCompanySetup, completeCompanySetup, cancelCompanySetup
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
