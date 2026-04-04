import { File } from 'expo-file-system';
import { type ShareIntentFile } from 'expo-share-intent';

export function isReadableTextFile(file: ShareIntentFile) {
  return (
    file.mimeType.startsWith('text/') ||
    /\.(txt|md|csv|json|log|xml|html?|yaml|yml|rtf)$/i.test(file.fileName)
  );
}

export function fileCategory(file: ShareIntentFile) {
  if (file.mimeType.startsWith('image/')) return 'Image';
  if (file.mimeType.startsWith('video/')) return 'Video';
  if (file.mimeType.startsWith('audio/')) return 'Audio';
  if (isReadableTextFile(file)) return 'Text';
  return 'File';
}

export function formatBytes(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'unknown size';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

export function normalizeFileUri(uri: string) {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  if (/^[a-z]+:\/\//i.test(uri)) {
    return uri;
  }

  return `file://${uri}`;
}

export async function readTextFromFileUri(uri: string) {
  const normalized = normalizeFileUri(uri);
  if (!normalized.startsWith('file://')) {
    throw new Error('Only file:// paths can be read directly in this build.');
  }

  return new File(normalized).text();
}
