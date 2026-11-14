import type { LyricLine, LyricTrack, LyricWord } from '../types';

export class LyricsError extends Error {}

const TEXT_KEYS = ['word', 'text', 'token', 'w', 'content', 'line'];
const START_KEYS = ['start', 'start_time', 'startTime', 'begin', 'from', 's', 't0', 'time'];
const END_KEYS = ['end', 'end_time', 'endTime', 'stop', 'to', 'e', 't1'];
const LINE_KEYS = ['line_index', 'lineIndex', 'line_id', 'lineId', 'line'];
const CONTAINER_KEYS = ['words', 'lines', 'segments', 'lyrics', 'data', 'items', 'result', 'transcript', 'tokens'];

interface RawItem {
  text: string;
  start: number;
  end: number | null;
  lineKey: string | null;
  confidence?: number;
  children?: RawItem[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function pickText(o: Record<string, unknown>): string | null {
  for (const k of TEXT_KEYS) if (typeof o[k] === 'string') return (o[k] as string).trim();
  return null;
}
function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(o[k]);
    if (n !== null) return n;
  }
  return null;
}
function pickLine(o: Record<string, unknown>): string | null {
  for (const k of LINE_KEYS) {
    const v = o[k];
    if (typeof v === 'number' || (typeof v === 'string' && k !== 'line' && v !== '')) return String(v);
  }
  return null;
}

function toRaw(arr: unknown[], warnings: string[]): RawItem[] {
  const out: RawItem[] = [];
  let dropped = 0;
  for (const it of arr) {
    if (!isObj(it)) { dropped++; continue; }
    const text = pickText(it);
    const start = pickNum(it, START_KEYS);
    if (start === null || start < 0) { dropped++; continue; }
    const nestedKey = ['words', 'tokens'].find((k) => Array.isArray(it[k]));
    const children = nestedKey ? toRaw(it[nestedKey] as unknown[], warnings) : undefined;
    if (!text && !(children && children.length)) { dropped++; continue; }
    out.push({
      text: text ?? children!.map((c) => c.text).join(' '),
      start,
      end: pickNum(it, END_KEYS),
      lineKey: pickLine(it),
      confidence: num(it.confidence) ?? undefined,
      children,
    });
  }
  if (dropped) warnings.push(`${dropped} malformed lyric entries were skipped.`);
  return out;
}

function findArray(root: unknown): unknown[] | null {
  if (Array.isArray(root)) return root;
  if (isObj(root)) {
    for (const k of CONTAINER_KEYS) if (Array.isArray(root[k])) return root[k] as unknown[];
    for (const k of CONTAINER_KEYS) if (isObj(root[k])) {
      const r = findArray(root[k]);
      if (r) return r;
    }
  }
  return null;
}

/** Turns an arbitrary, flat word list into cleaned, non-overlapping words. */
function cleanWords(words: RawItem[], scale: number): LyricWord[] {
  const sorted = words
    .map((w) => ({ ...w, start: w.start * scale, end: w.end === null ? null : w.end * scale }))
    .sort((a, b) => a.start - b.start);
  const out: LyricWord[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    const next = sorted[i + 1];
    let end = w.end !== null && w.end > w.start ? w.end : w.start + 0.35;
    if (next) {
      if (next.start > w.start) end = Math.min(end, next.start);
      else end = w.start + 0.02;
    }
    out.push({ text: w.text, start: w.start, end, confidence: w.confidence });
  }
  return out;
}

function buildLine(index: number, words: LyricWord[]): LyricLine {
  return {
    index,
    words,
    start: words[0].start,
    end: Math.max(...words.map((w) => w.end)),
    text: words.map((w) => w.text).join(' '),
  };
}

function finishLines(lines: LyricLine[]): LyricLine[] {
  lines.sort((a, b) => a.start - b.start);
  for (let i = 0; i < lines.length; i++) {
    lines[i].index = i;
    const next = lines[i + 1];
    if (next && lines[i].end > next.start) lines[i].end = Math.max(lines[i].start + 0.05, next.start);
  }
  return lines;
}

/**
 * Adapter for the lyric JSON. It recognises:
 *  1. Flat word list:  [{ word, start, end, line_index }]          (the supplied file)
 *  2. Nested:          { lines: [{ start, end, words: [...] }] }
 *  3. Line-level only: [{ text: "full line", start, end }]          -> precision 'line'
 * Text is never altered; only timing is sanitised.
 */
export function parseLyrics(raw: unknown): LyricTrack {
  const warnings: string[] = [];
  const arr = findArray(raw);
  if (!arr) throw new LyricsError('Unrecognised lyric JSON structure.');
  const items = toRaw(arr, warnings);
  if (!items.length) throw new LyricsError('The lyric file contains no usable entries.');

  const maxT = Math.max(...items.map((i) => Math.max(i.start, i.end ?? 0)));
  const scale = maxT > 3600 ? 0.001 : 1; // milliseconds -> seconds
  if (scale !== 1) warnings.push('Timestamps looked like milliseconds and were converted.');

  let lines: LyricLine[] = [];
  let precision: 'word' | 'line' = 'word';

  if (items.some((i) => i.children && i.children.length)) {
    // nested lines with words
    for (const it of items) {
      const kids = it.children && it.children.length ? it.children : null;
      if (kids) {
        const w = cleanWords(kids, scale);
        if (w.length) lines.push(buildLine(lines.length, w));
      } else {
        precision = 'line';
        const w = cleanWords([it], scale);
        lines.push(buildLine(lines.length, w));
      }
    }
  } else {
    const multiWord = items.filter((i) => /\s/.test(i.text)).length / items.length > 0.5;
    if (multiWord) {
      precision = 'line';
      const sorted = [...items].sort((a, b) => a.start - b.start);
      sorted.forEach((it, i) => {
        const nextStart = sorted[i + 1] ? sorted[i + 1].start * scale : it.start * scale + 4;
        const start = it.start * scale;
        const end = it.end !== null && it.end * scale > start ? Math.min(it.end * scale, nextStart) : nextStart;
        lines.push(buildLine(i, [{ text: it.text, start, end: Math.max(end, start + 0.2) }]));
      });
      warnings.push('Only line-level timestamps were found; words are not highlighted individually.');
    } else {
      const words = cleanWords(items, scale);
      const withKey = items.filter((i) => i.lineKey !== null).length / items.length >= 0.9;
      if (withKey) {
        // line key is matched by item order after sorting by start (stable, same order as `words`)
        const order = [...items].sort((a, b) => a.start - b.start);
        const groups = new Map<string, LyricWord[]>();
        order.forEach((it, i) => {
          const k = it.lineKey as string;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k)!.push(words[i]);
        });
        groups.forEach((g) => lines.push(buildLine(lines.length, g)));
      } else {
        let cur: LyricWord[] = [];
        words.forEach((w, i) => {
          if (cur.length && w.start - words[i - 1].end > 0.8) {
            lines.push(buildLine(lines.length, cur));
            cur = [];
          }
          cur.push(w);
        });
        if (cur.length) lines.push(buildLine(lines.length, cur));
        warnings.push('No line indices found; lines were grouped by pauses.');
      }
    }
  }

  lines = finishLines(lines.filter((l) => l.words.length));
  if (!lines.length) throw new LyricsError('The lyric file is empty.');
  return { lines, precision, warnings };
}
