/** Local-first import guards. Shared by draw.io and portable JSON import. */

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_LABEL = 200;

const SAFE_RASTER_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif)(?:;[\w.-]+=[\w.-]+)*;base64,[A-Za-z0-9+/]+={0,2}$/i;
const SCRIPT_OR_EMBED = /<(script|iframe|object|embed|svg|foreignobject|link|meta)\b/i;
const SVG_XML_DATA = /data:image\/svg\+xml/i;
const REMOTE_IMAGE = /(?:image\s*=\s*|xlink:href\s*=\s*|href\s*=\s*)(?:"|')?(?:https?:\/\/|data:image\/svg\+xml)/i;
const JAVASCRIPT_URL = /(?:javascript|vbscript):/i;

export function isSafeRasterDataUrl(value: string): boolean {
  return SAFE_RASTER_DATA_URL.test(value.trim());
}

export function hasEmbeddedBlockedImage(value: string): boolean {
  return SVG_XML_DATA.test(value) || REMOTE_IMAGE.test(value);
}

export function hasBlockedImportImage(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (hasEmbeddedBlockedImage(text)) return true;
  if (/^https?:\/\//i.test(text)) return true;
  return false;
}

export function hasBlockedImportMarkup(value: string): boolean {
  return SCRIPT_OR_EMBED.test(value) || JAVASCRIPT_URL.test(value);
}

export function assertImportSize(file: Pick<File, 'size' | 'name'>, text?: string): void {
  if (file.size > MAX_IMPORT_BYTES || (text != null && text.length > MAX_IMPORT_BYTES)) {
    throw new Error('That file is too large to import.');
  }
}

export function assertDrawioXmlSafe(xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new Error("That file isn't a valid draw.io diagram.");
  }
  if (xml.length > MAX_IMPORT_BYTES) {
    throw new Error('That file is too large to import.');
  }
}

export function sanitizeImportPlainText(value: string, fallback = ''): string {
  let text = value.replace(/\u0000/g, '');
  text = text.replace(/<(script|style|iframe|object|embed|svg|foreignobject)\b[\s\S]*?<\/\1>/gi, ' ');
  text = text.replace(/<(script|style|iframe|object|embed|svg|foreignobject|link|meta)\b[^>]*\/?>/gi, ' ');
  text = text.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  text = text.replace(/<br\s*\/?>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(JAVASCRIPT_URL, '');
  text = text.replace(SVG_XML_DATA, '');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > MAX_IMPORT_LABEL) text = text.slice(0, MAX_IMPORT_LABEL).trim();
  return text || fallback;
}
