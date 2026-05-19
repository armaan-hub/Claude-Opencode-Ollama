// Simple per-provider queue with exponential backoff for upstream 429s/errors
// Keep this module small and dependency-free so it can be safely required from
// opencode-proxy-server.js without risk of introducing syntax errors there.

const PROVIDER_QUEUES = {};

function enqueueProviderRequest(pid, sendFn, limits = { concurrency: 2, maxRetries: 3, baseBackoffMs: 500 }) {
  if (!PROVIDER_QUEUES[pid]) PROVIDER_QUEUES[pid] = { inFlight: 0, queue: [] };
  const q = PROVIDER_QUEUES[pid];
  return new Promise((resolve, reject) => {
    q.queue.push({ sendFn, resolve, reject, limits });
    processProviderQueue(pid);
  });
}

function processProviderQueue(pid) {
  const q = PROVIDER_QUEUES[pid];
  if (!q) return;
  while (q.inFlight < (q.queue[0]?.limits?.concurrency || 2) && q.queue.length > 0) {
    const task = q.queue.shift();
    q.inFlight++;
    runProviderTask(pid, task).finally(() => {
      q.inFlight--;
      // schedule next tick to avoid deep synchronous recursion
      setImmediate(() => processProviderQueue(pid));
    });
  }
}

async function runProviderTask(pid, task) {
  const limits = task.limits || { concurrency: 2, maxRetries: 3, baseBackoffMs: 500 };

  const attemptRun = async (attempt) => {
    try {
      const upstream = await task.sendFn();
      const status = upstream && upstream.statusCode ? upstream.statusCode : 200;
      if (status === 429) {
        const ra = parseInt((upstream.headers && (upstream.headers['retry-after'] || upstream.headers['Retry-After'])) || '0', 10) || 0;
        if (attempt < limits.maxRetries) {
          const backoff = Math.min(limits.baseBackoffMs * Math.pow(2, attempt), 60000);
          const delay = ra > 0 ? ra * 1000 : backoff;
          console.log(`[BACKOFF] ${pid} upstream 429 → retry in ${delay}ms (attempt ${attempt+1}/${limits.maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          return attemptRun(attempt + 1);
        } else {
          return upstream;
        }
      }
      return upstream;
    } catch (err) {
      if (attempt < limits.maxRetries) {
        const backoff = Math.min(limits.baseBackoffMs * Math.pow(2, attempt), 60000);
        console.log(`[BACKOFF] ${pid} send error: ${err.message} → retry in ${backoff}ms (attempt ${attempt+1}/${limits.maxRetries})`);
        await new Promise(r => setTimeout(r, backoff));
        return attemptRun(attempt + 1);
      }
      throw err;
    }
  };

  try {
    const res = await attemptRun(0);
    task.resolve(res);
  } catch (err) {
    task.reject(err);
  }
}

module.exports = { enqueueProviderRequest, PROVIDER_QUEUES };
