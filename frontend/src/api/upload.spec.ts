import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { uploadWithProgress } from './upload';
import { userApi } from './endpoints/user';

/**
 * Minimal XMLHttpRequest stand-in. Node has no XHR, and the point of these tests
 * is the state machine around it — which callbacks fire, in what order, and what
 * the returned promise does — not the transport itself.
 */
class FakeXhr {
  static instances: FakeXhr[] = [];

  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  status = 0;
  responseText = '';
  withCredentials = false;
  method = '';
  url = '';
  sent: FormData | null = null;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.sent = body;
  }

  abort() {
    this.onabort?.();
  }

  // --- test helpers ---

  emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  emitUnmeasurableProgress() {
    this.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 } as ProgressEvent);
  }

  respond(status: number, body?: unknown) {
    this.status = status;
    this.responseText = body === undefined ? '' : JSON.stringify(body);
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }
}

const form = () => new FormData();
const latest = (): FakeXhr => FakeXhr.instances[FakeXhr.instances.length - 1]!;

/** Lets queued promise callbacks run before the test asserts. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('uploadWithProgress', () => {
  beforeEach(() => {
    FakeXhr.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs with credentials and unwraps the { data } envelope', async () => {
    const promise = uploadWithProgress<{ id: number }>('/users/me/avatar', form());
    latest().respond(201, { success: true, data: { id: 7 } });

    await expect(promise).resolves.toEqual({ id: 7 });
    expect(latest().method).toBe('POST');
    expect(latest().url).toContain('/v1/users/me/avatar');
    expect(latest().withCredentials).toBe(true);
  });

  it('reports progress monotonically from 0 to 100', async () => {
    const seen: number[] = [];
    const promise = uploadWithProgress('/users/me/avatar', form(), {
      onProgress: (pct) => seen.push(pct),
    });

    latest().emitProgress(0, 100);
    latest().emitProgress(50, 100);
    latest().emitProgress(100, 100);
    latest().respond(201, { data: null });
    await promise;

    expect(seen).toEqual([0, 50, 100]);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('reports nothing rather than a fabricated value when the size is unknown', async () => {
    const onProgress = vi.fn();
    const promise = uploadWithProgress('/users/me/avatar', form(), { onProgress });

    latest().emitUnmeasurableProgress();
    latest().respond(201, { data: null });
    await promise;

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('rejects with an AbortError when the signal fires, and stops reporting', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const promise = uploadWithProgress('/users/me/avatar', form(), {
      onProgress,
      signal: controller.signal,
    });

    latest().emitProgress(30, 100);
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('never opens a request for an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadWithProgress('/users/me/avatar', form(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('surfaces the backend message on a 4xx', async () => {
    const promise = uploadWithProgress('/users/me/avatar', form());
    latest().respond(400, { message: 'Unsupported image format. Allowed: PNG, JPEG or WebP' });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: 'Unsupported image format. Allowed: PNG, JPEG or WebP',
    });
  });

  it('rejects with a plain Error on transport failure', async () => {
    const promise = uploadWithProgress('/users/me/avatar', form());
    latest().fail();

    await expect(promise).rejects.not.toBeInstanceOf(ApiError);
  });

  it('refreshes the session and retries once on a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('XMLHttpRequest', FakeXhr);

    const promise = uploadWithProgress<{ id: number }>('/users/me/avatar', form());
    latest().respond(401);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(FakeXhr.instances).toHaveLength(2);

    latest().respond(201, { data: { id: 7 } });
    await expect(promise).resolves.toEqual({ id: 7 });
  });

  it('gives up after one retry rather than looping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('XMLHttpRequest', FakeXhr);

    const promise = uploadWithProgress('/users/me/avatar', form());
    latest().respond(401);
    await flush();
    latest().respond(401);

    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(FakeXhr.instances).toHaveLength(2);
  });
});

describe('userApi.uploadAvatar', () => {
  beforeEach(() => {
    FakeXhr.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: this used to have a block body with no `return`, so the promise
  // was dropped. Callers awaited nothing, upload failures became unhandled
  // rejections, and the UI navigated away as though the upload had worked.
  it('returns its promise, so a rejection reaches the caller', async () => {
    const promise = userApi.uploadAvatar(form());
    expect(promise).toBeInstanceOf(Promise);

    latest().respond(400, { message: 'Unsupported image format' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
  });

  it('resolves with the updated profile on success', async () => {
    const promise = userApi.uploadAvatar(form());
    latest().respond(201, { data: { id: 1, avatarFileId: 7 } });

    await expect(promise).resolves.toMatchObject({ avatarFileId: 7 });
  });
});
