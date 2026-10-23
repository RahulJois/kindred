import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KindredNative, { type ReminderSettings } from '../../../modules/kindred-native';
import { MoodFace } from '../../components/MoodFace';
import { Card, SectionTitle, StatusBarBackdrop } from '../../components/ui';
import { requestNotificationPermission } from '../../data';
import { formatTime } from '../../dates';
import { PALETTES, type PaletteId } from '../../faces';
import { MOODS } from '../../moods';
import { usePalette } from '../../palette';
import { useTheme } from '../../theme';

function readStatus() {
  return {
    reminder: KindredNative?.getReminder() ?? { enabled: false, hour: 21, minute: 0 },
    notifications: KindredNative?.areNotificationsEnabled() ?? false,
    exact: KindredNative?.canScheduleExactAlarms() ?? true,
  };
}

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState(readStatus);
  const reload = useCallback(() => setStatus(readStatus()), []);

  // Permissions are changed in system settings, so re-check when we come back.
  useFocusEffect(reload);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reload());
    return () => sub.remove();
  }, [reload]);

  const updateReminder = (next: ReminderSettings) => {
    KindredNative?.setReminder(next.enabled, next.hour, next.minute);
    reload();
  };

  const pickTime = () => {
    const value = new Date();
    value.setHours(status.reminder.hour, status.reminder.minute, 0, 0);
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      onValueChange: (_event, date) => updateReminder({ enabled: true, hour: date.getHours(), minute: date.getMinutes() }),
    });
  };

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    // Once denied twice, Android stops showing the prompt; send them to settings instead.
    if (!granted) KindredNative?.openNotificationSettings();
    reload();
  };

  const addWidget = () => {
    const ok = KindredNative?.requestPinWidget() ?? false;
    if (!ok) {
      Alert.alert('Add the widget', 'Long-press an empty spot on your home screen, tap Widgets, and choose Kindred.');
    }
  };

  const { reminder } = status;

  return (
    <>
      <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: t.text }]}>Settings</Text>

        <SectionTitle>Daily check-in</SectionTitle>
        <Card style={styles.group}>
          <Row label="Remind me every day" icon="notifications-outline">
            <Switch
              value={reminder.enabled}
              onValueChange={(enabled) => updateReminder({ ...reminder, enabled })}
              trackColor={{ true: t.accent + '77', false: t.border }}
              thumbColor={reminder.enabled ? t.accent : t.card}
            />
          </Row>
          <Row label="Time" icon="time-outline" onPress={pickTime} disabled={!reminder.enabled}>
            <Text style={{ color: reminder.enabled ? t.accent : t.muted, fontWeight: '600' }}>
              {formatTime(reminder.hour, reminder.minute)}
            </Text>
          </Row>
          <Row label="Send a check-in now" icon="paper-plane-outline" onPress={() => KindredNative?.showCheckInNow()} last />
        </Card>

        {(!status.notifications || !status.exact) && (
          <>
            <SectionTitle>Needs attention</SectionTitle>
            <Card style={styles.group}>
              {!status.notifications && (
                <Row label="Notifications are off" sublabel="Tap to allow the daily check-in" icon="alert-circle-outline" onPress={enableNotifications} last={status.exact} />
              )}
              {!status.exact && (
                <Row
                  label="Allow on-time reminders"
                  sublabel="Without this, Android may deliver the check-in up to an hour late"
                  icon="alarm-outline"
                  onPress={() => KindredNative?.openExactAlarmSettings()}
                  last
                />
              )}
            </Card>
          </>
        )}

        <SectionTitle>Home screen</SectionTitle>
        <Card style={styles.group}>
          <Row label="Add the mood widget" sublabel="Log with one tap from your home screen" icon="apps-outline" onPress={addWidget} last />
        </Card>

        <SectionTitle>Mood colors</SectionTitle>
        <Card style={styles.group}>
          {(Object.keys(PALETTES) as PaletteId[]).map((id, i, all) => (
            <PaletteRow key={id} id={id} last={i === all.length - 1} />
          ))}
        </Card>

        <SectionTitle>Your data</SectionTitle>
        <Card style={styles.group}>
          <Row label="Edit tags" icon="pricetags-outline" onPress={() => router.push('/tags')} />
          <Row label="Export as PDF or CSV" icon="document-text-outline" onPress={() => router.push('/export')} />
          <Row label="Import from Daylio" sublabel="Bring over your moods, activities and notes" icon="download-outline" onPress={() => router.push('/import')} last />
        </Card>

        <Text style={[styles.footer, { color: t.muted }]}>Kindred keeps everything on this phone. Nothing is uploaded.</Text>
      </ScrollView>
      <StatusBarBackdrop />
    </>
  );
}

function Row({
  label,
  sublabel,
  icon,
  onPress,
  disabled,
  last,
  children,
}: {
  label: string;
  sublabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={20} color={t.muted} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: disabled ? t.muted : t.text, fontSize: 16 }}>{label}</Text>
        {sublabel ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{sublabel}</Text> : null}
      </View>
      {children ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.muted} /> : null)}
    </Pressable>
  );
}

function PaletteRow({ id, last }: { id: PaletteId; last: boolean }) {
  const t = useTheme();
  const { palette, setPalette } = usePalette();
  const selected = palette === id;
  return (
    <Pressable
      onPress={() => setPalette(id)}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${PALETTES[id].name} colors`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{PALETTES[id].name}</Text>
        <View style={styles.swatches}>
          {MOODS.map((m) => (
            <MoodFace key={m.value} mood={m.value} size={26} palette={id} />
          ))}
        </View>
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? t.accent : t.border} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 30, fontWeight: '800' },
  group: { paddingVertical: 0, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, minHeight: 52 },
  footer: { textAlign: 'center', marginTop: 28, fontSize: 13 },
  swatches: { flexDirection: 'row', gap: 6, marginTop: 8 },
});
