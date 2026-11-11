import { useState } from 'react';
import { Download, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, File as FileIcon, Link2, MoreVertical, Presentation, Trash2, Upload } from 'lucide-react';
import type { DocumentRow } from '@/types';
import { useData } from '@/lib/state';
import { deleteRow, updateRow } from '@/lib/actions';
import { docKind, removeFile, signedUrl, uploadDocument } from '@/lib/storage';
import { formatBytes } from '@/lib/utils';
import { timeAgo } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownSub, DropdownSubContent, DropdownSubTrigger, DropdownTrigger } from '@/components/ui/menu';
import { Dialog, DialogBody, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { EmptyState, ProgressBar } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';
import { toast } from 'sonner';
import { useEffect } from 'react';

const KIND_ICON = { image: FileImage, pdf: FileText, excel: FileSpreadsheet, ppt: Presentation, word: FileText, zip: FileArchive, file: FileIcon };

export function useUploader(topicId: string | null, taskId: string | null = null) {
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const upload = async (files: File[]) => {
    for (const f of files) {
      setUploads((u) => [...u, { name: f.name, pct: 0 }]);
      try {
        await uploadDocument(f, topicId, taskId, (pct) => setUploads((u) => u.map((x) => (x.name === f.name ? { ...x, pct } : x))));
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploads((u) => u.filter((x) => x.name !== f.name));
      }
    }
  };
  return { uploads, upload };
}

export function TopicDocuments({ topicId, uploader }: { topicId: string; uploader: ReturnType<typeof useUploader> }) {
  const { documents, tasks } = useData();
  const docs = documents.filter((d) => d.topic_id === topicId).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  const [preview, setPreview] = useState<DocumentRow | null>(null);
  const topicTasks = tasks.filter((t) => t.topic_id === topicId && t.status !== 'done').slice(0, 30);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded bg-primary px-3.5 text-sm font-medium text-white hover:bg-primary-hover">
          <Upload className="h-4 w-4" />העלאת קבצים
          <input type="file" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void uploader.upload(f); }} />
        </label>
        <span className="hidden text-sm text-subtle sm:inline">או גרור קבצים לכל מקום בעמוד</span>
      </div>
      {uploader.uploads.map((u) => (
        <div key={u.name} className="card flex items-center gap-3 p-3 text-sm"><span className="flex-1 truncate">{u.name}</span><ProgressBar value={u.pct} className="w-32" /><span className="w-10 tabular text-subtle">{u.pct}%</span></div>
      ))}
      {!docs.length && !uploader.uploads.length ? (
        <EmptyState icon={<FileIcon />} title="אין מסמכים" description="העלה קבצים — תמונות, PDF, Office ועוד. הם נשמרים בענן הפרטי שלך." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {docs.map((d) => {
            const k = docKind(d.mime_type, d.filename);
            const Icon = KIND_ICON[k.kind as keyof typeof KIND_ICON];
            const linked = d.task_id ? tasks.find((t) => t.id === d.task_id) : undefined;
            return (
              <div key={d.id} className="card group overflow-hidden">
                <button onClick={() => setPreview(d)} className="relative flex h-28 w-full items-center justify-center" style={{ background: `color-mix(in srgb, ${k.color} 14%, var(--surface-2))` }}>
                  {k.kind === 'image' ? <Thumb path={d.storage_path} /> : <Icon className="h-10 w-10" style={{ color: k.color }} />}
                </button>
                <div className="flex items-start gap-1 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" title={d.filename}>{d.filename}</div>
                    <div className="text-xs text-subtle">{formatBytes(d.size)} · {timeAgo(d.uploaded_at)}</div>
                    {linked && <div className="mt-0.5 truncate text-xs text-primary">🔗 {linked.title}</div>}
                  </div>
                  <DropdownMenu>
                    <DropdownTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="אפשרויות"><MoreVertical className="h-4 w-4" /></Button></DropdownTrigger>
                    <DropdownContent>
                      {(k.kind === 'image' || k.kind === 'pdf') && <DropdownItem icon={<Eye />} onSelect={() => setPreview(d)}>תצוגה מקדימה</DropdownItem>}
                      <DropdownItem icon={<Download />} onSelect={async () => window.open(await signedUrl(d.storage_path, d.filename), '_blank')}>הורדה</DropdownItem>
                      <DropdownSub>
                        <DropdownSubTrigger icon={<Link2 />}>קישור למשימה</DropdownSubTrigger>
                        <DropdownSubContent>
                          <DropdownItem onSelect={() => updateRow('documents', d.id, { task_id: null })}>ללא</DropdownItem>
                          {topicTasks.map((t) => <DropdownItem key={t.id} onSelect={() => updateRow('documents', d.id, { task_id: t.id })}><span className="max-w-[200px] truncate">{t.title}</span></DropdownItem>)}
                        </DropdownSubContent>
                      </DropdownSub>
                      <DropdownSeparator />
                      <DropdownItem icon={<Trash2 />} danger onSelect={async () => {
                        if (await confirmDialog({ title: `למחוק את "${d.filename}"?`, confirmLabel: 'מחיקה', danger: true })) { deleteRow('documents', d.id); void removeFile(d.storage_path); }
                      }}>מחיקה</DropdownItem>
                    </DropdownContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogModalContent size="lg">
          {preview && <>
            <DialogHeader title={preview.filename} />
            <DialogBody><PreviewBody doc={preview} /></DialogBody>
          </>}
        </DialogModalContent>
      </Dialog>
    </div>
  );
}

function useSigned(path: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { let c = false; signedUrl(path).then((u) => !c && setUrl(u)).catch(() => {}); return () => { c = true; }; }, [path]);
  return url;
}
function Thumb({ path }: { path: string }) {
  const url = useSigned(path);
  return url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : null;
}
function PreviewBody({ doc }: { doc: DocumentRow }) {
  const url = useSigned(doc.storage_path);
  const k = docKind(doc.mime_type, doc.filename).kind;
  if (!url) return <div className="h-64 animate-pulse rounded bg-surface-2" />;
  if (k === 'image') return <img src={url} alt={doc.filename} className="mx-auto max-h-[70vh] rounded" />;
  if (k === 'pdf') return <iframe src={url} title={doc.filename} className="h-[70vh] w-full rounded border border-border" />;
  return <div className="py-10 text-center"><Button variant="primary" onClick={() => window.open(url, '_blank')} iconStart={<Download className="h-4 w-4" />}>הורדה</Button></div>;
}
