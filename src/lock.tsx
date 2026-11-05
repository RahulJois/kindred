import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, BackHandler, StyleSheet, Text, View } from 'react-native';

import KindredNative from '../modules/kindred-native';
import { Button } from './components/ui';
import { getSetting, setSetting } from './db';
import { useTheme } from './theme';

/** Leaving the app for less than this (a file picker, a share sheet, a quick app switch) doesn't relock it. */
const GRACE_MS = 30_000;

type LockContextValue = { enabled: boolean; setEnabled: (enabled: boolean) => Promise<void> };

const LockContext = createContext<LockContextValue>({ enabled: false, setEnabled: async () => {} });

export const useAppLock = () => useContext(LockContext);

/**
 * Uses the phone's own screen lock (fingerprint, face, PIN, pattern), so there's no
 * separate Kindred PIN to forget. Returns true if the person got through.
 */
async function authenticate(promptMessage: string) {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
  if (result.success) return true;
  // If the phone's screen lock was removed after the app lock was turned on, there's nothing to
  // check against. Let them in rather than locking them out of their journal for good.
  if (result.error === 'not_enrolled' || result.error === 'passcode_not_set' || result.error === 'not_available') {
    return (await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE;
  }
  return false;
}

export function LockProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(true);
  const authenticating = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      if (await authenticate('Unlock Kindred')) setLocked(false);
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    getSetting(db, 'app_lock').then((v) => {
      const on = v === '1';
      setEnabledState(on);
      setLocked(on);
      if (on) unlock();
    }, console.warn);
  }, [db, unlock]);

  useEffect(() => {
    if (enabled == null) return;
    KindredNative?.setHideInRecents(enabled);
    const sub = AppState.addEventListener('change', (state) => {
      // The fingerprint and PIN screens briefly take the app out of the foreground; ignore that.
      if (!enabled || authenticating.current) return;
      if (state === 'background') backgroundedAt.current = Date.now();
      else if (state === 'active') {
        KindredNative?.setHideInRecents(true);
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (away != null && Date.now() - away >= GRACE_MS) {
          setLocked(true);
          unlock();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next && (await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) {
        Alert.alert('Set up a screen lock first', 'Kindred uses your phone’s fingerprint, face unlock or PIN. Add one in Android settings, then try again.');
        return;
      }
      authenticating.current = true;
      try {
        if (!(await authenticate(next ? 'Turn on app lock' : 'Turn off app lock'))) return;
      } finally {
        authenticating.current = false;
      }
      await setSetting(db, 'app_lock', next ? '1' : '0');
      setEnabledState(next);
      setLocked(false);
    },
    [db]
  );

  const showLock = !!enabled && locked;
  const covered = enabled == null || showLock;

  // Back on the lock screen would otherwise navigate the hidden screens behind it.
  useEffect(() => {
    if (!showLock) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, [showLock]);

  return (
    <LockContext.Provider value={{ enabled: !!enabled, setEnabled }}>
      {/* Keep screen readers from reading the journal through the cover. */}
      <View style={{ flex: 1 }} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {covered && <LockScreen ready={showLock} onUnlock={unlock} />}
    </LockContext.Provider>
  );
}

function LockScreen({ ready, onUnlock }: { ready: boolean; onUnlock: () => void }) {
  const t = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: t.background }]}>
      {ready && (
        <>
          <Ionicons name="lock-closed-outline" size={40} color={t.muted} />
          <Text style={[styles.title, { color: t.text }]}>Kindred is locked</Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Button title="Unlock" onPress={onUnlock} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  title: { fontSize: 18, fontWeight: '700' },
});
