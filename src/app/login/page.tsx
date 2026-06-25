"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError("Credenciais inválidas.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(201,162,77,0.22),_transparent_32%),linear-gradient(135deg,_#07111f_0%,_#0f172a_100%)] px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.25em] text-amber-300">Sigma Horus</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Entrar na plataforma</h1>
        <p className="mt-2 text-sm text-slate-400">Acesse o painel administrativo da sua loja.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0"
              required
            />
          </div>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 transition hover:bg-amber-300"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
