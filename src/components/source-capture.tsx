'use client';

import { useEffect } from 'react';
import { SOURCE_COOKIE, SOURCE_COOKIE_DAYS, sourceFromParams } from '@/lib/acquisition';

// Guarda o canal de divulgação da PRIMEIRA visita (utm_source/ref do link) num cookie; o
// cadastro da loja lê esse cookie (ver lib/acquisition.ts). Primeiro toque vence: um clique
// depois, por outro canal, não apaga de onde a loja veio.
export function SourceCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split(';').some((c) => c.trim().startsWith(`${SOURCE_COOKIE}=`))) return;
      const source = sourceFromParams(new URLSearchParams(window.location.search));
      if (!source) return;
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${SOURCE_COOKIE}=${encodeURIComponent(source)}; Max-Age=${SOURCE_COOKIE_DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
    } catch {
      /* navegador sem cookies: só não mede */
    }
  }, []);
  return null;
}
