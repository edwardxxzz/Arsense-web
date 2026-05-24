import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
  const [googlePendingData, setGooglePendingData] = useState(null);

  const registeringRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        if (registeringRef.current) {
          return;
        }

        try {
          const emailLower = (firebaseUser.email || '').toLowerCase().trim();

          // 1. Buscar por UID
          const uidQ = query(
            collectionGroup(db, 'usuarios'),
            where('userId', '==', firebaseUser.uid)
          );
          const uidSnapshot = await getDocs(uidQ);

          if (!uidSnapshot.empty) {
            // Usuário encontrado por UID — fluxo normal
            const userDoc = uidSnapshot.docs[0];
            const data = userDoc.data();
            const companyId = userDoc.ref.parent.parent?.id;
            setUserData({ ...data, docId: userDoc.id });
            setEmpresaId(companyId);
            setNeedsCompanySetup(false);
            setGooglePendingData(null);
          } else {
            // 2. Não encontrado por UID — buscar por email
            let emailMatch = null;

            // Tenta por emailLowercase (requer índice no Firestore)
            try {
              const emailQ = query(
                collectionGroup(db, 'usuarios'),
                where('emailLowercase', '==', emailLower)
              );
              const emailSnapshot = await getDocs(emailQ);
              if (!emailSnapshot.empty) {
                emailMatch = {
                  doc: emailSnapshot.docs[0],
                  data: emailSnapshot.docs[0].data(),
                };
              }
            } catch (indexErr) {
              // Índice ainda não criado no Firestore — tenta fallback
              console.warn('Índice emailLowercase ausente, tentando fallback:', indexErr.message);
            }

            // Fallback: busca por campo email direto
            if (!emailMatch) {
              try {
                const emailDirectQ = query(
                  collectionGroup(db, 'usuarios'),
                  where('email', '==', firebaseUser.email)
                );
                const emailDirectSnapshot = await getDocs(emailDirectQ);
                if (!emailDirectSnapshot.empty) {
                  emailMatch = {
                    doc: emailDirectSnapshot.docs[0],
                    data: emailDirectSnapshot.docs[0].data(),
                  };
                }
              } catch (indexErr2) {
                console.warn('Fallback de email também falhou:', indexErr2.message);
              }
            }

            if (emailMatch) {
              // Email já existe — criar doc "irmão" na mesma empresa
              const companyId = emailMatch.doc.ref.parent.parent?.id;
              const existingData = emailMatch.data;
              const siblingUserName =
                firebaseUser.displayName ||
                existingData.userName ||
                firebaseUser.email?.split('@')[0] ||
                'Usuário';

              // Salva todos os providers reais para não bloquear login manual
              const providers = firebaseUser.providerData?.map(p => p.providerId) || [];

              await setDoc(
                doc(db, 'empresas', companyId, 'usuarios', firebaseUser.uid),
                {
                  dataLogin: new Date().toISOString(),
                  email: firebaseUser.email,
                  emailLowercase: emailLower,
                  userId: firebaseUser.uid,
                  userName: siblingUserName,
                  photoURL: firebaseUser.photoURL || '',
                  authProvider: providers.join(','),
                  siblingOf: existingData.userId,
                  linkedAt: new Date().toISOString(),
                }
              );

              setUserData({
                dataLogin: new Date().toISOString(),
                email: firebaseUser.email,
                emailLowercase: emailLower,
                userId: firebaseUser.uid,
                userName: siblingUserName,
                photoURL: firebaseUser.photoURL || '',
                authProvider: providers.join(','),
                docId: firebaseUser.uid,
              });
              setEmpresaId(companyId);
              setNeedsCompanySetup(false);
              setGooglePendingData(null);
            } else {
              // 3. Usuário novo do Google — precisa completar cadastro
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
          // Não força needsCompanySetup=true em erros genéricos
          // para não travar usuários já cadastrados
          setLoading(false);
          return;
        }
      } else {
        setUser(null);
        setUserData(null);
        setEmpresaId(null);
        setNeedsCompanySetup(false);
        setGooglePendingData(null);
      }
      setLoading(false);
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
  }, []);

  const clearGooglePending = useCallback(() => {
    setGooglePendingData(null);
    setNeedsCompanySetup(false);
  }, []);

  const completeCompanySetup = async (companyName, password, userName) => {
    if (!user) return;

    const uid = user.uid;
    const nomeEmpresa = companyName.trim();
    const nomeUsuario = userName || user.displayName || user.email?.split('@')[0] || 'Usuário';
    const emailUsuario = user.email || '';
    const emailLower = emailUsuario.toLowerCase().trim();
    const isGoogleUser = user.providerData?.some(p => p.providerId === 'google.com');

    // Vincular email+senha à conta Google para permitir login manual futuro
    if (isGoogleUser && password) {
      try {
        const { EmailAuthProvider, linkWithCredential } = await import('firebase/auth');
        // ✅ CORREÇÃO: credential() — não credentialWithEmail() (método inexistente)
        const credential = EmailAuthProvider.credential(emailUsuario, password);
        await linkWithCredential(user, credential);
      } catch (linkError) {
        if (
          linkError.code === 'auth/email-already-in-use' ||
          linkError.code === 'auth/credential-already-in-use' ||
          linkError.code === 'auth/provider-already-linked'
        ) {
          console.warn('Credencial já vinculada. Prosseguindo com o cadastro.');
        } else {
          console.error('Erro ao vincular credenciais:', linkError);
          // Não interrompe — Firestore será criado mesmo assim
        }
      }
    }

    // Criar empresa
    await setDoc(doc(db, 'empresas', nomeEmpresa), {
      nome: nomeEmpresa,
      criadoEm: new Date().toISOString(),
    }, { merge: true });

    // Criar usuário
    const providers = user.providerData?.map(p => p.providerId) || [];
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'usuarios', uid), {
      dataLogin: new Date().toISOString(),
      email: emailUsuario,
      emailLowercase: emailLower,
      senha: isGoogleUser ? 'Gerenciada pelo Google' : 'Gerenciada pelo Firebase Auth',
      userId: uid,
      userName: nomeUsuario,
      photoURL: user.photoURL || '',
      authProvider: providers.join(','),
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
      dados: { central_id: 'central 1', criadoEm: new Date().toISOString(), nome: 'ambiente 1', receptor_id: 'receptor1' },
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

    // Alertas — documentos rpi e amb
    const alertasBase = {
      schema: 'alertas/v1',
      origem: '',
      central_id: '',
      atualizadoEm: new Date().toISOString(),
      status: 'ok',
      totalAtivos: 0,
      itens: {},
    };
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'alertas', 'rpi'), {
      ...alertasBase,
      origem: 'rpi',
    });
    await setDoc(doc(db, 'empresas', nomeEmpresa, 'alertas', 'amb'), {
      ...alertasBase,
      origem: 'amb',
    });

    // Histórico geral
    await addDoc(collection(db, 'empresas', nomeEmpresa, 'historico_geral'), {
      co2_medio: 0,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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
      authProvider: providers.join(','),
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
      user, userData, empresaId, loading, logout, getUserInitials,
      needsCompanySetup, completeCompanySetup, cancelCompanySetup,
      googlePendingData, clearGooglePending,
      startRegistration, finishRegistration
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