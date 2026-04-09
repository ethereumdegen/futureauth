use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Sweep the map at most this often, regardless of traffic.
const SWEEP_INTERVAL: Duration = Duration::from_secs(60);

struct Inner {
    buckets: HashMap<String, Vec<Instant>>,
    last_sweep: Instant,
}

#[derive(Clone)]
pub struct RateLimiter {
    state: Arc<Mutex<Inner>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window: Duration) -> Self {
        Self {
            state: Arc::new(Mutex::new(Inner {
                buckets: HashMap::new(),
                last_sweep: Instant::now(),
            })),
            max_requests,
            window,
        }
    }

    /// Returns `true` if the request is allowed, `false` if rate-limited.
    pub async fn check(&self, key: &str) -> bool {
        let mut state = self.state.lock().await;
        let now = Instant::now();

        // Opportunistically evict stale keys so the map does not grow without
        // bound when clients vary their IP/email (spoofed or legitimate). We
        // only walk the whole map at most once per SWEEP_INTERVAL to keep the
        // per-call cost O(1) amortized.
        if now.duration_since(state.last_sweep) >= SWEEP_INTERVAL {
            let window = self.window;
            state.buckets.retain(|_, entries| {
                entries.retain(|t| now.duration_since(*t) < window);
                !entries.is_empty()
            });
            state.last_sweep = now;
        }

        let window = self.window;
        let entries = state.buckets.entry(key.to_string()).or_default();
        entries.retain(|t| now.duration_since(*t) < window);
        if entries.len() >= self.max_requests {
            // Drop the bucket if it is effectively idle so we don't hold onto
            // memory for keys that have nothing but expired timestamps.
            if entries.is_empty() {
                let key_owned = key.to_string();
                state.buckets.remove(&key_owned);
            }
            false
        } else {
            entries.push(now);
            true
        }
    }
}
