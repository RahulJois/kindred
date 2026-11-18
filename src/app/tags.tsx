import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, SectionTitle } from '../components/ui';
import { useQuery, useRefresh } from '../data';
import { addTag, DEFAULT_TAG_EMOJI, getTags, setTagArchived, updateTag, type Tag } from '../db';
import { useTheme } from '../theme';

// Common things people track. Anything else can be typed from the keyboard.
const EMOJI_CHOICES = [
  '🏃', '🏋️', '🧘', '🚶', '🚴', '⚽', '💼', '📚',
  '💻', '🎓', '😴', '🛌', '🍎', '🍔', '☕', '🍷',
  '👪', '🤝', '❤️', '💬', '🎉', '🐶', '🌳', '☀️',
  '🌧️', '✈️', '🏠', '🧹', '🛒', '💰', '🎨', '🎮',
  '🎵', '🎬', '📺', '📱', '🙏', '💊', '🤒', '🩸',
  '😰', '😤', '😢', '😊', '🥳', '🧠', '✍️', '🛋️',
];

export default function TagsScreen() {
  const t = useTheme();
  const db = useSQLiteContext();
  const refresh = useRefresh();
  const tags = useQuery(getTags) ?? [];
  const [editing, setEditing] = useState<Tag | null>(null);
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const reset = () => {
    setEditing(null);
    setEmoji('');
    setName('');
  };

  const startEdit = (tag: Tag) => {
    setEditing(tag);
    setEmoji(tag.emoji);
    setName(tag.name);
    // The form is at the top; bring it into view when editing a tag from further down.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Typing into the emoji box replaces the emoji instead of appending to it, so picking a
  // new one from the keyboard always works.
  const typeEmoji = (next: string) => {
    const added = next.startsWith(emoji) ? next.slice(emoji.length) : next;
    setEmoji(added.trim());
  };

  const save = async () => {
    if (!name.trim()) return;
    const e = emoji.trim() || DEFAULT_TAG_EMOJI;
    if (editing) await updateTag(db, editing.id, e, name.trim());
    else await addTag(db, e, name.trim());
    reset();
    refresh();
  };

  const toggle = async (tag: Tag) => {
    await setTagArchived(db, tag.id, !tag.archived);
    if (editing?.id === tag.id) reset();
    refresh();
  };

  const active = tags.filter((tag) => !tag.archived);
  const archived = tags.filter((tag) => tag.archived);

  return (
    <ScrollView ref={scrollRef} style={{ backgroundColor: t.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle>{editing ? `Edit “${editing.name}”` : 'New tag'}</SectionTitle>
      <Card>
        <View style={styles.inputRow}>
          <TextInput
            value={emoji}
            onChangeText={typeEmoji}
            placeholder={DEFAULT_TAG_EMOJI}
            placeholderTextColor={t.muted}
            accessibilityLabel="Tag emoji"
            style={[styles.input, styles.emojiInput, { color: t.text, borderColor: t.border }]}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meditation"
            placeholderTextColor={t.muted}
            onSubmitEditing={save}
            returnKeyType="done"
            style={[styles.input, { flex: 1, color: t.text, borderColor: t.border }]}
          />
        </View>
        <View style={styles.grid}>
          {EMOJI_CHOICES.map((e) => {
            const selected = e === emoji;
            return (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityLabel={`Use ${e}`}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.emojiChoice,
                  { backgroundColor: selected ? t.accent + '22' : 'transparent', borderColor: selected ? t.accent : 'transparent' },
                  pressed && { opacity: 0.6 },
                ]}>
                <Text style={styles.emojiChoiceText}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: t.muted, fontSize: 12, marginBottom: 12 }}>Or tap the box on the left and use your keyboard&apos;s emoji.</Text>
        <Button title={editing ? 'Save tag' : 'Add tag'} onPress={save} disabled={!name.trim()} />
        {editing && (
          <View style={{ marginTop: 8 }}>
            <Button title="Cancel" variant="secondary" onPress={reset} />
          </View>
        )}
      </Card>

      <SectionTitle>Your tags</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {active.map((tag) => (
          <TagRow key={tag.id} tag={tag} editing={editing?.id === tag.id} action="Hide" onEdit={() => startEdit(tag)} onPress={() => toggle(tag)} />
        ))}
        {active.length === 0 && <Text style={{ color: t.muted, paddingVertical: 12 }}>No tags yet.</Text>}
      </Card>
      {active.length > 0 && <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>Tap a tag to change its emoji or name.</Text>}

      {archived.length > 0 && (
        <>
          <SectionTitle>Hidden</SectionTitle>
          <Text style={{ color: t.muted, marginBottom: 8 }}>Hidden tags stay on past entries and in insights.</Text>
          <Card style={{ paddingVertical: 4 }}>
            {archived.map((tag) => (
              <TagRow key={tag.id} tag={tag} editing={editing?.id === tag.id} action="Restore" onEdit={() => startEdit(tag)} onPress={() => toggle(tag)} />
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function TagRow({ tag, editing, action, onEdit, onPress }: { tag: Tag; editing: boolean; action: string; onEdit: () => void; onPress: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <Pressable onPress={onEdit} style={({ pressed }) => [styles.rowLabel, pressed && { opacity: 0.6 }]} accessibilityLabel={`Edit ${tag.name}`}>
        <Text style={styles.rowEmoji}>{tag.emoji}</Text>
        <Text style={{ color: editing ? t.accent : t.text, fontSize: 16, flexShrink: 1 }} numberOfLines={1}>
          {tag.name}
        </Text>
      </Pressable>
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
  emojiInput: { width: 60, textAlign: 'center', fontSize: 22, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  emojiChoice: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1.5 },
  emojiChoiceText: { fontSize: 22 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  rowEmoji: { fontSize: 18, marginRight: 10 },
});
