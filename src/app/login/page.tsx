"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciais inválidas.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sigma-blue-deep">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/backgraund_theme.png)" }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-sigma-blue-deep/90 via-sigma-blue-deep/50 to-sigma-blue-deep/85" />
      <div className="absolute inset-0 bg-gradient-to-t from-sigma-blue-deep/60 via-transparent to-sigma-blue-deep/40" />

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sigma-blue-deep to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-16 px-6 lg:px-12">
        <div className="hidden max-w-md lg:block">
          <div className="animate-slide-up">
            <Image
              src="/sigmahorus_ouro.png"
              alt="Sigma Horus"
              width={1024}
              height={1024}
              priority
              className="h-20 w-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            />
            <h1 className="mt-7 text-4xl font-bold leading-tight text-sand-light text-balance">
              A tesouraria da sua loja no prumo
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sand/80">
              Gestão financeira, cobrança automatizada, presença e auditoria para lojas
              maçônicas. Tudo em uma plataforma segura e multi-tenancy.
            </p>
            <div className="mt-8 flex items-center gap-6 text-sm text-sand-dark">
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-gold" />
                Multi-loja
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-gold" />
                RLS por tenant
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-gold" />
                LGPD
              </span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto lg:mx-0">
          <div className="animate-slide-up rounded-2xl border border-white/[8%] bg-sigma-blue-dark/80 p-8 backdrop-blur-sm">
            <Image
              src="/icon.png"
              alt="Sigma Horus"
              width={512}
              height={512}
              priority
              className="mx-auto mb-5 h-14 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] lg:hidden"
            />
            <div className="text-center lg:text-left">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">
                Acesse sua conta
              </p>
              <h2 className="mt-2 text-xl font-semibold text-sand-light">
                Entrar na plataforma
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />

              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              {error ? (
                <p className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-sand-dark">
              Sigma Horus &mdash; Gestão para lojas maçônicas
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
