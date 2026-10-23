import { useColorScheme } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FACE_CIRCLE, FACE_STROKE_WIDTH, FACES, type PaletteId } from '../faces';
import { faceColors, useFaceColors } from '../moods';

type Props = {
  mood: number;
  size?: number;
  /** Features only, for drawing on a surface already filled with the mood color (calendar cells). */
  bare?: boolean;
  /** Draw in this palette instead of the user's (palette previews in Settings). */
  palette?: PaletteId;
};

export function MoodFace({ mood, size = 28, bare, palette }: Props) {
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const userColors = useFaceColors();
  const face = FACES[Math.min(5, Math.max(1, Math.round(mood)))];
  const preview = palette ? faceColors(palette, mood) : null;
  const { fill, ink } = preview ? { fill: preview.fill[theme], ink: preview.ink[theme] } : userColors(mood);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={face.label}>
      {!bare && <Path d={FACE_CIRCLE} fill={fill} stroke="#000" strokeOpacity={0.14} strokeWidth={0.8} />}
      {face.features.map((f, i) =>
        f.kind === 'fill' ? (
          <Path key={i} d={f.d} fill={ink} />
        ) : (
          <Path
            key={i}
            d={f.d}
            fill="none"
            stroke={ink}
            strokeWidth={FACE_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </Svg>
  );
}
