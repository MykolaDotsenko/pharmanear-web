const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

class ProviderError extends Error {
  constructor(message, retryable) {
    super(message);
    this.retryable = retryable;
  }
}

async function request(endpoint, query, signal, fetchImpl) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      throw new ProviderError(
        'Pharmacy provider returned HTTP ' + response.status,
        [500, 502, 503, 504].includes(response.status),
      );
    }
    const data = await response.json();
    if (!Array.isArray(data?.elements) || data.remark) {
      throw new ProviderError('Incomplete pharmacy provider response', true);
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** At most one independent fallback. Never retry a refused/rate-limited request. */
export async function fetchPharmacies(query, signal, fetchImpl = globalThis.fetch) {
  for (const [index, endpoint] of endpoints.entries()) {
    try {
      return await request(endpoint, query, signal, fetchImpl);
    } catch (error) {
      signal?.throwIfAborted();
      const retryable =
        error instanceof ProviderError
          ? error.retryable
          : error instanceof TypeError || error instanceof SyntaxError || error?.name === 'AbortError';
      if (!retryable || index === endpoints.length - 1) throw error;
    }
  }
}
