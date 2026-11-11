import { HebrewCalendar, Location, flags, type Event as HEvent } from '@hebcal/core';
import type { Settings } from '@/types';
import { isoDate, parseDate } from './dates';

export interface DayInfo { holidays: string[]; candles?: string; havdalah?: string; isYomTov: boolean }

export const CITIES: { name: string; lat: number; lon: number; candles: number }[] = [
  { name: 'חיפה', lat: 32.794, lon: 34.9896, candles: 30 },
  { name: 'ירושלים', lat: 31.7683, lon: 35.2137, candles: 40 },
  { name: 'תל אביב', lat: 32.0853, lon: 34.7818, candles: 18 },
  { name: 'באר שבע', lat: 31.252, lon: 34.7915, candles: 18 },
  { name: 'צפת', lat: 32.9646, lon: 35.496, candles: 18 },
  { name: 'אילת', lat: 29.5577, lon: 34.9519, candles: 18 },
  { name: 'נתניה', lat: 32.3215, lon: 34.8532, candles: 18 },
  { name: 'מודיעין', lat: 31.8969, lon: 35.0095, candles: 18 },
];

const SKIP = (flags.DAF_YOMI ?? 0) | (flags.OMER_COUNT ?? 0) | (flags.PARSHA_HASHAVUA ?? 0) |
  (flags.MOLAD ?? 0) | (flags.SHABBAT_MEVARCHIM ?? 0) | ((flags as Record<string, number>).YERUSHALMI_YOMI ?? 0) |
  ((flags as Record<string, number>).MISHNA_YOMI ?? 0) | ((flags as Record<string, number>).NACH_YOMI ?? 0);
const stripNikud = (s: string) => s.replace(/[֑-ׇ]/g, '');
const cache = new Map<string, Map<string, DayInfo>>();

function fmtTime(d: Date | undefined): string | undefined {
  if (!d) return undefined;
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}

export function getDayInfos(from: string, to: string, s: Settings = {}): Map<string, DayInfo> {
  const key = `${from}|${to}|${s.shabbat_lat}|${s.shabbat_lon}|${s.shabbat_candle_minutes}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Map<string, DayInfo>();
  try {
    const loc = new Location(s.shabbat_lat ?? 32.794, s.shabbat_lon ?? 34.9896, true, 'Asia/Jerusalem', s.shabbat_city ?? 'חיפה', 'IL');
    const events: HEvent[] = HebrewCalendar.calendar({
      start: parseDate(from), end: parseDate(to), il: true, candlelighting: true, location: loc,
      candleLightingMins: s.shabbat_candle_minutes ?? 30, sedrot: false, omer: false, noModern: false,
    });
    for (const ev of events) {
      const f = ev.getFlags();
      if (f & SKIP) continue;
      const d = isoDate(ev.getDate().greg());
      const info = out.get(d) ?? { holidays: [], isYomTov: false };
      const desc = ev.getDesc();
      const time = (ev as unknown as { eventTime?: Date }).eventTime;
      // ביטי הדלקת נרות והבדלה חופפים — מזהים לפי התיאור
      if (desc.startsWith('Candle lighting')) info.candles = fmtTime(time);
      else if (desc.startsWith('Havdalah')) info.havdalah = fmtTime(time);
      else {
        const name = stripNikud(ev.render('he')).replace(/\s*\d{1,2}:\d{2}\s*$/, '');
        if (name && !info.holidays.includes(name)) info.holidays.push(name);
        if (f & (flags.CHAG ?? 0)) info.isYomTov = true;
      }
      out.set(d, info);
    }
  } catch (e) {
    console.warn('hebcal failed', e);
  }
  cache.set(key, out);
  return out;
}

export const isShabbat = (d: string) => parseDate(d).getDay() === 6;
