import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  useDerivedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateStyles } from "@/hooks/useCreateStyles";
import type { ColorPalette, Spacing, Typography, Radius } from "@/lib/theme";

const BAR_COUNT = 20;
const ANIM_DURATION = 200;

interface AudioPlayerProps {
  uri: string;
  duration: number;
  isMe: boolean;
}

// Pre-compute deterministic bar heights so they don't change on re-render
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const base = 8 + Math.sin(i * 0.8) * 8;
  // Use a seeded pseudo-random offset per bar instead of Math.random()
  const pseudo = Math.abs(Math.sin(i * 2.3 + 1.7)) * 4;
  return base + pseudo;
});

// ─── Animated Waveform Bar ────────────────────────────────────
interface BarProps {
  height: number;
  filled: boolean;
  filledColor: string;
  unfilledColor: string;
}

function WaveformBar({ height, filled, filledColor, unfilledColor }: BarProps) {
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, { duration: ANIM_DURATION });
  }, [filled]);

  const animatedBarStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [unfilledColor, filledColor]
    );
    return { backgroundColor };
  });

  return (
    <Animated.View
      style={[
        {
          width: 3,
          borderRadius: 1.5,
          height,
        },
        animatedBarStyle,
      ]}
    />
  );
}

// ─── AudioPlayer ──────────────────────────────────────────────
export default function AudioPlayer({ uri, duration = 0, isMe }: AudioPlayerProps) {
  const { colors } = useTheme();
  const styles = useCreateStyles(createStyles);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Animate play/pause icon scale
  const iconScale = useSharedValue(1);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis / 1000);
    setIsPlaying(status.isPlaying);
    if (status.durationMillis) {
      setTotalDuration(status.durationMillis / 1000);
    }
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      soundRef.current?.setPositionAsync(0);
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    // Trigger scale pop on the icon
    iconScale.value = withTiming(0.75, { duration: 80 }, () => {
      iconScale.value = withTiming(1, { duration: 120 });
    });

    try {
      if (soundRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          await soundRef.current.playAsync();
        }
      } else {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
      }
    } catch (error) {
      console.error("[AudioPlayer] Error:", error);
    }
  }, [uri, isPlaying, onPlaybackStatusUpdate]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? (position / totalDuration) * 100 : 0;

  // Derive bar colors from theme based on isMe
  const filledColor = isMe ? colors.bubbleMeText : colors.primary;
  const unfilledColor = isMe ? `${colors.bubbleMeText}4D` : colors.bgTertiary;

  return (
    <View style={styles.container}>
      <AnimatedPressable
        onPress={togglePlayback}
        style={styles.playButton}
        haptic="light"
        scaleValue={0.9}
      >
        <Animated.View style={animatedIconStyle}>
          <Ionicons
            name={isPlaying ? "pause-outline" : "play-outline"}
            size={16}
            color={isMe ? colors.bubbleMeText : colors.primary}
          />
        </Animated.View>
      </AnimatedPressable>

      <View style={styles.waveform}>
        {BAR_HEIGHTS.map((height, i) => {
          const filled = (i / BAR_COUNT) * 100 < progress;
          return (
            <WaveformBar
              key={i}
              height={height}
              filled={filled}
              filledColor={filledColor}
              unfilledColor={unfilledColor}
            />
          );
        })}
      </View>

      <Text
        style={[
          styles.timeText,
          { color: isMe ? `${colors.bubbleMeText}99` : colors.textMuted },
        ]}
      >
        {formatTime(isPlaying ? position : totalDuration)}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const createStyles = (colors: ColorPalette, t: Typography, s: Spacing, r: Radius) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: s.sm,
    minWidth: 200,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: r.full,
    backgroundColor: colors.primaryBg,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  waveform: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    height: 24,
  },
  timeText: {
    ...t.small,
    minWidth: 30,
    textAlign: "right" as const,
  },
});
