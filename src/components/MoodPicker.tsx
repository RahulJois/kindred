import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MOODS, useMoodColor } from '../moods';
import { MoodFace } from './MoodFace';
import { useTheme } from '../theme';

export function MoodPicker({ value, onChange }: { value: number | null; onChange: (mood: number) => void }) {
  const t = useTheme();
  const moodColor = useMoodColor();
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
              { backgroundColor: selected ? moodColor(m.value) + '33' : 'transparent', borderColor: selected ? moodColor(m.value) : 'transparent' },
              pressed && { opacity: 0.6 },
            ]}>
            <View style={value != null && !selected && { opacity: 0.4 }}>
              <MoodFace mood={m.value} size={40} />
            </View>
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
  label: { fontSize: 12, marginTop: 2, fontWeight: '500' },
});
