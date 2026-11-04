export type ScoreTone = 'tone-success' | 'tone-warning' | 'tone-danger';

export function scoreTone(score: number): ScoreTone {
  if (score >= 85) return 'tone-success';
  if (score >= 65) return 'tone-warning';
  return 'tone-danger';
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Healthy';
  if (score >= 65) return 'Needs work';
  return 'At risk';
}

export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
