import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_BYTES,
  assertDrawioXmlSafe,
  assertImportSize,
  hasBlockedImportImage,
  hasBlockedImportMarkup,
  hasEmbeddedBlockedImage,
  isSafeRasterDataUrl,
  sanitizeImportPlainText,
} from './importSanitizer';

describe('import sanitizer', () => {
  it('strips script and HTML to plain text', () => {
    expect(sanitizeImportPlainText('<div>Intake</div>')).toBe('Intake');
    expect(sanitizeImportPlainText('<script>alert(1)</script>Review')).toBe('Review');
    expect(sanitizeImportPlainText('<span onclick="alert(1)">Done</span>')).toBe('Done');
    expect(sanitizeImportPlainText('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeImportPlainText('')).toBe('');
  });

  it('blocks remote http(s) images and svg-xml data URLs', () => {
    expect(hasBlockedImportImage('https://evil.example/x.png')).toBe(true);
    expect(hasBlockedImportImage('http://evil.example/x.png')).toBe(true);
    expect(hasBlockedImportImage('data:image/svg+xml;base64,PHN2Zw==')).toBe(true);
    expect(hasEmbeddedBlockedImage('rounded=0;image=https://evil.example/x.png;')).toBe(true);
    expect(hasEmbeddedBlockedImage('image=data:image/svg+xml,<svg onload="alert(1)"/>')).toBe(true);
    expect(hasEmbeddedBlockedImage('rounded=0;whiteSpace=wrap;html=1;')).toBe(false);
    expect(isSafeRasterDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('treats script tags as blocked markup', () => {
    expect(hasBlockedImportMarkup('<script>alert(1)</script>')).toBe(true);
    expect(hasBlockedImportMarkup('<iframe src="https://evil.example"></iframe>')).toBe(true);
    expect(hasBlockedImportMarkup('Intake')).toBe(false);
  });

  it('rejects huge files and DTD/ENTITY payloads', () => {
    expect(() => assertImportSize({ size: MAX_IMPORT_BYTES + 1, name: 'huge.drawio' })).toThrow(/too large/i);
    expect(() => assertImportSize({ size: 10, name: 'ok.drawio' }, 'x'.repeat(MAX_IMPORT_BYTES + 1))).toThrow(/too large/i);
    expect(() => assertDrawioXmlSafe('<!DOCTYPE foo [<!ENTITY x SYSTEM "http://evil">]><mxfile/>')).toThrow(/valid draw\.io/i);
    expect(() => assertDrawioXmlSafe('<mxfile><diagram/></mxfile>')).not.toThrow();
  });
});
