export function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'HEALTHY': 'healthy',
    'DEGRADED': 'degraded',
    'DOWN': 'down',
    'NO DATA': 'no-data'
  };
  return classes[status] || 'no-data';
}

export function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'HEALTHY': '🟢',
    'DEGRADED': '🟡',
    'DOWN': '🔴',
    'NO DATA': '⚪'
  };
  return emojis[status] || '⚪';
}

export function calculateAverage(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  });
}

export function getUptimeClass(percentage: number): string {
  if (percentage >= 95) return 'good';
  if (percentage >= 80) return 'medium';
  return 'bad';
}

export function getChartStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'HEALTHY': 'healthy',
    'DEGRADED': 'degraded',
    'DOWN': 'down',
    'NO DATA': 'no-data'
  };
  return classes[status] || 'no-data';
}