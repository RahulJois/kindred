import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

/** Opaque strip behind the transparent status bar, so scrolled content doesn't run under the clock. */
export function StatusBarBackdrop() {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.backdrop, { height: top, backgroundColor: t.background }]} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.sectionTitle, { color: t.muted }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : 'transparent';
  const fg = variant === 'primary' ? t.accentText : variant === 'danger' ? t.danger : t.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? t.accent : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}>
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accent + '22' : t.card }]}>
      <Text style={{ color: t.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.empty }]}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && { backgroundColor: t.card }]}>
          <Text style={{ color: o.value === value ? t.text : t.muted, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  button: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
});
