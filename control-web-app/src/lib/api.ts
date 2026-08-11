import axios from "axios";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Adjunta el access_token desde el store en memoria (no desde localStorage)
api.interceptors.request.use((config) => {
  const { useAuthStore } = require("@/store/auth");
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      // El refresh_token vive en una cookie SameSite=Strict (no en localStorage)
      const refresh = getCookie("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post("/api/auth/refresh/", { refresh });
          const { useAuthStore } = require("@/store/auth");
          // Actualiza token en memoria y en cookie para que el middleware del servidor pueda leerlo
          useAuthStore.setState({ token: data.access });
          const expires = new Date(Date.now() + 864e5).toUTCString();
          document.cookie = `access_token=${encodeURIComponent(data.access)}; expires=${expires}; path=/; SameSite=Strict`;
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          const { useAuthStore } = require("@/store/auth");
          useAuthStore.getState().logout();
          if (typeof window !== "undefined") window.location.href = "/login";
        }
      } else {
        const { useAuthStore } = require("@/store/auth");
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
