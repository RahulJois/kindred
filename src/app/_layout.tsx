import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataProvider } from '../data';
import { formatShort } from '../dates';
import { migrate } from '../db';
import { LockProvider } from '../lock';
import { PaletteProvider } from '../palette';
import { useTheme } from '../theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: t.accent, background: t.background, card: t.card, text: t.text, border: t.border },
  };

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="kindred.db" onInit={migrate}>
        <ThemeProvider value={navTheme}>
          <DataProvider>
            <PaletteProvider>
              <LockProvider>
              <Stack screenOptions={{ headerShadowVisible: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                {/* Title is set here, not from inside the screen: updating header options while the
                    screen is being popped crashes react-native-screens. */}
                <Stack.Screen
                  name="day/[date]"
                  options={({ route }) => ({ title: formatShort((route.params as { date: string }).date) })}
                />
                <Stack.Screen name="tags" options={{ title: 'Tags' }} />
                <Stack.Screen name="export" options={{ title: 'Export' }} />
                <Stack.Screen name="import" options={{ title: 'Import from Daylio' }} />
                <Stack.Screen name="search" options={{ title: 'Search' }} />
              </Stack>
              </LockProvider>
            </PaletteProvider>
          </DataProvider>
        </ThemeProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
