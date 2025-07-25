import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type UserRole = "submitter" | "approver" | "rejector" | "deleter";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  isLoading: boolean;
  isAdmin: boolean;
  userRoles: UserRole[];
  hasRole: (role: UserRole) => boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    error: any | null;
    data: any | null;
  }>;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: string
  ) => Promise<{
    error: any | null;
    data: any | null;
  }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  useEffect(() => {
    let initialLoad = true;
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Evitar chamada duplicada do fetchUserProfile
      if (initialLoad) {
        initialLoad = false;
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setUserRoles([]);
        setIsLoading(false);
      }
    });

    // Listener para restaurar estado ao voltar para a aba
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setIsLoading(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    setIsLoading(true);
    try {
      console.log("Buscando perfil do usuário:", userId);
      console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      
      // Verificar se o Supabase está configurado corretamente
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas");
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Erro ao buscar perfil do usuário:", error);

        // Se usuário não existe, criar perfil
        if (error.code === "PGRST116") {
          console.log("Usuário não encontrado, criando perfil...");
          const userData = await supabase.auth.getUser();
          if (userData.data?.user) {
            const { error: insertError } = await supabase.from("users").insert([
              {
                id: userId,
                name:
                  userData.data.user.user_metadata?.name ||
                  userData.data.user.email,
                email: userData.data.user.email,
                role: "user",
                roles: ["user"],
              },
            ]);

            if (!insertError) {
              console.log("Perfil criado, buscando novamente...");
              const { data: newData } = await supabase
                .from("users")
                .select("*")
                .eq("id", userId)
                .single();

              if (newData) {
                console.log("Novo perfil carregado:", newData);
                setProfile(newData);
                const roles = newData.roles || (newData.role ? [newData.role] : ["user"]);
                setIsAdmin(Array.isArray(roles) ? roles.includes("admin") : roles === "admin");
                setUserRoles(Array.isArray(roles) ? roles : (roles ? [roles] : ["user"]));
                setIsLoading(false);
                return;
              }
            } else {
              console.error("Erro ao criar perfil:", insertError);
            }
          }
        }

        setProfile(null);
        setIsAdmin(false);
        setUserRoles(["user"]);
      } else {
        console.log("Perfil de usuário carregado:", data);
        const roles = data.roles || (data.role ? [data.role] : ["user"]);
        setProfile(data);
        setIsAdmin(Array.isArray(roles) ? roles.includes("admin") : roles === "admin");
        setUserRoles(Array.isArray(roles) ? roles : (roles ? [roles] : ["user"]));
      }
    } catch (error) {
      console.error("Erro ao buscar perfil do usuário:", error);
      setProfile(null);
      setIsAdmin(false);
      setUserRoles(["user"]);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (email: string, password: string, name: string, role: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        return { data: null, error };
      }

      // Verificar se o perfil do usuário foi criado pelo trigger
      if (data?.user) {
        // Esperar um momento para o trigger executar
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verificar se o perfil foi criado
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .single();

        // Se não encontrou o perfil, criar manualmente
        if (profileError) {
          const { error: insertError } = await supabase.from("users").insert([
            {
              id: data.user.id,
              name,
              email,
              roles: [role],
            },
          ]);

          if (insertError) {
            console.error(
              "Erro ao criar perfil de usuário manualmente:",
              insertError,
            );
          }
        } else {
          // Se o perfil já existe, atualiza o campo roles
          await supabase.from("users").update({ roles: [role] } as any).eq("id", data.user.id);
        }
      }

      return { data, error: null };
    } catch (err) {
      console.error("Erro ao registrar usuário:", err);
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setUserRoles([]);
    setIsLoading(false);
  };

  // Função para verificar se o usuário tem um papel específico
  const hasRole = (role: UserRole): boolean => {
    if (isAdmin) return true; // Administradores têm todos os papéis
    return userRoles.includes(role);
  };

  const value = {
    session,
    user,
    profile,
    isLoading,
    isAdmin,
    userRoles,
    hasRole,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
