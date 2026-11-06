import { describe, expect, it } from 'bun:test';
import { badgeColor, badgeHtml, badgeImageUrl, badgeMarkdown, reportUrl, xShareUrl } from '../src/lib/badge';

describe('README badge and share links', () => {
  it('colours the badge by score band', () => {
    expect(badgeColor(97)).toBe('2ea44f');
    expect(badgeColor(85)).toBe('2ea44f');
    expect(badgeColor(70)).toBe('d4a72c');
    expect(badgeColor(40)).toBe('cf222e');
  });

  it('builds a valid shields.io URL with the score, band and logo', () => {
    const url = new URL(badgeImageUrl(92));
    expect(url.hostname).toBe('img.shields.io');
    expect(decodeURIComponent(url.pathname)).toBe('/badge/ReadMyRepo-92/100 healthy-2ea44f');
    expect(url.searchParams.get('logo')).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('links badges to the live report, keeping subfolder paths readable', () => {
    expect(reportUrl('vercel/next.js/packages/next')).toBe('https://readmyrepo.com/?repo=vercel/next.js/packages/next');
    const md = badgeMarkdown('colinhacks/zod', 87);
    expect(md).toStartWith('[![ReadMyRepo score: 87/100](https://img.shields.io/badge/');
    expect(md).toEndWith('](https://readmyrepo.com/?repo=colinhacks/zod)');
    expect(badgeHtml('colinhacks/zod', 87)).toContain('<a href="https://readmyrepo.com/?repo=colinhacks/zod">');
  });

  it('prefills an X post that links to the report', () => {
    const url = new URL(xShareUrl('colinhacks/zod', 87));
    expect(url.hostname).toBe('x.com');
    expect(url.searchParams.get('text')).toContain('colinhacks/zod');
    expect(url.searchParams.get('url')).toBe('https://readmyrepo.com/?repo=colinhacks/zod');
  });
});
