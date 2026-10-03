import { StyleSheet, Text, View } from 'react-native';

import { MOODS } from '../moods';
import { useTheme } from '../theme';

export function MoodLegend() {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {MOODS.map((m) => (
        <View key={m.value} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: m.color }]} />
          <Text style={{ color: t.muted, fontSize: 11 }}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  swatch: { width: 9, height: 9, borderRadius: 2, marginRight: 4 },
});
