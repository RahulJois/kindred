import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import KindredNative from '../modules/kindred-native';
import { getSetting, setSetting } from './db';
import { DEFAULT_PALETTE, PALETTES, type PaletteId } from './faces';

type PaletteContextValue = { palette: PaletteId; setPalette: (id: PaletteId) => void };

const PaletteContext = createContext<PaletteContextValue>({ palette: DEFAULT_PALETTE, setPalette: () => {} });

const isPalette = (id: string | null): id is PaletteId => id != null && id in PALETTES;

/** The mood color scheme picked in Settings, kept in SQLite and mirrored to the widget and notification. */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [palette, setState] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    getSetting(db, 'palette')
      .then((stored) => {
        const id = isPalette(stored) ? stored : DEFAULT_PALETTE;
        setState(id);
        // Re-sent on every launch so the native side can't drift from what the app shows.
        KindredNative?.setPalette(id);
      })
      .catch(console.warn);
  }, [db]);

  const setPalette = useCallback(
    (id: PaletteId) => {
      setState(id);
      KindredNative?.setPalette(id);
      setSetting(db, 'palette', id).catch(console.warn);
    },
    [db]
  );

  return <PaletteContext.Provider value={{ palette, setPalette }}>{children}</PaletteContext.Provider>;
}

export const usePalette = () => useContext(PaletteContext);
