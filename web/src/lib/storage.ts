import { supabase, SUPABASE_URL } from './supabase';
import { insertRow } from './actions';
import { newId } from './utils';

export const MAX_UPLOAD_MB = 50;

export function sanitizeFilename(name: string): string {
  return name.replace(/[\/\\\u0000-\u001f]/g, '_').replace(/\.\.+/g, '.').trim().slice(0, 200) || 'file';
}

/** העלאה עם פס התקדמות (XHR ישירות ל-Storage REST) */
export async function uploadDocument(
  file: File, topicId: string | null, taskId: string | null, onProgress?: (pct: number) => void,
): Promise<string> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`הקובץ גדול מ-${MAX_UPLOAD_MB}MB`);
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error('לא מחובר');
  const id = newId();
  const ext = (file.name.match(/\.[A-Za-z0-9]{1,9}$/)?.[0] ?? '').toLowerCase();
  const path = `${session.user.id}/${id}${ext}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/documents/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`העלאה נכשלה (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('העלאה נכשלה — בדוק חיבור'));
    xhr.send(file);
  });
  insertRow('documents', {
    id, topic_id: topicId, task_id: taskId, filename: sanitizeFilename(file.name), storage_path: path,
    mime_type: file.type || 'application/octet-stream', size: file.size,
  }, {});
  return id;
}

export async function signedUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300, download ? { download } : undefined);
  if (error || !data) throw error ?? new Error('שגיאה');
  return data.signedUrl;
}

export async function removeFile(path: string) {
  await supabase.storage.from('documents').remove([path]);
}

export function docKind(mime: string, name: string): { kind: string; color: string } {
  const n = name.toLowerCase();
  if (mime.startsWith('image/')) return { kind: 'image', color: '#579BFC' };
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return { kind: 'pdf', color: '#E2445C' };
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx?|csv)$/.test(n)) return { kind: 'excel', color: '#00A86B' };
  if (/presentation|powerpoint/.test(mime) || /\.pptx?$/.test(n)) return { kind: 'ppt', color: '#FF7A3D' };
  if (/word|document/.test(mime) || /\.docx?$/.test(n)) return { kind: 'word', color: '#3B6FE0' };
  if (/zip|compressed/.test(mime) || /\.(zip|rar|7z)$/.test(n)) return { kind: 'zip', color: '#E8B400' };
  return { kind: 'file', color: '#9D99B9' };
}
