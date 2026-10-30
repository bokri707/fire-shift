import { useColorScheme } from 'react-native';
import { Kind } from './types';

export interface Theme {
  dark: boolean;
  bg: string; surface: string; ink: string; ink2: string; line: string;
  accent: string; onAccent: string; meet: string; onMeet: string;
  duty: string; onDuty: string; dutySoft: string;
  off: string; offSoft: string;
  leave: string; leaveSoft: string;
  edu: string; eduSoft: string;
  swap: string; swapSoft: string;
  sun: string; sat: string; hol: string; bad: string;
}

const light: Theme = {
  dark: false,
  bg: '#EDF0F3', surface: '#FFFFFF', ink: '#14202B', ink2: '#566470', line: '#D6DCE2',
  accent: '#1E4B6B', onAccent: '#FFFFFF', meet: '#E65100', onMeet: '#FFFFFF',
  duty: '#C0341D', onDuty: '#FFFFFF', dutySoft: '#FBE4DD',
  off: '#3C5669', offSoft: '#E4EAF0',
  leave: '#266B4D', leaveSoft: '#DCEFE6',
  edu: '#2D62AE', eduSoft: '#DEE8F7',
  swap: '#85550B', swapSoft: '#F8EACB',
  sun: '#D32F2F', sat: '#2D62AE', hol: '#D32F2F', bad: '#C62828',
};

const dark: Theme = {
  dark: true,
  bg: '#0F161C', surface: '#17212A', ink: '#E7ECF0', ink2: '#9BA9B4', line: '#2A3743',
  accent: '#8CC0E6', onAccent: '#0B1820', meet: '#FF9800', onMeet: '#1A0F00',
  duty: '#FF7A5C', onDuty: '#2A0E06', dutySoft: '#3B1F18',
  off: '#9FBBCF', offSoft: '#1E2C37',
  leave: '#68CFA3', leaveSoft: '#16302A',
  edu: '#86AEEB', eduSoft: '#1B2A42',
  swap: '#E9B957', swapSoft: '#3A2F14',
  sun: '#FF7B72', sat: '#8FB2EA', hol: '#D64545', bad: '#FF8A80',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function kindColors(t: Theme, k: Kind): { fg: string; bg: string } {
  switch (k) {
    case 'duty': return { fg: t.duty, bg: t.dutySoft };
    case 'off': return { fg: t.off, bg: t.offSoft };
    case 'leave': return { fg: t.leave, bg: t.leaveSoft };
    case 'edu': return { fg: t.edu, bg: t.eduSoft };
    default: return { fg: t.swap, bg: t.swapSoft };
  }
}
