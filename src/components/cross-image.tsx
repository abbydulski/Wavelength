/**
 * Cross-platform Image component.
 * Uses React Native's Image on web (renders as a standard <img> tag) for reliable
 * blob URI and remote URL support. Uses expo-image on native for performance.
 */
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { Image as RNImage, Platform } from 'react-native';

type CrossImageProps = ExpoImageProps;

function WebImageWrapper({ source, style, contentFit, contentPosition, ...rest }: any) {
  return (
    <RNImage
      source={source}
      style={style}
      resizeMode={contentFit === 'contain' ? 'contain' : contentFit === 'fill' ? 'stretch' : 'cover'}
      {...rest}
    />
  );
}

export const CrossImage = Platform.OS === 'web' ? WebImageWrapper : ExpoImage;
export type { CrossImageProps };
