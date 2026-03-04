import { useCallback, useEffect } from "react";
import {
  View,
  Dimensions,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  height = 280,
}: Props) {
  const { colors } = useTheme();
  const translateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 150 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(height, { damping: 20, stiffness: 150 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, height]);

  const close = useCallback(() => {
    translateY.value = withSpring(height, { damping: 20, stiffness: 150 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onClose, 200);
  }, [onClose, height]);

  const pan = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const newY = context.value.y + event.translationY;
      translateY.value = Math.max(0, newY);
    })
    .onEnd((event) => {
      if (event.translationY > 60 || event.velocityY > 500) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.overlay },
            backdropStyle,
          ]}
        />
      </Pressable>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height,
              backgroundColor: colors.bgSecondary,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 12,
            },
            sheetStyle,
          ]}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginBottom: 12,
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            {children}
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
