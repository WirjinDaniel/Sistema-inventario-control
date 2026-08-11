import { create } from "zustand";

interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: "ADMIN" | "CAJERO" | "INVENTARIO";
  colmado: number | null;
  is_superuser?: boolean;
}

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (token: string, refresh: string, usuario: Usuario) => void;
  logout: () => void;
  hydrate: () => void;
  esAdmin: () => boolean;
  esCajero: () => boolean;
  esSuperadmin: () => boolean;
}

// Cookies con SameSite=Strict son más seguras que localStorage para tokens
function setSecureCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}


function deleteSecureCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  token: null,
  hydrated: false,

  setAuth: (token, refresh, usuario) => {
    // access_token: memoria + cookie SameSite=Strict (el middleware del servidor lo necesita)
    // refresh_token: cookie SameSite=Strict (más seguro que localStorage)
    // usuario: localStorage solo para nombre/rol (sin tokens)
    setSecureCookie("access_token", token, 1);   // expira en 1 día (sincronizado con JWT 60 min)
    setSecureCookie("refresh_token", refresh, 7);
    localStorage.setItem("usuario", JSON.stringify(usuario));
    set({ token, usuario });
  },

  logout: () => {
    deleteSecureCookie("access_token");
    deleteSecureCookie("refresh_token");
    localStorage.removeItem("usuario");
    set({ token: null, usuario: null });
  },

  hydrate: () => {
    if (get().hydrated) return;
    // Restauramos datos del usuario desde localStorage (no contiene tokens)
    const raw = localStorage.getItem("usuario");
    if (raw) {
      try {
        const usuario = JSON.parse(raw) as Usuario;
        // access_token está en memoria: vacío tras recarga.
        // El interceptor de api.ts renovará automáticamente usando refresh_token cookie.
        set({ usuario });
      } catch {
        localStorage.removeItem("usuario");
      }
    }
    set({ hydrated: true });
  },

  // ADMIN de colmado — excluye SUPERADMIN (que también tiene rol='ADMIN' en BD)
  esAdmin: () => get().usuario?.rol === "ADMIN" && !get().usuario?.is_superuser,
  esCajero: () => ["ADMIN", "CAJERO"].includes(get().usuario?.rol ?? "") && !get().usuario?.is_superuser,
  esSuperadmin: () => {
    // Prioridad 1: token en memoria (más seguro, anti-manipulación de localStorage)
    const token = get().token;
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload?.is_superuser === true) return true;
    }
    // Fallback tras recarga de página: token es null en memoria pero usuario persiste
    // en localStorage. El middleware del servidor valida el JWT cookie independientemente.
    return get().usuario?.is_superuser === true;
  },
}));
