import { useCallback, useEffect, useRef, useState } from 'react';

import type { ClockStatus } from '../../types/promotion';

interface NotificationToggleProps {
  status: ClockStatus;
}

const STORAGE_KEY = 'claude-notify-enabled';

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {!active && <line x1="1" y1="1" x2="23" y2="23" />}
    </svg>
  );
}

export function NotificationToggle({ status }: NotificationToggleProps) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const prevPhaseRef = useRef<string>(status.phaseTone);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setEnabled(true);
      try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
    }
  }, []);

  const toggle = useCallback(() => {
    if (!enabled) {
      if (permission !== 'granted') {
        requestPermission();
      } else {
        setEnabled(true);
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
      }
    } else {
      setEnabled(false);
      try { localStorage.setItem(STORAGE_KEY, 'false'); } catch { /* noop */ }
    }
  }, [enabled, permission, requestPermission]);

  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    const prev = prevPhaseRef.current;
    prevPhaseRef.current = status.phaseTone;

    if (prev === status.phaseTone) return;

    const title = status.phaseTone === 'off_peak'
      ? 'Claude Code — Off-Peak Started'
      : 'Claude Code — Peak Started';

    new Notification(title, {
      body: `${status.phaseLabel} — ${status.phaseSource}`,
      icon: '/favicon.ico',
      tag: 'claude-phase-change',
    });
  }, [enabled, permission, status.phaseTone, status.phaseLabel, status.phaseSource]);

  if (typeof Notification === 'undefined') return null;

  const isActive = enabled && permission === 'granted';

  return (
    <button
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-['JetBrains_Mono'] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4a1ff] focus-visible:outline-offset-2 ${
        isActive
          ? 'bg-[#c4a1ff]/10 text-[#c4a1ff]'
          : 'bg-white/5 text-[#8b8ba0] hover:text-[#e2e2e8]'
      }`}
      onClick={toggle}
      aria-label={isActive ? 'Disable phase change notifications' : 'Enable phase change notifications'}
      type="button"
    >
      <BellIcon active={isActive} />
      <span>{isActive ? 'Alerts On' : 'Notify Me'}</span>
    </button>
  );
}
