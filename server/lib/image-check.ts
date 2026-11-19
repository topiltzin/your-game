// Magic-byte check: the declared content type is never trusted on its own.

export type AcceptedImageType = "image/jpeg" | "image/png" | "image/webp";

export function detectImageType(bytes: Uint8Array): AcceptedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 12 && matches(bytes, 0, "RIFF") && matches(bytes, 8, "WEBP")) return "image/webp";
  return null;
}

function matches(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}
