export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
