import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { kindColors, useTheme } from './theme';
import { Kind } from './types';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }): React.ReactElement {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 14 }, style]}>
      {children}
    </View>
  );
}

export function H2({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useTheme();
  return <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{children}</Text>;
}

/**
 * 설명 글 표시 스위치. false이면 설정 탭과 처음 설정 화면 말고는 설명 글을 숨깁니다.
 * 나중에 설명을 다시 보이게 하려면 true로 바꾸면 됩니다. (오류·상태 메시지는 이와 상관없이 항상 보입니다.)
 */
export const HELP_ON = false;
const HelpCtx = React.createContext(false);
/** 이 안에서는 설명 글을 항상 보여 줍니다. (설정 탭, 처음 설정) */
export function HelpScope({ children }: { children: React.ReactNode }): React.ReactElement {
  return <HelpCtx.Provider value={true}>{children}</HelpCtx.Provider>;
}
/** 설명 글 묶음: 설명 표시가 꺼져 있으면 아무것도 그리지 않습니다. */
export function Help({ children }: { children: React.ReactNode }): React.ReactElement | null {
  const on = React.useContext(HelpCtx);
  return HELP_ON || on ? <>{children}</> : null;
}

/** 안내 글. 오류(bad)나 상태(keep)가 아니면 설명으로 보고 설명 표시가 꺼졌을 때 숨깁니다. */
export function Hint({ children, bad, keep }: { children: React.ReactNode; bad?: boolean; keep?: boolean }): React.ReactElement | null {
  const t = useTheme();
  const on = React.useContext(HelpCtx);
  if (!HELP_ON && !on && !bad && !keep) return null;
  return <Text style={{ color: bad ? t.bad : t.ink2, fontSize: 12.5, lineHeight: 18 }}>{children}</Text>;
}

export function Btn(props: {
  label: string; onPress: () => void; ghost?: boolean; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const t = useTheme();
  const { label, onPress, ghost, small, disabled, style } = props;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[{
        paddingVertical: small ? 7 : 11, paddingHorizontal: small ? 12 : 16, borderRadius: 8, borderWidth: 1,
        borderColor: ghost ? t.line : t.accent, backgroundColor: ghost ? 'transparent' : t.accent,
        opacity: disabled ? 0.45 : 1, alignItems: 'center',
      }, style]}
    >
      <Text style={{ color: ghost ? t.ink : t.onAccent, fontWeight: ghost ? '500' : '700', fontSize: small ? 13 : 14 }}>{label}</Text>
    </Pressable>
  );
}

export function SegRow<T extends string | number>(props: {
  options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean;
}): React.ReactElement {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {props.options.map((o) => {
        const on = o.v === props.value;
        return (
          <Pressable
            key={String(o.v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: !!props.disabled }}
            disabled={props.disabled}
            onPress={() => props.onChange(o.v)}
            style={{
              flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1,
              borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.surface,
              opacity: props.disabled ? 0.5 : 1,
            }}
          >
            <Text style={{ color: on ? t.onAccent : t.ink, fontWeight: '500', fontSize: 14, textAlign: 'center' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }): React.ReactElement {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
        borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.surface,
      }}
    >
      <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ kind, text }: { kind: Kind; text: string }): React.ReactElement {
  const t = useTheme();
  const c = kindColors(t, kind);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
