/**
 * Cross-platform Image component.
 * Uses React Native's Image on web for reliable blob/remote URL rendering.
 * Uses expo-image on native for performance and caching.
 */
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { Platform, Image as RNImage } from 'react-native';

type CrossImageProps = ExpoImageProps;

function WebImageWrapper(props: any) {
  const { source, style, contentFit, accessibilityLabel, testID } = props;
  const resizeMode = contentFit === 'contain' ? 'contain' : contentFit === 'fill' ? 'stretch' : 'cover';
  return (
    <RNImage
      source={source}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
}

export const CrossImage = Platform.OS === 'web' ? WebImageWrapper : ExpoImage;
export type { CrossImageProps };
