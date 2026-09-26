import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

const C = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await AsyncStorage.getItem("freshcart_user");
        if (u && mounted) {
          try {
            setUser(JSON.parse(u));
          } catch (e) {
            await AsyncStorage.removeItem("freshcart_user");
          }
        }
      } catch (e) {
        console.warn("Auth restore failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async (d) => {
    await AsyncStorage.setItem("freshcart_token", d.token);
    await AsyncStorage.setItem("freshcart_user", JSON.stringify(d.user));
    setUser(d.user);
  };

  const login = async (e, p) => {
    const { data } = await api.post("/auth/login", { email: e, password: p });
    await save(data);
  };

  const register = async (x) => {
    const { data } = await api.post("/auth/register", x);
    await save(data);
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(["freshcart_token", "freshcart_user"]);
    } finally {
      setUser(null);
    }
  };

  return (
    <C.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </C.Provider>
  );
}

export const useAuth = () => useContext(C);
