// Trava de duplo clique para TODAS as telas de uma vez: se uma gravação idêntica (mesmo método, mesma
// URL, mesmo corpo) ainda está em andamento, a segunda chamada reaproveita a resposta da primeira em
// vez de gravar de novo (baixa, lançamento, cobrança em dobro). Só vale enquanto a primeira não
// terminou; depois disso uma nova ação igual é uma nova ação. Uploads (FormData/arquivo) e o login
// ficam de fora — o corpo não dá para comparar. Também avisa quando uma gravação falha por rede.

type FetchFn = typeof fetch;

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Chave da gravação, ou null quando não dá para comparar com segurança (não é gravação, upload, login). */
export function writeKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!WRITE.has(method)) return null;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/\/api\/auth\//.test(url)) return null;
  const body = init?.body;
  if (body != null && typeof body !== 'string') return null;
  if (body == null && input instanceof Request) return null;
  return `${method} ${url} ${body ?? ''}`;
}

export function createDedupedFetch(base: FetchFn, onWriteNetworkError?: () => void): FetchFn {
  const inflight = new Map<string, Promise<Response>>();
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const key = writeKey(input, init);
    if (!key) return base(input, init);
    const running = inflight.get(key);
    if (running) return running.then((r) => r.clone());
    const p = base(input, init);
    inflight.set(key, p);
    const done = () => { if (inflight.get(key) === p) inflight.delete(key); };
    p.then(done, () => {
      done();
      onWriteNetworkError?.();
    });
    return p.then((r) => r.clone());
  }) as FetchFn;
}
