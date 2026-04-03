import type { DashboardNotice } from '../../types/promotion';

interface StatusNoticesProps {
  notices: DashboardNotice[];
}

function getNoticeStyles(tone: DashboardNotice['tone']): { border: string; badge: string } {
  if (tone === 'critical') {
    return {
      border: 'border-[#e05252]/40',
      badge: 'text-[#ff9a9a] bg-[#e05252]/10',
    };
  }

  if (tone === 'warning') {
    return {
      border: 'border-[#f59e0b]/30',
      badge: 'text-[#f8c66d] bg-[#f59e0b]/10',
    };
  }

  return {
    border: 'border-[#3b82f6]/30',
    badge: 'text-[#93c5fd] bg-[#3b82f6]/10',
  };
}

export function StatusNotices({ notices }: StatusNoticesProps) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
      {notices.map((notice) => {
        const styles = getNoticeStyles(notice.tone);

        return (
          <div
            className={`rounded-lg bg-[#111118] border p-4 ${styles.border}`}
            key={notice.id}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[#e2e2e8] text-sm font-['JetBrains_Mono']">{notice.title}</p>
              <span
                className={`text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider px-2 py-0.5 rounded ${styles.badge}`}
              >
                {notice.tone}
              </span>
            </div>
            <p className="text-[#8b8ba0] text-sm mt-3 leading-relaxed">{notice.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
