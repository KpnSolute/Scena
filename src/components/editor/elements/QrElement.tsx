import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { QrCode } from "@phosphor-icons/react";
import { readQrConfig, type QrErrorCorrection } from "../../../services/scena-api/boards";
import type { ElementRendererProps } from "./types";

interface QrMatrix { size: number; path: string }

/** Builds the module grid as a single SVG path (one `h1v1h-1z` per dark
 * module) so the whole code is one <path>, not hundreds of <rect>s. */
function buildMatrix(value: string, errorCorrection: QrErrorCorrection): QrMatrix | null {
  if (!value) return null;
  try {
    const code = qrcode(0, errorCorrection);
    code.addData(value);
    code.make();
    const size = code.getModuleCount();
    let path = "";
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (code.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { size, path };
  } catch {
    return null;
  }
}

export function QrElement({ element }: ElementRendererProps) {
  const config = readQrConfig(element);
  // Memoized on exactly the inputs that change the module grid — foreground/
  // background/margin are pure render-time styling and must not force a
  // recompute of the matrix.
  const matrix = useMemo(() => buildMatrix(config.value, config.error_correction), [config.value, config.error_correction]);

  if (!config.value || !matrix) {
    return (
      <div className="scena-editor__renderer-qr-empty" role="img" aria-label="No QR value configured">
        <QrCode size={22} aria-hidden="true" />
        <small>Add a value to generate a QR code</small>
      </div>
    );
  }

  const viewSize = matrix.size + config.margin * 2;

  return (
    <div className="scena-editor__renderer-qr">
      <svg viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={`QR code for ${config.value}`}>
        <rect width={viewSize} height={viewSize} fill={config.background} />
        <path d={matrix.path} fill={config.foreground} transform={`translate(${config.margin} ${config.margin})`} />
      </svg>
    </div>
  );
}
