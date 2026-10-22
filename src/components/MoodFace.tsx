import { useColorScheme } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FACE_CIRCLE, FACE_STROKE_WIDTH, FACES } from '../faces';

type Props = {
  mood: number;
  size?: number;
  /** Features only, for drawing on a surface already filled with the mood color (calendar cells). */
  bare?: boolean;
};

export function MoodFace({ mood, size = 28, bare }: Props) {
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const face = FACES[Math.min(5, Math.max(1, Math.round(mood)))];
  const ink = face.ink[theme];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={face.label}>
      {!bare && (
        <Path d={FACE_CIRCLE} fill={face.fill[theme]} stroke="#000" strokeOpacity={0.14} strokeWidth={0.8} />
      )}
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
