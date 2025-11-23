import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { checkSecurityBeforeAuth } from "@/lib/securityCheck";

export type Plan = "Gratuit" | "Forfait Classique" | "Forfait Pro";

export interface License {
  key: string;
  plan: Plan;
  expiresAt: string;
  daysRemaining: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  messageCount?: number;
  todayMessageCount?: number;
  messageCountDate?: string;
  license?: License;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  activateLicense: (licenseKey: string) => Promise<void>;
  incrementMessageCount: () => Promise<void>;
  canSendMessage: () => { allowed: boolean; reason?: string };
  error: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupAuthListener = () => {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!isMounted) return;

        try {
          if (firebaseUser) {
            try {
              const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
              if (!isMounted) return;

              if (userDoc.exists()) {
                const userData = userDoc.data();
                let currentPlan = userData.plan || "Gratuit";
                let license = undefined;

                if (userData.license && userData.license.expiresAt) {
                  const expiresAt = new Date(userData.license.expiresAt);
                  const now = new Date();
                  const daysRemaining = Math.ceil(
                    (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  if (daysRemaining > 0) {
                    license = {
                      key: userData.license.key,
                      plan: userData.license.plan,
                      expiresAt: userData.license.expiresAt,
                      daysRemaining,
                    };
                    currentPlan = userData.license.plan;
                  } else {
                    currentPlan = "Gratuit";
                  }
                }

                setUser({
                  id: firebaseUser.uid,
                  name: userData.name,
                  email: firebaseUser.email || "",
                  plan: currentPlan,
                  messageCount: userData.messageCount || 0,
                  todayMessageCount: userData.todayMessageCount || 0,
                  messageCountDate: userData.messageCountDate,
                  license,
                });
              } else {
                setUser({
                  id: firebaseUser.uid,
                  name: "",
                  email: firebaseUser.email || "",
                  plan: "Gratuit",
                });
              }
            } catch (docErr) {
              if (!isMounted) return;
              if (
                docErr instanceof Error &&
                (docErr.message?.includes("aborted") ||
                  docErr.message?.includes("AbortError"))
              ) {
                return;
              }
              console.error("Error fetching user document:", docErr);
              setError(
                docErr instanceof Error
                  ? docErr.message
                  : "Failed to load user profile",
              );
            }
          } else {
            setUser(null);
          }
        } catch (err) {
          if (!isMounted) return;
          console.error("Error in auth state change:", err);
          setError(err instanceof Error ? err.message : "Failed to load user");
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      });
    };

    setupAuthListener();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          console.error("Error unsubscribing from auth:", err);
        }
      }
    };
  }, []);

  const register = async (
    name: string,
    email: string,
    password: string,
  ): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      const securityCheck = await checkSecurityBeforeAuth(email, true);

      if (!securityCheck.allowed) {
        const errorMsg =
          securityCheck.reason || "Registration blocked by security check";
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const firebaseUser = userCredential.user;

      await setDoc(doc(db, "users", firebaseUser.uid), {
        name,
        email,
        plan: "Gratuit",
        createdAt: new Date().toISOString(),
      });

      setUser({
        id: firebaseUser.uid,
        name,
        email,
        plan: "Gratuit",
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Registration failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      const securityCheck = await checkSecurityBeforeAuth(email, false);

      if (!securityCheck.allowed) {
        const errorMsg =
          securityCheck.reason || "Login blocked by security check";
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const firebaseUser = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          id: firebaseUser.uid,
          name: userData.name,
          email: firebaseUser.email || "",
          plan: userData.plan || "Gratuit",
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      setError(errorMsg);
      throw err;
    }
  };

  const activateLicense = async (licenseKey: string): Promise<void> => {
    if (!user) return;

    try {
      setError(null);
      const response = await fetch("/api/activate-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, licenseKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to activate license");
      }

      const { license } = await response.json();
      const expiresAt = new Date(license.expiresAt);
      const now = new Date();
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const updatedUser = {
        ...user,
        plan: license.plan,
        license: {
          key: licenseKey,
          plan: license.plan,
          expiresAt: license.expiresAt,
          daysRemaining,
        },
      };
      setUser(updatedUser);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to activate license";
      setError(errorMsg);
      throw err;
    }
  };

  const incrementMessageCount = async (): Promise<void> => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      const lastCountDate = user.messageCountDate?.split("T")[0];
      let todayCount = user.todayMessageCount || 0;
      let totalCount = user.messageCount || 0;

      if (lastCountDate !== today) {
        todayCount = 1;
      } else {
        todayCount = (todayCount || 0) + 1;
      }
      totalCount = (totalCount || 0) + 1;

      await setDoc(
        doc(db, "users", user.id),
        {
          messageCount: totalCount,
          todayMessageCount: todayCount,
          messageCountDate: new Date().toISOString(),
        },
        { merge: true }
      );

      setUser({
        ...user,
        messageCount: totalCount,
        todayMessageCount: todayCount,
        messageCountDate: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to increment message count:", err);
    }
  };

  const canSendMessage = (): { allowed: boolean; reason?: string } => {
    if (!user) return { allowed: false, reason: "Not authenticated" };

    if (user.plan === "Gratuit") {
      if ((user.messageCount || 0) >= 10) {
        return { allowed: false, reason: "Free plan limit reached (10 messages)" };
      }
      return { allowed: true };
    }

    if (user.plan === "Forfait Classique") {
      if ((user.todayMessageCount || 0) >= 1000) {
        return { allowed: false, reason: "Daily limit reached (1000 messages)" };
      }
      return { allowed: true };
    }

    if (user.plan === "Forfait Pro") {
      if ((user.todayMessageCount || 0) >= 5000) {
        return { allowed: false, reason: "Daily limit reached (5000 messages)" };
      }
      return { allowed: true };
    }

    return { allowed: false };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        register,
        login,
        logout,
        updatePlan,
        incrementMessageCount,
        canSendMessage,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
