import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

const VISIBLE_MS = 6000;

/** A short-lived "Logged · Undo" bar pinned to the bottom of the screen. */
export function UndoBar({
  message,
  icon,
  onUndo,
  onDismiss,
}: {
  message: string;
  icon?: ReactNode;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const t = useTheme();

  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <View style={[styles.bar, { backgroundColor: t.text }]} accessibilityLiveRegion="polite">
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.message, { color: t.background }]}>{message}</Text>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button">
        <Text style={[styles.undo, { color: t.accent }]}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
  },
  icon: { marginRight: 10 },
  message: { flex: 1, fontSize: 15 },
  undo: { fontSize: 15, fontWeight: '700', marginLeft: 16 },
});
