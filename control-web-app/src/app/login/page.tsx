"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, AlertCircle, ArrowRight } from "lucide-react";
import Image from "next/image";
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
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  function validate(): boolean {
    const e: { username?: string; password?: string } = {};
    if (!username.trim()) e.username = "El usuario es requerido.";
    if (!password) e.password = "La contraseña es requerida.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login/", { username, password });
      setAuth(data.access, data.refresh, data.usuario);
      router.push("/dashboard");
    } catch {
      setError("Usuario o contraseña incorrectos. Verifica tus credenciales.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">

      {/* Orbes de fondo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-8%] w-[480px] h-[480px] bg-indigo-600/25 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-15%] right-[-8%] w-[480px] h-[480px] bg-violet-600/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-sky-500/10 rounded-full blur-2xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Grid puntillado */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #818cf8 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />

      <div className="relative w-full max-w-sm mx-4">

        {/* Card */}
        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

          {/* Borde superior luminoso */}
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/60 to-transparent" />

          <div className="p-8">

            {/* Logo + marca */}
            <div className="flex flex-col items-center mb-8">
              <div
                className="relative mb-5 w-20 h-20"
                style={{ animation: "float 3.5s ease-in-out infinite" }}
              >
                <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>
                <div className="absolute -inset-4 rounded-full bg-indigo-500/30 blur-2xl" />
                <div
                  className="absolute -inset-1.5 rounded-full border border-indigo-400/30"
                  style={{ animation: "spin 10s linear infinite" }}
                />
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                <Image
                  src="/compras.png"
                  alt="ComerSys"
                  width={80}
                  height={80}
                  unoptimized
                  priority
                  className="relative z-10 rounded-full object-cover shadow-2xl hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_20px_rgba(99,102,241,0.8)]"
                />
              </div>

              <h1 className="text-3xl font-black tracking-tight bg-linear-to-r from-white via-indigo-200 to-violet-300 bg-clip-text text-transparent">
                ComerSys
              </h1>
              <p className="text-slate-500 text-xs mt-1.5 text-center leading-relaxed">
                Sistema Integral de Inventario,<br />Ventas y Gestión Comercial
              </p>

              {/* Badge versión */}
              <span className="mt-3 text-2xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                v1.0
              </span>
            </div>

            {/* Error de autenticación */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>

              {/* Usuario */}
              <div className="flex flex-col gap-1.5">
                <label className="text-2xs font-bold text-slate-500 uppercase tracking-widest">Usuario</label>
                <div className={`flex items-center gap-3 bg-white/5 border rounded-xl px-4 py-3 transition-all duration-200 ${
                  errors.username
                    ? "border-red-500/50 shadow-lg shadow-red-500/10"
                    : focused === "user"
                    ? "border-indigo-500/70 shadow-lg shadow-indigo-500/15 bg-white/8"
                    : "border-white/8 hover:border-white/15"
                }`}>
                  <User
                    size={15}
                    className={`transition-colors duration-200 ${
                      errors.username ? "text-red-400" : focused === "user" ? "text-indigo-400" : "text-slate-600"
                    }`}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); if (errors.username) setErrors((p) => ({ ...p, username: undefined })); }}
                    onFocus={() => setFocused("user")}
                    onBlur={() => setFocused(null)}
                    placeholder="Tu usuario"
                    autoFocus
                    autoComplete="username"
                    className="flex-1 bg-transparent text-white placeholder:text-slate-700 text-sm focus:outline-none"
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.username}
                  </p>
                )}
              </div>

              {/* Contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-2xs font-bold text-slate-500 uppercase tracking-widest">Contraseña</label>
                <div className={`flex items-center gap-3 bg-white/5 border rounded-xl px-4 py-3 transition-all duration-200 ${
                  errors.password
                    ? "border-red-500/50 shadow-lg shadow-red-500/10"
                    : focused === "pass"
                    ? "border-indigo-500/70 shadow-lg shadow-indigo-500/15 bg-white/8"
                    : "border-white/8 hover:border-white/15"
                }`}>
                  <Lock
                    size={15}
                    className={`transition-colors duration-200 ${
                      errors.password ? "text-red-400" : focused === "pass" ? "text-indigo-400" : "text-slate-600"
                    }`}
                  />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                    className="flex-1 bg-transparent text-white placeholder:text-slate-700 text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="text-slate-600 hover:text-slate-300 transition-colors duration-150"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.password}
                  </p>
                )}
              </div>

              {/* Botón submit */}
              <button
                type="submit"
                disabled={loading}
                className="relative mt-2 w-full py-3.5 rounded-xl font-bold text-sm text-white overflow-hidden group
                  bg-linear-to-r from-indigo-600 to-violet-600
                  hover:from-indigo-500 hover:to-violet-500
                  active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
                  shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40
                  transition-all duration-200"
              >
                <span className="absolute inset-0 bg-linear-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Iniciar sesión
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-200" />
                  </span>
                )}
              </button>

            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs mt-5">
          ComerSys · Sistema de Inventario y Ventas
        </p>
      </div>
    </div>
  );
}
