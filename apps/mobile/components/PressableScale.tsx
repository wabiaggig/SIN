import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps } from "react-native";

/**
 * Pressable con un pequeño "hundido" al tocar (escala + opacidad) — el
 * mismo feedback táctil en todos los botones principales de la app en vez
 * de repetirlo pantalla por pantalla. children es siempre estático acá
 * (nunca la forma "render prop" que admite Pressable) — no la necesitamos
 * en ningún llamador.
 */
export function PressableScale({
  style,
  children,
  disabled,
  ...rest
}: Omit<PressableProps, "children" | "style"> & { children: ReactNode; style?: PressableProps["style"] }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
