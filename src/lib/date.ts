export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const pad = (n: number): string => String(n).padStart(2, '0');
export const iso = (y: number, m: number, d: number): string => y + '-' + pad(m) + '-' + pad(d);
export const parse = (s: string): [number, number, number] => {
  const a = s.split('-');
  return [+a[0], +a[1], +a[2]];
};
export const idx = (s: string): number => {
  const p = parse(s);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
};
export const fromIdx = (i: number): string => {
  const t = new Date(i * 864e5);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
export const wdOf = (s: string): number => {
  const p = parse(s);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
};
export const todayISO = (): string => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth() + 1, n.getDate());
};
export const fmt = (s: string): string => {
  const p = parse(s);
  return p[1] + '월 ' + p[2] + '일(' + WD[wdOf(s)] + ')';
};
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const firstWd = (y: number, m: number): number => new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
export const firstChar = (n: string): string => {
  const a = Array.from(String(n || '?'));
  return a[0] || '?';
};
