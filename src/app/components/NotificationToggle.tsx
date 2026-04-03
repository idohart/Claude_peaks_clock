import { useCallback, useEffect, useRef, useState } from 'react';

import type { ClockStatus } from '../../types/promotion';

interface NotificationToggleProps {
  status: ClockStatus;
}

const STORAGE_KEY = 'claude-notify-enabled';

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

    if (status.phaseTone === 'off_peak') {
      new Notification('Claude Code — Off-Peak Started', {
        body: `${status.phaseLabel} — ${status.phaseSource}`,
        icon: '/favicon.ico',
        tag: 'claude-phase-change',
      });
    } else {
      new Notification('Claude Code — Peak Started', {
        body: `${status.phaseLabel} — ${status.phaseSource}`,
        icon: '/favicon.ico',
        tag: 'claude-phase-change',
      });
    }
  }, [enabled, permission, status.phaseTone, status.phaseLabel, status.phaseSource]);

  if (typeof Notification === 'undefined') return null;

  return (
    <button
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-['JetBrains_Mono'] transition-colors ${
        enabled && permission === 'granted'
          ? 'bg-[#c4a1ff]/10 text-[#c4a1ff]'
          : 'bg-white/5 text-[#6b6b80] hover:text-[#e2e2e8]'
      }`}
      onClick={toggle}
      title={enabled ? 'Notifications enabled — click to disable' : 'Enable browser notifications for phase changes'}
      type="button"
    >
      <span>{enabled && permission === 'granted' ? '🔔' : '🔕'}</span>
      <span>{enabled && permission === 'granted' ? 'Notifications On' : 'Notify Me'}</span>
    </button>
  );
}
