/**
 * QR rendering helpers.
 *
 * `renderQrSmall` produces a QR roughly half the visual width of
 * `qrcode-terminal`'s `{ small: true }` mode by mapping every 2x2 block of
 * QR modules to a single Unicode quarter-block character. This trades a
 * small amount of vertical aspect-ratio fidelity for a much more compact
 * grid — important when the output is embedded in a Claude Code reply
 * where horizontal space is precious.
 *
 * If a scanner can't read the quarter-block QR (rare, but possible on very
 * narrow or non-square monospace fonts) the deep link is always shown
 * above the QR for click-through fallback.
 */

// We reuse the QRCode generator that ships inside `qrcode-terminal` so we
// don't have to add a second QR dependency. The vendor path is a stable
// CommonJS module that has been part of the package since 0.x.
// Ambient module declarations live in qrcode-terminal-vendor.d.ts.

import QRCode from "qrcode-terminal/vendor/QRCode/index.js";
import QRErrorCorrectLevel from "qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel.js";

// Quarter-block character map indexed by a 4-bit value where:
//   bit 3 (8) = top-left dark
//   bit 2 (4) = top-right dark
//   bit 1 (2) = bottom-left dark
//   bit 0 (1) = bottom-right dark
const QUARTER_BLOCK = [
  " ", "▗", "▖", "▄",
  "▝", "▐", "▞", "▟",
  "▘", "▚", "▌", "▙",
  "▀", "▜", "▛", "█",
];

const QUIET_ZONE_MODULES = 2;

export function renderQrSmall(text: string): string {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(text);
  qr.make();

  const n = qr.getModuleCount();
  const total = n + QUIET_ZONE_MODULES * 2;
  // Pad to even so 2x2 walks emit whole characters with no leftover row/col.
  const padded = total + (total % 2);

  const isDark = (row: number, col: number): boolean => {
    const r = row - QUIET_ZONE_MODULES;
    const c = col - QUIET_ZONE_MODULES;
    if (r < 0 || r >= n || c < 0 || c >= n) return false;
    return qr.modules[r]?.[c] === true;
  };

  const lines: string[] = [];
  for (let r = 0; r < padded; r += 2) {
    let line = "";
    for (let c = 0; c < padded; c += 2) {
      const tl = isDark(r, c) ? 8 : 0;
      const tr = isDark(r, c + 1) ? 4 : 0;
      const bl = isDark(r + 1, c) ? 2 : 0;
      const br = isDark(r + 1, c + 1) ? 1 : 0;
      line += QUARTER_BLOCK[tl | tr | bl | br];
    }
    lines.push(line);
  }
  return lines.join("\n");
}
