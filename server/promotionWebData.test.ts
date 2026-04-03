import { describe, expect, it } from 'vitest';

import { _testExports } from './promotionWebData';

const {
  extractPromotionUrls,
  extractUtcCampaignRange,
  extractPtCampaignRange,
  extractWeekdayPeakBand,
} = _testExports;

describe('extractPromotionUrls', () => {
  it('extracts promotion URLs from sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://support.claude.com/en/articles/some-usage-promotion</loc></url>
        <url><loc>https://support.claude.com/en/articles/other-article</loc></url>
        <url><loc>https://support.claude.com/en/articles/another-usage-promotion</loc></url>
      </urlset>`;

    const urls = extractPromotionUrls(xml);
    expect(urls).toHaveLength(2);
    expect(urls).toContain('https://support.claude.com/en/articles/some-usage-promotion');
    expect(urls).toContain('https://support.claude.com/en/articles/another-usage-promotion');
  });

  it('returns empty array when no promotion URLs found', () => {
    const xml = `<urlset><url><loc>https://support.claude.com/en/articles/faq</loc></url></urlset>`;
    expect(extractPromotionUrls(xml)).toHaveLength(0);
  });

  it('deduplicates URLs', () => {
    const xml = `<urlset>
      <url><loc>https://support.claude.com/en/articles/test-usage-promotion</loc></url>
      <url><loc>https://support.claude.com/en/articles/test-usage-promotion</loc></url>
    </urlset>`;
    expect(extractPromotionUrls(xml)).toHaveLength(1);
  });
});

describe('extractUtcCampaignRange', () => {
  it('parses "from ... through ... UTC" format', () => {
    const text = 'This promotion is running from March 1, 2024 at 12:00 AM UTC through March 3, 2024 at 11:59 PM UTC';
    const result = extractUtcCampaignRange(text);
    expect(result).not.toBeNull();
    expect(result!.startsAt.toISO()).toContain('2024-03-01');
    expect(result!.endsAt.toISO()).toContain('2024-03-03');
  });

  it('handles year inference when end date omits year', () => {
    const text = 'available from January 15, 2025 at 8:00 AM UTC through January 20 at 8:00 PM UTC';
    const result = extractUtcCampaignRange(text);
    expect(result).not.toBeNull();
    expect(result!.endsAt.year).toBe(2025);
  });

  it('returns null for non-matching text', () => {
    expect(extractUtcCampaignRange('no dates here')).toBeNull();
  });
});

describe('extractPtCampaignRange', () => {
  it('parses "from ... through ... PT" format', () => {
    const text = 'valid from January 10, 2024 through January 14, 2024 at 5:00 AM PT';
    const result = extractPtCampaignRange(text);
    expect(result).not.toBeNull();
    expect(result!.startsAt.zoneName).toBe('America/Los_Angeles');
    expect(result!.endsAt.zoneName).toBe('America/Los_Angeles');
  });

  it('returns null for non-matching text', () => {
    expect(extractPtCampaignRange('no PT dates here')).toBeNull();
  });
});

describe('extractWeekdayPeakBand', () => {
  it('parses strict "outside X AM - Y AM ET" format', () => {
    const text = 'Doubled usage outside 5 AM - 11 AM ET on weekdays';
    const result = extractWeekdayPeakBand(text);
    expect(result).not.toBeNull();
    expect(result!.peakStartHour).toBe(5);
    expect(result!.peakEndHour).toBe(11);
    expect(result!.parser).toBe('strict');
  });

  it('parses with colons "outside 5:00 AM - 11:00 AM ET"', () => {
    const text = 'outside 5:00 AM - 11:00 AM ET';
    const result = extractWeekdayPeakBand(text);
    expect(result).not.toBeNull();
    expect(result!.peakStartHour).toBe(5);
    expect(result!.peakEndHour).toBe(11);
  });

  it('falls back to line scanning when strict fails', () => {
    const text = 'Some preamble\nweekday peak hours are 9 AM to 5 PM ET\nMore text';
    const result = extractWeekdayPeakBand(text);
    expect(result).not.toBeNull();
    expect(result!.peakStartHour).toBe(9);
    expect(result!.peakEndHour).toBe(17);
    expect(result!.parser).toBe('fallback');
  });

  it('returns null when no ET hours found', () => {
    expect(extractWeekdayPeakBand('no peak hours mentioned')).toBeNull();
  });
});
