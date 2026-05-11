import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import { router } from "expo-router";
import { API_URL, TOKEN_KEY, PENDING_TOKEN_KEY, UNAUTHORIZED_EVENT } from "../utils/apiClient";
import { storageGet, storageSet, storageDelete } from "../utils/storage";

type Repertoire = { slug: string; label: string };

type User = {
  userId: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  classId: string;
  publicname: string;
  directoryname: string;
  repertoires: Repertoire[];
  adminRepertoires: string[];
  isAdminAnywhere: boolean;
};

type ClassSummary = { id: string; publicname: string };

type LoginResult = { ok: boolean; message?: string; errors?: { field: string; message: string }[] };
type SelectResult = { ok: boolean; message?: string };

type AuthContextType = {
  user: User | null;
  isReady: boolean;
  teachersClasses: ClassSummary[];
  followedClasses: ClassSummary[];
  pendingClassSelection: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  selectClass: (classId: string) => Promise<SelectResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [teachersClasses, setTeachersClasses] = useState<ClassSummary[]>([]);
  const [followedClasses, setFollowedClasses] = useState<ClassSummary[]>([]);
  const [pendingClassSelection, setPendingClassSelection] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    restoreSession();

    // Forcer logout sur 401 reçu par apiFetch depuis n'importe quel écran
    const authSub = DeviceEventEmitter.addListener(UNAUTHORIZED_EVENT, () => {
      setUser(null);
      setTeachersClasses([]);
      setFollowedClasses([]);
      setPendingClassSelection(false);
      router.replace("/login" as any);
    });

    // Revalider le token quand l'app revient au premier plan
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        checkSession();
      }
      appState.current = nextState;
    });

    return () => {
      authSub.remove();
      appStateSub.remove();
    };
  }, []);

  // Revalidation silencieuse (retour au premier plan) — ne touche pas isReady
  async function checkSession() {
    try {
      const token = await storageGet(TOKEN_KEY);
      if (!token) { setUser(null); return; }
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await storageDelete(TOKEN_KEY);
        setUser(null);
      }
    } catch {
      // réseau indisponible — on garde l'état courant
    }
  }

  async function restoreSession() {
    try {
      const token = await storageGet(TOKEN_KEY);
      if (!token) {
        setIsReady(true);
        return;
      }
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { user: userData } = await res.json();
        setUser(userData);
      } else {
        await storageDelete(TOKEN_KEY);
      }
    } catch {
      // réseau indisponible au démarrage — rester déconnecté
    } finally {
      setIsReady(true);
    }
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message, errors: data.errors };
      }
      if (data.pendingToken) {
        await storageSet(PENDING_TOKEN_KEY, data.pendingToken);
      }
      setTeachersClasses(data.teachersClasses ?? []);
      setFollowedClasses(data.followedClasses ?? []);
      setPendingClassSelection(true);
      return { ok: true };
    } catch {
      return { ok: false, message: "Impossible de joindre le serveur" };
    }
  }

  async function selectClass(classId: string): Promise<SelectResult> {
    try {
      const pendingToken = await storageGet(PENDING_TOKEN_KEY);
      const res = await fetch(`${API_URL}/auth/login/select-class`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, pendingToken, clientType: "mobile" }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message };
      }
      if (data.token) {
        await storageSet(TOKEN_KEY, data.token);
      }
      await storageDelete(PENDING_TOKEN_KEY);
      setUser({
        userId: data.userId ?? "",
        email: data.email,
        nom: data.nom,
        prenom: data.prenom,
        role: data.role,
        classId: data.classId,
        publicname: data.publicname,
        directoryname: data.directoryname,
        repertoires: data.repertoires ?? [],
        adminRepertoires: data.adminRepertoires ?? [],
        isAdminAnywhere: !!data.isAdminAnywhere,
      });
      setTeachersClasses([]);
      setFollowedClasses([]);
      setPendingClassSelection(false);
      return { ok: true };
    } catch {
      return { ok: false, message: "Impossible de joindre le serveur" };
    }
  }

  async function logout() {
    await storageDelete(TOKEN_KEY);
    await storageDelete(PENDING_TOKEN_KEY);
    setUser(null);
    setTeachersClasses([]);
    setFollowedClasses([]);
    setPendingClassSelection(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isReady,
        teachersClasses,
        followedClasses,
        pendingClassSelection,
        login,
        selectClass,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
