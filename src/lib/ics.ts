import { AppState } from '../types';
import { iso as mkIso, fromIdx, idx, parse } from './date';
import { eff } from './shift';

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (s: string): string => s.replace(/-/g, '');

/** 확정된 모임 하나를 캘린더 파일(.ics) 내용으로 만듭니다. 전날 오전 9시, 당일 오전 8시에 알림이 울리도록 넣습니다. */
export function meetIcs(id: string, title: string, group: string, day: string): string {
  const p = parse(day);
  const now = new Date();
  const stamp = mkIso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()).replace(/-/g, '') + 'T000000Z';
  const next = fromIdx(idx(day) + 1);
  const name = (group ? '[' + group + '] ' : '') + title;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fire-shift//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + id + '@fire-shift',
    'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + ymd(day),
    'DTEND;VALUE=DATE:' + ymd(next),
    'SUMMARY:' + esc('모임 ' + name),
    'DESCRIPTION:' + esc('소방 교대달력에서 확정된 모임 (' + p[1] + '월 ' + p[2] + '일)'),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('내일 모임: ' + name), 'TRIGGER:-PT15H', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('오늘 모임: ' + name), 'TRIGGER:PT8H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/**
 * 내 근무일(앞으로 days일)을 캘린더 파일(.ics)로 만듭니다.
 * 근무하는 날마다 일정이 하나씩 생기고, 전날 저녁 9시에 "내일 근무" 알림이 울립니다.
 * 같은 날짜는 같은 UID라서, 다시 가져오면 중복 없이 갱신됩니다. (근무가 사라진 날의 옛 일정은 직접 지워야 합니다.)
 */
export function dutyIcs(st: AppState, today: string, days: number): string {
  const now = new Date();
  const stamp = mkIso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()).replace(/-/g, '') + 'T000000Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fire-shift//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const start = idx(today) + 1;
  for (let i = start; i < start + days; i++) {
    const d = fromIdx(i);
    const e = eff(st, d);
    if (!e.works) continue;
    const name = '근무 ' + e.label + (e.kind === 'swap' && e.label !== '보강' ? ' (맞교대)' : '');
    lines.push(
      'BEGIN:VEVENT',
      'UID:duty-' + d + '@fire-shift',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(d),
      'DTEND;VALUE=DATE:' + ymd(fromIdx(i + 1)),
      'SUMMARY:' + esc(name),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('내일 ' + name), 'TRIGGER:-PT3H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

interface Doc {
  document?: { createElement: (t: string) => { href: string; download: string; click: () => void; style: { display: string } }; body: { appendChild: (e: unknown) => void; removeChild: (e: unknown) => void } };
  Blob?: new (parts: string[], o: { type: string }) => unknown;
  URL?: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void };
}

/** 웹에서 .ics 파일을 내려받게 합니다. 성공하면 true. */
export function downloadIcs(filename: string, content: string): boolean {
  const g = globalThis as unknown as Doc;
  try {
    if (!g.document || !g.Blob || !g.URL) return false;
    const url = g.URL.createObjectURL(new g.Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const a = g.document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    g.document.body.appendChild(a); a.click(); g.document.body.removeChild(a);
    setTimeout(() => { try { g.URL!.revokeObjectURL(url); } catch (e) { /* 무시 */ } }, 4000);
    return true;
  } catch (e) { return false; }
}
