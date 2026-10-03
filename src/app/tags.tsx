import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, SectionTitle } from '../components/ui';
import { useQuery, useRefresh } from '../data';
import { addTag, getTags, setTagArchived, type Tag } from '../db';
import { useTheme } from '../theme';

export default function TagsScreen() {
  const t = useTheme();
  const db = useSQLiteContext();
  const refresh = useRefresh();
  const tags = useQuery(getTags) ?? [];
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await addTag(db, emoji.trim() || '🏷️', name.trim());
    setEmoji('');
    setName('');
    refresh();
  };

  const toggle = async (tag: Tag) => {
    await setTagArchived(db, tag.id, !tag.archived);
    refresh();
  };

  const active = tags.filter((tag) => !tag.archived);
  const archived = tags.filter((tag) => tag.archived);

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle>New tag</SectionTitle>
      <Card>
        <View style={styles.inputRow}>
          <TextInput
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🙂"
            placeholderTextColor={t.muted}
            maxLength={8}
            style={[styles.input, styles.emojiInput, { color: t.text, borderColor: t.border }]}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meditation"
            placeholderTextColor={t.muted}
            onSubmitEditing={add}
            returnKeyType="done"
            style={[styles.input, { flex: 1, color: t.text, borderColor: t.border }]}
          />
        </View>
        <Button title="Add tag" onPress={add} disabled={!name.trim()} />
      </Card>

      <SectionTitle>Your tags</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {active.map((tag) => (
          <TagRow key={tag.id} tag={tag} action="Hide" onPress={() => toggle(tag)} />
        ))}
        {active.length === 0 && <Text style={{ color: t.muted, paddingVertical: 12 }}>No tags yet.</Text>}
      </Card>

      {archived.length > 0 && (
        <>
          <SectionTitle>Hidden</SectionTitle>
          <Text style={{ color: t.muted, marginBottom: 8 }}>Hidden tags stay on past entries and in insights.</Text>
          <Card style={{ paddingVertical: 4 }}>
            {archived.map((tag) => (
              <TagRow key={tag.id} tag={tag} action="Restore" onPress={() => toggle(tag)} />
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function TagRow({ tag, action, onPress }: { tag: Tag; action: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>
        {tag.emoji} {tag.name}
      </Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={{ color: t.accent, fontWeight: '600' }}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  emojiInput: { width: 60, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
