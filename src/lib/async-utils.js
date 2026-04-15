// ============================================================
// ASYNC UTILS — Retry, timeout, error handling
// ============================================================

export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, err.message);
      
      // Não fazer retry para certos tipos de erro
      const isRetryable = !(
        err.message.includes('Invalid') ||
        err.message.includes('unauthorized') ||
        err.message.includes('authentication') ||
        err.message.includes('permission denied')
      );

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      // Backoff exponencial com jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

export async function withTimeout(promise, timeoutMs = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

export function safeAsync(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error('[Safe Async]', err);
      throw err;
    }
  };
}

// Debounce para operações que disparam múltiplas vezes
export function debounce(fn, delay = 300) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
