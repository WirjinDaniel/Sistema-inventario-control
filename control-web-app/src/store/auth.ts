import { create } from "zustand";

interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: "ADMIN" | "CAJERO" | "INVENTARIO";
  colmado: number | null;
}

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  setAuth: (token: string, refresh: string, usuario: Usuario) => void;
  logout: () => void;
  esAdmin: () => boolean;
  esCajero: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  token: null,

  setAuth: (token, refresh, usuario) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("refresh_token", refresh);
    set({ token, usuario });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ token: null, usuario: null });
  },

  esAdmin: () => get().usuario?.rol === "ADMIN",
  esCajero: () => ["ADMIN", "CAJERO"].includes(get().usuario?.rol ?? ""),
}));
