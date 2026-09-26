/** A Unix time in seconds as `YYYY-MM-DD HH:MM:SS UTC`. */
export function utcTime(seconds: number): string {
  const iso = new Date(seconds * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}
