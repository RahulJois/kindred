import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodPicker } from '../../components/MoodPicker';
import { Button, Chip, SectionTitle } from '../../components/ui';
import { notifyDayMood, useRefresh } from '../../data';
import { formatLong } from '../../dates';
import { deleteEntry, getEntry, getTags, saveEntry, type Tag } from '../../db';
import { useTheme } from '../../theme';

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const refresh = useRefresh();
  const navigation = useNavigation();

  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  // What was last saved, so we can tell whether leaving would lose edits.
  const [saved, setSaved] = useState<{ mood: number | null; note: string; tagIds: number[] }>({ mood: null, note: '', tagIds: [] });

  const loadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // Reload tags on every focus so ones added in "Edit tags" show up straight away.
        const allTags = await getTags(db);
        if (!active) return;
        setTags(allTags);
        if (loadedRef.current) return;
        const entry = await getEntry(db, date);
        if (!active) return;
        loadedRef.current = true;
        if (entry) {
          setExists(true);
          setMood(entry.mood);
          setNote(entry.note);
          setTagIds(entry.tagIds);
          setSaved({ mood: entry.mood, note: entry.note, tagIds: entry.tagIds });
        }
        setLoaded(true);
      })().catch(console.warn);
      return () => {
        active = false;
      };
    }, [db, date])
  );

  const dirty =
    loaded &&
    (mood !== saved.mood ||
      note.trim() !== saved.note.trim() ||
      [...tagIds].sort().join() !== [...saved.tagIds].sort().join());

  // Ask before throwing away edits. This reads refs inside a `beforeRemove` listener rather than
  // using usePreventRemove: toggling that off while popping the screen makes react-native-screens
  // update the header of a detaching fragment and crash ("ScreenStackFragment added into a
  // non-stack container").
  const dirtyRef = useRef(false);
  const leavingRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirtyRef.current || leavingRef.current) return;
        e.preventDefault();
        Alert.alert('Discard changes?', "You haven't saved this day yet.", [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation]
  );

  const leave = () => {
    leavingRef.current = true;
    router.back();
  };

  // Archived tags stay visible on entries that already use them.
  const visibleTags = tags.filter((tag) => !tag.archived || tagIds.includes(tag.id));
  const toggleTag = (id: number) => setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const save = async () => {
    if (mood == null) return;
    await saveEntry(db, { date, mood, note: note.trim(), tagIds });
    notifyDayMood(date, mood);
    refresh();
    leave();
  };

  const remove = () =>
    Alert.alert('Delete this entry?', 'The mood, tags and note for this day will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, date);
          notifyDayMood(date, null);
          refresh();
          leave();
        },
      },
    ]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: t.background }} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.date, { color: t.text }]}>{formatLong(date)}</Text>

        <SectionTitle>Mood</SectionTitle>
        <MoodPicker value={mood} onChange={setMood} />

        <View style={styles.tagsHeader}>
          <SectionTitle>What was part of your day?</SectionTitle>
          <Pressable onPress={() => router.push('/tags')} hitSlop={8}>
            <Text style={{ color: t.accent, fontWeight: '600', marginTop: 12 }}>Edit tags</Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {visibleTags.map((tag) => (
            <Chip key={tag.id} label={`${tag.emoji} ${tag.name}`} selected={tagIds.includes(tag.id)} onPress={() => toggleTag(tag.id)} />
          ))}
        </View>

        <SectionTitle>Note</SectionTitle>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="What happened today? Anything you want to remember…"
          placeholderTextColor={t.muted}
          textAlignVertical="top"
          style={[styles.note, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}
        />

        {exists && (
          <View style={{ marginTop: 24 }}>
            <Button title="Delete entry" variant="danger" onPress={remove} />
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderColor: t.border, backgroundColor: t.background }]}>
        <Button title={mood == null ? 'Pick a mood to save' : 'Save'} onPress={save} disabled={mood == null} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  date: { fontSize: 22, fontWeight: '700' },
  tagsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  note: { minHeight: 140, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, fontSize: 16, lineHeight: 22 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
