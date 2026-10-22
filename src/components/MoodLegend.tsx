import { StyleSheet, Text, View } from 'react-native';

import { MOODS } from '../moods';
import { useTheme } from '../theme';
import { MoodFace } from './MoodFace';

export function MoodLegend() {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {MOODS.map((m) => (
        <View key={m.value} style={styles.item}>
          <MoodFace mood={m.value} size={14} />
          <Text style={{ color: t.muted, fontSize: 11, marginLeft: 4 }}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 10, rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
});
