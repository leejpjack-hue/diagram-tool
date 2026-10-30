// Keep CI defaults while allowing the same assertions on slower local hosts.
const scale = Number(process.env.PW_TIMEOUT_SCALE ?? 1);
if (!Number.isFinite(scale) || scale <= 0 || scale > 10) {
  throw new Error('PW_TIMEOUT_SCALE must be greater than zero and at most 10.');
}

export const testTimeout = (milliseconds: number) => Math.ceil(milliseconds * scale);
