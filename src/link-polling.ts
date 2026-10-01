type Visibility = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
type Clock = {
  now: () => number;
  set: (callback: () => void, delay: number) => unknown;
  clear: (timer: unknown) => void;
};
const clock: Clock = {
  now: Date.now,
  set: (callback, delay) => setTimeout(callback, delay),
  clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

/** One in-flight inspection; no hidden-tab polling or stale-generation callbacks. */
export function pollLink<T>(options: {
  expiresAt: string;
  inspect: (signal: AbortSignal) => Promise<T>;
  onResult: (result: T) => "continue" | "stop";
  onError: (error: unknown) => "retry" | "stop";
  onExpire: () => void;
  intervalMs?: number;
  visibility?: Visibility;
  clock?: Clock;
}): () => void {
  const time = options.clock ?? clock;
  const visibility = options.visibility ?? document;
  const deadline = Date.parse(options.expiresAt);
  const interval = options.intervalMs ?? 2000;
  let stopped = false;
  let generation = 0;
  let inFlight = false;
  let failures = 0;
  let timer: unknown;
  let expiryTimer: unknown;
  let controller: AbortController | null = null;
  const visible = () => visibility.visibilityState === "visible";
  function stop() {
    stopped = true;
    generation++;
    time.clear(timer);
    time.clear(expiryTimer);
    controller?.abort();
    visibility.removeEventListener("visibilitychange", changed);
  }
  function expire() {
    if (stopped) return;
    stop();
    options.onExpire();
  }
  function schedule(delay: number) {
    time.clear(timer);
    if (!stopped && visible()) timer = time.set(() => void inspect(), delay);
  }
  async function inspect() {
    if (stopped || !visible() || inFlight) return;
    if (time.now() >= deadline) { expire(); return; }
    const requestGeneration = generation;
    const request = new AbortController();
    controller = request;
    inFlight = true;
    try {
      const result = await options.inspect(request.signal);
      if (stopped || request.signal.aborted || requestGeneration !== generation) return;
      failures = 0;
      if (options.onResult(result) === "stop") stop();
    } catch (error) {
      if (stopped || request.signal.aborted || requestGeneration !== generation) return;
      failures++;
      if (options.onError(error) === "stop") stop();
    } finally {
      inFlight = false;
      if (controller === request) controller = null;
      schedule(requestGeneration !== generation ? 0 : Math.min(interval * 2 ** Math.min(failures, 3), 15000));
    }
  }
  function changed() {
    generation++;
    time.clear(timer);
    controller?.abort();
    if (visible() && !inFlight) schedule(0);
  }
  visibility.addEventListener("visibilitychange", changed);
  expiryTimer = time.set(expire, Math.max(0, deadline - time.now()));
  schedule(interval);
  return stop;
}
