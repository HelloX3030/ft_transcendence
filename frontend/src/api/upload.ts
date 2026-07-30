import { ApiError } from './api-error';
import { API_BASE, errorMessage, parseJson, refreshSession, unwrapEnvelope } from './http';

export interface UploadOptions {
  /** Called with 0–100 as the request body goes out. */
  onProgress?: (pct: number) => void;
  /** Aborts the upload; the promise rejects with an `AbortError`. */
  signal?: AbortSignal;
}

/**
 * POSTs a multipart body and reports real upload progress.
 *
 * `fetch` cannot do this: reporting progress means streaming the request body,
 * which requires `duplex: 'half'` and is not broadly supported. `XMLHttpRequest`
 * has exposed `upload.onprogress` forever, so uploads — and only uploads — use
 * it. Everything else about the call matches `backendClient`, via the shared
 * primitives in `http.ts`.
 */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  opts: UploadOptions = {},
  retried = false,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new DOMException('Upload cancelled', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + path);
    xhr.withCredentials = true;

    const onAbort = () => xhr.abort();
    opts.signal?.addEventListener('abort', onAbort);
    const cleanup = () => opts.signal?.removeEventListener('abort', onAbort);

    xhr.upload.onprogress = (event) => {
      // Without a Content-Length there is no total to divide by, so there is
      // nothing honest to report — better no movement than a fabricated bar.
      if (!event.lengthComputable) return;
      opts.onProgress?.((event.loaded / event.total) * 100);
    };

    xhr.onload = () => {
      cleanup();

      if (xhr.status === 401 && !retried) {
        // Same retry-once as backendClient. Progress restarts from 0 for the
        // second attempt, which is honest: the bytes really are being resent.
        refreshSession()
          .then(() => uploadWithProgress<T>(path, form, opts, true))
          .then(resolve)
          .catch((err: unknown) => {
            reject(err instanceof ApiError ? err : new ApiError(401, 'Not authenticated'));
          });
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const body = parseJson(xhr.responseText);
        reject(new ApiError(xhr.status, errorMessage(body, xhr.status), body));
        return;
      }

      try {
        resolve(unwrapEnvelope<T>(xhr.responseText));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Malformed response'));
      }
    };

    // Transport failure — offline, DNS, TLS. Left as a plain Error, matching
    // backendClient, where `instanceof ApiError` means "the backend answered".
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Network error'));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };

    xhr.send(form);
  });
}
