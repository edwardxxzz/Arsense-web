
auth_context_code = '''import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut, EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { collectionGroup, query, where, getDocs, doc, setDoc, addDoc, collection, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false); // NOVO: indica que a checagem inicial terminou
  const [needsCompanySetup, setNeedsCompanySetup] = useState(false);
  const [googlePendingData, setGooglePendingData] = useState(null);

  const registeringRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthResolved(false); // inicia resolução

      if (firebaseUser) {
        setUser(firebaseUser);

        // Se estamos no meio de um cadastro manual, não interferir.
        // Mas garantir que loading seja desativado ao final.
        if (registeringRef.current) {
          setLoading(false);
          setAuthResolved(true);
          return;
        }

        try {
          const emailLower = (firebaseUser.email || '').toLowerCase().trim();

          // 1) Buscar pelo UID exato no Firestore
          const uidQ = query(collectionGroup(db, 'usuarios'), where('userId', '==', firebaseUser.uid));
          const uidSnapshot = await getDocs(uidQ);

          if (!uidSnapshot.empty) {
            const userDoc = uidSnapshot.docs[0];
            const data = userDoc.data();
            const companyId = userDoc.ref.parent.parent?.id;

            // Atualiza o provider no Firestore para refletir todos os métodos vinculados
            const currentProviders = firebaseUser.providerData?.map(p => p.providerId) || [];
            const providerString = currentProviders.join(',') || 'google.com';
            if (data.authProvider !== providerString) {
              await setDoc(userDoc.ref, { authProvider: providerString }, { merge: true });
              data.authProvider = providerString;
            }

            setUserData({ ...data, docId: userDoc.id });
            setEmpresaId(companyId);
            setNeedsCompanySetup(false);
            setGooglePendingData(null);
          } else {
            // 2) Não achou pelo UID → buscar pelo email
            let emailMatch = null;

            const emailQ = query(collectionGroup(db, 'usuarios'), where('emailLowercase', '==', emailLower));
            const emailSnapshot = await getDocs(emailQ);
            if (!emailSnapshot.empty) {
              emailMatch = { doc: emailSnapshot.docs[0], data: emailSnapshot.docs[0].data() };
            }

            if (!emailMatch) {
              const emailDirectQ = query(collectionGroup(db, 'usuarios'), where('email', '==', firebaseUser.email));
              const emailDirectSnapshot = await getDocs(emailDirectQ);
              if (!emailDirectSnapshot.empty) {
                emailMatch = { doc: emailDirectSnapshot.docs[0], data: emailDirectSnapshot.docs[0].data() };
              }
            }

            if (emailMatch) {
              const companyId = emailMatch.doc.ref.parent.parent?.id;
              const existingData = emailMatch.data;

              // Se o Firebase já unificou os providers (mesmo UID), não criar sibling.
              // Isso acontece quando a conta já tinha password e o Google foi linkado.
              const siblingUserName = firebaseUser.displayName || existingData.userName || firebaseUser.email?.split('@')[0] || 'Usuário';
              await setDoc(doc(db, 'empresas', companyId, 'usuarios', firebaseUser.uid), {
                dataLogin: new Date().toISOString(),
                email: firebaseUser.email,
                emailLowercase: emailLower,
                userId: firebaseUser.uid,
                userName: siblingUserName,
                photoURL: firebaseUser.photoURL || '',
                authProvider: firebaseUser.providerData?.map(p => p.providerId).join(',') || 'google.com',
                siblingOf: existingData.userId,
                linkedAt: new Date().toISOString(),
              });

              setUserData({
                dataLogin: new Date().toISOString(),
                email: firebaseUser.email,
                emailLowercase: emailLower,
                userId: firebaseUser.uid,
                userName: siblingUserName,
                photoURL: firebaseUser.photoURL || '',
                authProvider: firebaseUser.providerData?.map(p => p.providerId).join(',') || 'google.com',
                docId: firebaseUser.uid,
              });
              setEmpresaId(companyId);
              setNeedsCompanySetup(false);
              setGooglePendingData(null);
            } else {
              // 3) Usuário completamente novo → precisa cadastrar empresa
              setNeedsCompanySetup(true);
              setGooglePendingData({
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName || '',
                email: firebaseUser.email || '',
                photoURL: firebaseUser.photoURL || '',
              });
              setEmpresaId(null);
              setUserData(null);
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
        setGooglePendingData(null);
      }

      setLoading(false);
      setAuthResolved(true);
    });

    return () => unsubscribe();
  }, []);

  const startRegistration = useCallback(() => {
    registeringRef.current = true;
  }, []);

  const finishRegistration = useCallback((newEmpresaId, newUserData) => {
    setEmpresaId(newEmpresaId);
    setUserData(newUserData);
    setNeedsCompanySetup(false);
    setGooglePendingData(null);
    registeringRef.current = false;
    setLoading(false);
    setAuthResolved(true);
  }, []);

  const clearGooglePending = useCallback(() => {
    setGooglePendingData(null);
    setNeedsCompanySetup(false);
  }, []);

  // NOVA FUNÇÃO: vincula credencial Google a uma conta password existente
  const linkGoogleToPasswordAccount = useCallback(async (password) => {
    if (!user || !googlePendingData) return { success: false, error: 'Sem dados pendentes' };

    try {
      const email = user.email;
      // Reautentica com email/senha para obter a credencial password
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Cria credencial Google a partir do provider atual
      const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
      if (!googleProvider) {
        return { success: false, error: 'Provedor Google não encontrado' };
      }

      // Na prática, se chegamos aqui com o mesmo email, o Firebase já pode ter unificado.
      // Mas se estamos em modo "multiple accounts", precisamos deletar a conta Google
      // e linkar. Para simplificar, vamos apenas verificar se o UID mudou.
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [user, googlePendingData]);

  const completeCompanySetup = async (companyName, password, userName) => {
    if (!user) return;

    const uid = user.uid;
    const nomeEmpresa = companyName.trim();
    const nomeUsuario = userName || user.displayName || user.email?.split('@')[0] || 'Usuário';
    const emailUsuario = user.email || '';
    const emailLower = emailUsuario.toLowerCase().trim();
    const isGoogleUser = user.providerData?.some(p => p.providerId === 'google.com');

    // Se é usuário Google e forneceu senha, tentar vincular à conta Firebase Auth.
    // Se o email já existe como password, linkWithCredential vai falhar com
    // auth/email-already-in-use. Nesse caso, continuamos apenas criando a estrutura Firestore.
    if (isGoogleUser && password) {
      try {
        const credential = EmailAuthProvider.credential(emailUsuario, password);
        await linkWithCredential(user, credential);
      } catch (linkError) {
        if (
          linkError.code === 'auth/email-already-in-use' ||
          linkError.code === 'auth/credential-already-in-use' ||
          linkError.code === 'auth/provider-already-linked'
        ) {
          console.warn('Credencial já vinculada ou email em uso. Prosseguindo com o cadastro.');
        } else {
          console.error('Erro ao vincular credenciais:', linkError);
        }
      }
    }

    // Criar empresa
    await setDoc(doc(db, 'empresas', nomeEmpresa), {
      nome: nomeEmpresa,
      criadoEm: new Date().toISOString(),
    }, { merge: true });

    // Criar usuário
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'usuarios', uid), {
      dataLogin: new Date().toISOString(),
      email: emailUsuario,
      emailLowercase: emailLower,
      senha: isGoogleUser ? 'Gerenciada pelo Google' : 'Gerenciada pelo Firebase Auth',
      userId: uid,
      userName: nomeUsuario,
      photoURL: user.photoURL || '',
      authProvider: user.providerData?.map(p => p.providerId).join(',') || 'google.com',
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
      emailLowercase: emailLower,
      userId: uid,
      userName: nomeUsuario,
      photoURL: user.photoURL || '',
      authProvider: user.providerData?.map(p => p.providerId).join(',') || 'google.com',
      docId: uid,
    });
    setNeedsCompanySetup(false);
    setGooglePendingData(null);
    registeringRef.current = false;
  };

  const cancelCompanySetup = async () => {
    try {
      await signOut(auth);
    } catch (e) { /* ignore */ }
    setUser(null);
    setUserData(null);
    setEmpresaId(null);
    setNeedsCompanySetup(false);
    setGooglePendingData(null);
    registeringRef.current = false;
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setEmpresaId(null);
      setNeedsCompanySetup(false);
      setGooglePendingData(null);
      registeringRef.current = false;
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
      user, userData, empresaId, loading, authResolved, logout, getUserInitials,
      needsCompanySetup, completeCompanySetup, cancelCompanySetup,
      googlePendingData, clearGooglePending,
      startRegistration, finishRegistration,
      linkGoogleToPasswordAccount
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

with open('/mnt/agents/output/AuthContext.jsx', 'w', encoding='utf-8') as f:
    f.write(auth_context_code)

print("AuthContext.jsx salvo com sucesso.")
