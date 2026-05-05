import QRCode from "qrcode-terminal/vendor/QRCode/index.js";
import QRErrorCorrectLevel from "qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel.js";

const QUIET = 2;

export function renderQrFullBlock(text: string): string {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(text);
  qr.make();

  const n = qr.getModuleCount();
  const lines: string[] = [];

  for (let r = -QUIET; r < n + QUIET; r++) {
    let line = "";
    for (let c = -QUIET; c < n + QUIET; c++) {
      const dark = r >= 0 && r < n && c >= 0 && c < n && qr.modules[r]?.[c] === true;
      line += dark ? "█" : " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
