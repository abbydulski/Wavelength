import { useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type PressableScaleProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. Default 0.97. */
  activeScale?: number;
  /** Opacity applied while pressed. Default 0.85. */
  activeOpacity?: number;
};

/**
 * Pressable with a subtle scale + opacity dip on press.
 * Gives consistent tactile feedback across the app without repeating
 * Animated boilerplate. Falls back to opacity only on web.
 */
export function PressableScale({
  style,
  activeScale = 0.97,
  activeOpacity = 0.85,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: toScale,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) animateTo(activeScale, activeOpacity);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1, 1);
        onPressOut?.(e);
      }}
      {...rest}>
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children as any}
      </Animated.View>
    </Pressable>
  );
}
