// Turning dropped files into Anthropic content blocks.

export type Kind = 'image' | 'pdf' | 'audio' | 'unsupported';

/** Long edge cap for uploaded photos: keeps requests small and tokens cheap. */
const MAX_EDGE = 1600;

export function kindOf(file: File): Kind {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('audio/') || type.startsWith('video/')) return 'audio';
  if (/\.(m4a|mp3|wav|aac|ogg|opus|webm|flac)$/.test(name)) return 'audio';
  return 'unsupported';
}

/** Chunked so a large file cannot blow the call stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Downscale a photo and re-encode as JPEG. Lecture-slide photos off a phone are
 * often 4000px and several MB; the model gains nothing from that, and the
 * request has a hard 32MB ceiling.
 */
export async function imageBlock(file: File): Promise<any> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('image encode failed'))),
      'image/jpeg',
      0.85,
    ),
  );

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: toBase64(new Uint8Array(await blob.arrayBuffer())),
    },
  };
}

export async function pdfBlock(file: File): Promise<any> {
  return {
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: toBase64(new Uint8Array(await file.arrayBuffer())),
    },
    title: file.name,
  };
}
