export async function compressReceipt(file: File): Promise<{ mime: string; dataB64: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the photo.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress the photo."))),
      "image/jpeg",
      0.72,
    );
  });
  if (blob.size > 220_000) {
    const tighter: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not compress the photo."))),
        "image/jpeg",
        0.5,
      );
    });
    const dataB64 = await blobToB64(tighter);
    return { mime: "image/jpeg", dataB64 };
  }
  return { mime: "image/jpeg", dataB64: await blobToB64(blob) };
}

function blobToB64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const i = result.indexOf(",");
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the photo."));
    reader.readAsDataURL(blob);
  });
}
