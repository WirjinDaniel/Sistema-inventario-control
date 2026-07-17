"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShoppingCart, Lock, User } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login/", { username, password });
      setAuth(data.access, data.refresh, data.usuario);
      toast.success(`¡Bienvenido, ${data.usuario.nombre}!`);
      router.push("/dashboard");
    } catch {
      toast.error("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">

      {/* Fondo animado con gradiente */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl animate-ping" style={{ animationDuration: "4s" }} />
      </div>

      {/* Grid de puntos decorativos */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4">


        {/* Formulario */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40 mb-4
              transition-transform duration-300 hover:scale-105">
              <ShoppingCart size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Colmado POS</h1>
            <p className="text-slate-400 text-sm mt-1">Sistema de Inventario y Ventas</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Campo usuario */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Usuario</label>
              <div className={`flex items-center gap-3 bg-white/5 border rounded-xl px-4 py-3 transition-all duration-200 ${
                focused === "user" ? "border-indigo-500 shadow-lg shadow-indigo-500/20 bg-white/10" : "border-white/10 hover:border-white/20"
              }`}>
                <User size={16} className={`transition-colors duration-200 ${focused === "user" ? "text-indigo-400" : "text-slate-500"}`} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocused("user")}
                  onBlur={() => setFocused(null)}
                  placeholder="Tu usuario"
                  autoFocus
                  required
                  className="flex-1 bg-transparent text-white placeholder:text-slate-600 text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Campo contraseña */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Contraseña</label>
              <div className={`flex items-center gap-3 bg-white/5 border rounded-xl px-4 py-3 transition-all duration-200 ${
                focused === "pass" ? "border-indigo-500 shadow-lg shadow-indigo-500/20 bg-white/10" : "border-white/10 hover:border-white/20"
              }`}>
                <Lock size={16} className={`transition-colors duration-200 ${focused === "pass" ? "text-indigo-400" : "text-slate-500"}`} />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("pass")}
                  onBlur={() => setFocused(null)}
                  placeholder="Tu contraseña"
                  required
                  className="flex-1 bg-transparent text-white placeholder:text-slate-600 text-sm focus:outline-none"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="text-slate-500 hover:text-slate-300 transition-colors duration-150">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Botón */}
            <button type="submit" disabled={loading}
              className="relative mt-2 w-full py-3.5 rounded-xl font-bold text-sm text-white overflow-hidden
                bg-gradient-to-r from-indigo-600 to-violet-600
                hover:from-indigo-500 hover:to-violet-500
                active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
                transition-all duration-200">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Entrando...
                </span>
              ) : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Colmado POS v1.0 · Sistema de Inventario
        </p>
      </div>
    </div>
  );
}
