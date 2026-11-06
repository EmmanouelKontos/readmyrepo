import { scoreLabel } from '../components/ui/scoreTone';

export const SITE_URL = 'https://readmyrepo.com';

/** shields.io colours matching the app's score bands (GitHub's own green / yellow / red). */
export function badgeColor(score: number): string {
  if (score >= 85) return '2ea44f';
  if (score >= 65) return 'd4a72c';
  return 'cf222e';
}

/** The Summit mark without its tile, sized for the badge's dark label side. */
const MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 6 22 21"><path fill="#fff" d="M16 7 26 25.5h-5.4L16 16.9Z"/><path fill="#fff" fill-opacity=".55" d="M16 7 6 25.5h5.4L16 16.9Z"/><circle fill="#E0805E" cx="16" cy="23.1" r="2.3"/></svg>';

/** shields.io static-badge path segments escape '-' as '--' and '_' as '__'. */
function shieldsSegment(text: string): string {
  return encodeURIComponent(text.replace(/-/g, '--').replace(/_/g, '__'));
}

export function badgeImageUrl(score: number): string {
  const message = `${score}/100 ${scoreLabel(score).toLowerCase()}`;
  const logo = encodeURIComponent(`data:image/svg+xml;base64,${btoa(MARK_SVG)}`);
  return `https://img.shields.io/badge/${shieldsSegment('ReadMyRepo')}-${shieldsSegment(message)}-${badgeColor(score)}?logo=${logo}`;
}

/** Live report link: opens readmyrepo.com and re-scans the repository (works for public repos). */
export function reportUrl(repoSlug: string): string {
  return `${SITE_URL}/?repo=${repoSlug.split('/').map(encodeURIComponent).join('/')}`;
}

export function badgeMarkdown(repoSlug: string, score: number): string {
  return `[![ReadMyRepo score: ${score}/100](${badgeImageUrl(score)})](${reportUrl(repoSlug)})`;
}

export function badgeHtml(repoSlug: string, score: number): string {
  return `<a href="${reportUrl(repoSlug)}"><img src="${badgeImageUrl(score)}" alt="ReadMyRepo score: ${score}/100"></a>`;
}

/** Prefilled X post. Nothing is posted until the user presses Post on X themselves. */
export function xShareUrl(repoSlug: string, score: number): string {
  const text = `I mapped ${repoSlug} with ReadMyRepo: ${score}/100. See how the files connect, what's risky or slow, and get an AGENTS.md for your AI assistant 👇`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(reportUrl(repoSlug))}`;
}
