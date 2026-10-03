import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useTheme } from '../../theme';

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: ColorValue; size: number }) {
  return <Ionicons name={name} size={size} color={color as string} />;
}

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  function Icon({ color, size }: { color: ColorValue; size: number }) {
    return <TabIcon name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Journal', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('analytics-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
