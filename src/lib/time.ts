import { DateTime } from 'luxon';

const MINUTES_PER_DAY = 24 * 60;

export function getViewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function circularDistance(a: number, b: number, cycle: number): number {
  const difference = Math.abs(a - b);
  return Math.min(difference, cycle - difference);
}

export function minuteOfWeek(dateTime: DateTime): number {
  return (dateTime.weekday - 1) * MINUTES_PER_DAY + dateTime.hour * 60 + dateTime.minute;
}

export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return 'now';
  }

  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  const minutes = Math.floor(totalMinutes % 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(' ');
}

export function formatDelta(value: number): string {
  const percentage = Math.round(value * 100);
  return `${percentage > 0 ? '+' : ''}${percentage}%`;
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function shortHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}
