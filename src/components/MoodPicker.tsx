import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MOODS } from '../moods';
import { useTheme } from '../theme';

export function MoodPicker({ value, onChange }: { value: number | null; onChange: (mood: number) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {MOODS.map((m) => {
        const selected = m.value === value;
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(m.value)}
            accessibilityLabel={m.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: selected ? m.color + '33' : 'transparent', borderColor: selected ? m.color : 'transparent' },
              pressed && { opacity: 0.6 },
            ]}>
            <Text style={[styles.emoji, value != null && !selected && { opacity: 0.45 }]}>{m.emoji}</Text>
            <Text style={[styles.label, { color: selected ? t.text : t.muted }]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center', paddingVertical: 8, marginHorizontal: 2, borderRadius: 14, borderWidth: 1.5 },
  emoji: { fontSize: 32 },
  label: { fontSize: 12, marginTop: 2, fontWeight: '500' },
});
