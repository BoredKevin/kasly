/**
 * Canvas compositor to generate high-resolution, branded Indonesian standard
 * QRIS sticker images (1000x1388) from the official template in /public.
 */

export interface CompositeQrisOptions {
  templateUrl?: string;
  qrImageUrl: string;
  merchantName: string;
  amount?: number;
  currency?: string;
  invoiceNumber: string;
}

/**
 * Loads an image with CORS enabled and returns a Promise.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) =>
      reject(
        new Error(
          `Failed to load image at ${src}: ${e instanceof Error ? e.message : "Load failed"}`
        )
      );
    img.src = src;
  });
}

/**
 * Wraps text into multiple lines for canvas rendering if it exceeds maxWidth.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(`${currentLine} ${word}`).width;
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Generates and triggers download of the complete branded QRIS card image,
 * following national QRIS design guidelines (Bold title, aligned cutout, no hardcoded total).
 */
export async function downloadBrandedQrisImage({
  templateUrl = "/qris_template.0376c2d6e287551a.png",
  qrImageUrl,
  merchantName,
  invoiceNumber,
}: CompositeQrisOptions): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1388;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  try {
    // 1. Load both template background and QR code image
    const [templateImg, qrImg] = await Promise.all([
      loadImage(templateUrl),
      loadImage(qrImageUrl),
    ]);

    // 2. Draw template frame
    ctx.drawImage(templateImg, 0, 0, 1000, 1388);

    // 3. Draw Bold QRIS Merchant Display Name
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.font = "bold 34px 'Plus Jakarta Sans', sans-serif";

    const maxTitleWidth = 740;
    const lines = wrapText(ctx, merchantName, maxTitleWidth).slice(0, 2);

    const titleCenterY = lines.length === 1 ? 310 : 295;
    const lineHeight = 40;
    lines.forEach((line, index) => {
      ctx.fillText(line, 500, titleCenterY + index * lineHeight);
    });

    // 4. Draw QR Code centered (800x800 with equal 100px margins on left and right, matching ESB order)
    const qrSize = 800;
    const qrX = (1000 - qrSize) / 2;
    const qrY = lines.length === 1 ? 370 : 390;

    // Draw white background backing for QR code (to cleanly overlay red arrow on left, matching ESB order)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.drawImage(qrImg, qrX + 8, qrY + 8, qrSize - 16, qrSize - 16);

    // 6. Convert to Blob & download (No NMID, no hardcoded total)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          fallbackDownload(qrImageUrl, `QRIS-${invoiceNumber}.png`);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `QRIS-${invoiceNumber}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      "image/png",
      1.0
    );
  } catch (err) {
    console.warn("Could not generate composite QRIS canvas, using fallback image download:", err);
    fallbackDownload(qrImageUrl, `QRIS-${invoiceNumber}.png`);
  }
}

function fallbackDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
