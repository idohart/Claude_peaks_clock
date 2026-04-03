import { useCallback, useEffect, useRef, useState } from 'react';

interface ProbeResult {
  requestsRemaining: number | null;
  requestsLimit: number | null;
  tokensRemaining: number | null;
  tokensLimit: number | null;
  level: 'high' | 'medium' | 'low' | 'unknown';
  probedAt: number;
}

const PROBE_INTERVAL_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'claude-probe-api-key';

function parseNum(val: string | undefined): number | null {
  if (!val) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function computeLevel(result: { requestsRemaining: number | null; requestsLimit: number | null; tokensRemaining: number | null; tokensLimit: number | null }): 'high' | 'medium' | 'low' | 'unknown' {
  const reqRatio = result.requestsRemaining !== null && result.requestsLimit !== null && result.requestsLimit > 0
    ? result.requestsRemaining / result.requestsLimit
    : null;
  const tokRatio = result.tokensRemaining !== null && result.tokensLimit !== null && result.tokensLimit > 0
    ? result.tokensRemaining / result.tokensLimit
    : null;

  const ratio = reqRatio !== null && tokRatio !== null
    ? Math.min(reqRatio, tokRatio)
    : reqRatio ?? tokRatio;

  if (ratio === null) return 'unknown';
  if (ratio > 0.6) return 'high';
  if (ratio > 0.25) return 'medium';
  return 'low';
}

const levelConfig = {
  high: { color: '#4ade80', label: 'High Capacity', icon: '▲' },
  medium: { color: '#f59e0b', label: 'Medium Capacity', icon: '●' },
  low: { color: '#e05252', label: 'Low Capacity', icon: '▼' },
  unknown: { color: '#6b6b80', label: 'Unknown', icon: '?' },
} as const;

export function CapacityProbe() {
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
  });
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const intervalRef = useRef<number | null>(null);

  const runProbe = useCallback(async (key: string) => {
    if (!key) return;
    setProbing(true);
    setError(null);
    try {
      const res = await fetch('/api/capacity-probe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.message ?? data.error);
        return;
      }
      const rl = data.rateLimits ?? {};
      const parsed = {
        requestsRemaining: parseNum(rl['anthropic-ratelimit-requests-remaining']),
        requestsLimit: parseNum(rl['anthropic-ratelimit-requests-limit']),
        tokensRemaining: parseNum(rl['anthropic-ratelimit-tokens-remaining']),
        tokensLimit: parseNum(rl['anthropic-ratelimit-tokens-limit']),
      };
      setResult({
        ...parsed,
        level: computeLevel(parsed),
        probedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    runProbe(apiKey);
    intervalRef.current = window.setInterval(() => runProbe(apiKey), PROBE_INTERVAL_MS);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [apiKey, runProbe]);

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    try { localStorage.setItem(STORAGE_KEY, trimmed); } catch { /* noop */ }
    setApiKey(trimmed);
    setInputValue('');
    setShowInput(false);
  };

  const handleRemove = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    setApiKey('');
    setResult(null);
    setError(null);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  };

  const config = result ? levelConfig[result.level] : levelConfig.unknown;

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          API Capacity Probe
        </span>
        {apiKey ? (
          <button
            className="text-[10px] font-['JetBrains_Mono'] text-[#6b6b80] hover:text-[#e05252] transition-colors"
            onClick={handleRemove}
            type="button"
          >
            Remove Key
          </button>
        ) : null}
      </div>

      {!apiKey ? (
        <div className="space-y-3">
          <p className="text-[#6b6b80] text-sm">
            Add your Anthropic API key to monitor real-time capacity. The key is stored only
            in your browser&apos;s localStorage and proxied through the server to read rate-limit headers.
          </p>
          {showInput ? (
            <div className="flex gap-2">
              <input
                className="flex-1 bg-[#0a0a0f] border border-white/10 rounded px-3 py-2 text-sm font-['JetBrains_Mono'] text-[#e2e2e8] placeholder-[#6b6b80]/50 focus:outline-none focus:border-[#c4a1ff]/50"
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="sk-ant-..."
                type="password"
                value={inputValue}
              />
              <button
                className="px-4 py-2 bg-[#c4a1ff]/10 text-[#c4a1ff] text-sm font-['JetBrains_Mono'] rounded hover:bg-[#c4a1ff]/20 transition-colors"
                onClick={handleSave}
                type="button"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              className="px-4 py-2 bg-[#c4a1ff]/10 text-[#c4a1ff] text-sm font-['JetBrains_Mono'] rounded hover:bg-[#c4a1ff]/20 transition-colors"
              onClick={() => setShowInput(true)}
              type="button"
            >
              Add API Key
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {probing && !result ? (
            <p className="text-[#6b6b80] text-sm font-['JetBrains_Mono']">Probing API...</p>
          ) : error ? (
            <div className="rounded-md bg-[#e05252]/5 border border-[#e05252]/20 p-3">
              <p className="text-[#e05252] text-sm font-['JetBrains_Mono']">Probe failed</p>
              <p className="text-[#6b6b80] text-xs mt-1">{error}</p>
            </div>
          ) : result ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-lg" style={{ color: config.color }}>{config.icon}</span>
                <span className="text-lg font-['JetBrains_Mono'] font-medium" style={{ color: config.color }}>
                  {config.label}
                </span>
                {probing ? <span className="text-[#6b6b80] text-xs">(refreshing...)</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {result.requestsRemaining !== null && result.requestsLimit !== null ? (
                  <div className="rounded-md bg-[#0a0a0f] border border-white/[0.04] p-3">
                    <p className="text-[#6b6b80] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">Requests</p>
                    <p className="text-[#e2e2e8] text-sm font-['JetBrains_Mono'] mt-1">
                      {result.requestsRemaining} <span className="text-[#6b6b80]">/ {result.requestsLimit}</span>
                    </p>
                  </div>
                ) : null}
                {result.tokensRemaining !== null && result.tokensLimit !== null ? (
                  <div className="rounded-md bg-[#0a0a0f] border border-white/[0.04] p-3">
                    <p className="text-[#6b6b80] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">Tokens</p>
                    <p className="text-[#e2e2e8] text-sm font-['JetBrains_Mono'] mt-1">
                      {(result.tokensRemaining / 1000).toFixed(0)}k <span className="text-[#6b6b80]">/ {(result.tokensLimit / 1000).toFixed(0)}k</span>
                    </p>
                  </div>
                ) : null}
              </div>
              <p className="text-[#6b6b80]/50 text-[11px] font-['JetBrains_Mono']">
                Probed {new Date(result.probedAt).toLocaleTimeString()} | refreshes every 5 min | uses 1 token per probe
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
