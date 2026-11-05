import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MoodFace } from '../components/MoodFace';
import { Chip } from '../components/ui';
import { useQuery } from '../data';
import { formatMedium } from '../dates';
import { getTags, searchEntries, type Entry, type Tag } from '../db';
import { MOODS, moodInfo } from '../moods';
import { useTheme } from '../theme';

const LIMIT = 200;

export default function SearchScreen() {
  const t = useTheme();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<number | null>(null);

  // Don't hit the database on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), 150);
    return () => clearTimeout(id);
  }, [text]);

  const active = query !== '' || mood != null;
  const data = useQuery(
    async (db) => ({ results: active ? await searchEntries(db, query, mood, LIMIT) : [], tags: await getTags(db) }),
    `${query}|${mood}`
  );
  const tagById = useMemo(() => new Map((data?.tags ?? []).map((tag) => [tag.id, tag])), [data]);
  const results = data?.results ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={styles.header}>
        <View style={[styles.field, { backgroundColor: t.card, borderColor: t.border }]}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder="Search notes and tags"
            placeholderTextColor={t.muted}
            returnKeyType="search"
            style={[styles.input, { color: t.text }]}
          />
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={t.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods} keyboardShouldPersistTaps="handled">
          {MOODS.map((m) => (
            <Chip key={m.value} label={m.label} selected={mood === m.value} onPress={() => setMood(mood === m.value ? null : m.value)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(e) => e.date}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          active && results.length ? (
            <Text style={[styles.count, { color: t.muted }]}>
              {results.length >= LIMIT ? `Latest ${LIMIT} days` : `${results.length} ${results.length === 1 ? 'day' : 'days'}`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.muted }]}>
            {!active ? 'Find a day by something you wrote, a tag, or a mood.' : data ? 'No days match.' : ''}
          </Text>
        }
        renderItem={({ item }) => (
          <ResultRow entry={item} query={query} tagById={tagById} onPress={() => router.push({ pathname: '/day/[date]', params: { date: item.date } })} />
        )}
      />
    </View>
  );
}

/** The part of the note around the first match, so the match is visible in a two-line preview. */
function snippet(note: string, query: string) {
  const text = note.trim().replace(/\s+/g, ' ');
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  // A short note fits the two-line preview whole; only trim the start of a long one.
  if (at <= 40 || text.length <= 80) return { text, at };
  const start = text.lastIndexOf(' ', at - 30) + 1;
  if (start === 0) return { text, at };
  return { text: '…' + text.slice(start), at: at - start + 1 };
}

function ResultRow({ entry, query, tagById, onPress }: { entry: Entry; query: string; tagById: Map<number, Tag>; onPress: () => void }) {
  const t = useTheme();
  const tags = entry.tagIds.map((id) => tagById.get(id)).filter((tag): tag is Tag => !!tag);
  const s = snippet(entry.note, query);
  const q = query.toLowerCase();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}>
      <MoodFace mood={entry.mood} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>
          {formatMedium(entry.date)} <Text style={{ color: t.muted, fontWeight: '400' }}>· {moodInfo(entry.mood).label}</Text>
        </Text>
        {tags.length ? (
          <Text style={{ color: t.muted, marginTop: 2 }} numberOfLines={1}>
            {tags.map((tag, i) => (
              <Text key={tag.id} style={q && tag.name.toLowerCase().includes(q) ? { color: t.text, fontWeight: '700' } : undefined}>
                {i ? '  ' : ''}
                {tag.emoji} {tag.name}
              </Text>
            ))}
          </Text>
        ) : null}
        {s.text ? (
          <Text style={{ color: t.muted, marginTop: 2 }} numberOfLines={2}>
            {s.at < 0 ? (
              s.text
            ) : (
              <>
                {s.text.slice(0, s.at)}
                <Text style={{ color: t.text, fontWeight: '700' }}>{s.text.slice(s.at, s.at + query.length)}</Text>
                {s.text.slice(s.at + query.length)}
              </>
            )}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  moods: { gap: 8, paddingBottom: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  count: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  empty: { textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
