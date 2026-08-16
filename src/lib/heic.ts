/**
 * Web-only HEIC/HEIF handling.
 * Browsers cannot natively decode HEIC, so we convert picked HEIC assets to JPEG
 * using heic-to (libheif WASM) before previewing or uploading. No-op on native.
 */
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

function looksLikeHeic(asset: ImagePickerAsset): boolean {
  const mime = asset.mimeType?.toLowerCase() ?? '';
  if (mime === 'image/heic' || mime === 'image/heif') return true;
  const ext = (asset.uri.split('?')[0].split('.').pop() ?? '').toLowerCase();
  return ext === 'heic' || ext === 'heif';
}

/**
 * On web, converts a HEIC/HEIF asset to a JPEG blob URI. Returns the asset
 * unchanged on native or when conversion is unnecessary/unsupported.
 */
export async function convertHeicOnWeb(asset: ImagePickerAsset): Promise<ImagePickerAsset> {
  if (Platform.OS !== 'web') return asset;

  try {
    const resp = await fetch(asset.uri);
    const blob = await resp.blob();

    const { heicTo, isHeic } = await import('heic-to');
    const needsConvert = looksLikeHeic(asset) || (await isHeic(blob as File));
    if (!needsConvert) return asset;

    const jpegBlob = await heicTo({ blob, type: 'image/jpeg', quality: 0.85 });
    const jpegUri = URL.createObjectURL(jpegBlob);
    return { ...asset, uri: jpegUri, mimeType: 'image/jpeg' };
  } catch {
    return asset;
  }
}
