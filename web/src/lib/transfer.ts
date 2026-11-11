// ייצוא וייבוא: JSON (נתונים) או ZIP מלא (נתונים + קבצים). תואם לפורמט של המערכת הישנה.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { supabase } from './supabase';
import { fetchRaw, STATE_KEY } from './db';
import { queryClient } from './queryClient';
import { normalizeLegacy, type ImportSummary } from './legacyImport';
import { newId } from './utils';

async function fetchExtra() {
  const [notes, automations] = await Promise.all([
    supabase.from('topic_notes').select('*'),
    supabase.from('automations').select('*'),
  ]);
  return { notes: notes.data ?? [], automations: automations.data ?? [] };
}

export async function buildExport() {
  const raw = await fetchRaw();
  const extra = await fetchExtra();
  return {
    format: 'tasks-personal/v2',
    exported_at: new Date().toISOString(),
    workspaces: raw.workspaces,
    topics: raw.topics,
    groups: raw.groups,
    tasks: raw.tasks,
    labels: raw.labels,
    task_labels: raw.taskLabels,
    checklist_items: raw.checklist,
    time_entries: raw.timeEntries,
    task_dependencies: raw.deps,
    sprints: raw.sprints,
    goals: raw.goals,
    habits: raw.habits,
    habit_logs: raw.habitLogs,
    templates: raw.templates,
    views: raw.views,
    notes: extra.notes,
    automations: extra.automations,
    documents: raw.documents.map((d) => ({ ...d, stored_name: d.storage_path.split('/').pop() })),
  };
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export async function exportJson() {
  const data = await buildExport();
  download(`tasks-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export async function exportZip(onProgress?: (msg: string) => void) {
  const data = await buildExport();
  const files: Record<string, Uint8Array> = { 'data.json': strToU8(JSON.stringify(data, null, 2)) };
  let i = 0;
  for (const d of data.documents) {
    onProgress?.(`מוריד קבצים ${++i}/${data.documents.length}`);
    const { data: blob } = await supabase.storage.from('documents').download(d.storage_path);
    if (blob) files[`documents/${d.stored_name}`] = new Uint8Array(await blob.arrayBuffer());
  }
  files['documents.json'] = strToU8(JSON.stringify(data.documents));
  download(`tasks-full-${stamp()}.zip`, zipSync(files, { level: 6 }) as BlobPart, 'application/zip');
}

export interface PreparedImport { summary: ImportSummary; files: Record<string, Uint8Array> }

const SAFE_NAME = /^[a-zA-Z0-9]{8,40}(\.[A-Za-z0-9]{1,9})?$/;

export async function prepareImport(file: File): Promise<PreparedImport> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) return { summary: normalizeLegacy(JSON.parse(new TextDecoder().decode(buf))), files: {} };
  const entries = unzipSync(buf);
  const dataFile = entries['data.json'];
  if (!dataFile) throw new Error('ה-ZIP לא מכיל data.json');
  const docsJson = entries['documents.json'] ? JSON.parse(strFromU8(entries['documents.json'])) : undefined;
  const files: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(entries)) {
    if (!name.startsWith('documents/')) continue;
    const base = name.slice('documents/'.length);
    if (SAFE_NAME.test(base)) files[base] = content; // מונע path traversal
  }
  return { summary: normalizeLegacy(JSON.parse(strFromU8(dataFile)), docsJson), files };
}

export async function runImport(prep: PreparedImport, workspaceId: string, replace: boolean, onProgress?: (msg: string) => void) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error('לא מחובר');
  const docs: Record<string, unknown>[] = [];
  let i = 0;
  for (const d of prep.summary.legacyDocuments) {
    const content = prep.files[d.stored_name];
    if (!content) continue;
    onProgress?.(`מעלה קבצים ${++i}/${prep.summary.legacyDocuments.length}`);
    const ext = d.stored_name.match(/\.[A-Za-z0-9]{1,9}$/)?.[0] ?? '';
    const path = `${uid}/${newId()}${ext}`;
    const { error } = await supabase.storage.from('documents').upload(path, new Blob([content as BlobPart], { type: d.mime_type }), { contentType: d.mime_type });
    if (error) continue;
    docs.push({ id: d.id, topic_id: d.topic_id, task_id: d.task_id, filename: d.filename, storage_path: path, mime_type: d.mime_type, size: content.length, uploaded_at: d.uploaded_at });
  }
  onProgress?.('שומר נתונים…');
  const { data, error } = await supabase.rpc('import_data', { p: { ...prep.summary.data, documents: docs }, p_workspace: workspaceId, p_replace: replace });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: STATE_KEY });
  return data as { tasks: number };
}
