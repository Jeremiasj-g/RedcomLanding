'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, PlayCircle } from 'lucide-react';
import type { FocoAsset } from './types';

function iconByKind(kind: FocoAsset['kind']) {
  if (kind === 'image') return <ImageIcon className="h-4 w-4" />;
  if (kind === 'pdf') return <FileText className="h-4 w-4" />;
  return <PlayCircle className="h-4 w-4" />;
}

function labelByKind(kind: FocoAsset['kind']) {
  if (kind === 'image') return 'Imagen';
  if (kind === 'pdf') return 'PDF';
  return 'Video';
}

export function FocoAttachments({ assets }: { assets: FocoAsset[] }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<FocoAsset | null>(null);

  if (!assets?.length) return null;

  const openPreview = (a: FocoAsset) => {
    setActive(a);
    setOpen(true);
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {assets.slice(0, 6).map((a) => (
          <Button
            key={a.id}
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => openPreview(a)}
          >
            {iconByKind(a.kind)}
            <span className="max-w-[220px] truncate">{a.label || labelByKind(a.kind)}</span>
            <Badge variant="outline" className="ml-1">
              {labelByKind(a.kind)}
            </Badge>
          </Button>
        ))}

        {assets.length > 6 && (
          <Badge variant="outline" className="self-center">
            +{assets.length - 6} más
          </Badge>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {active ? iconByKind(active.kind) : null}
              {active?.label || (active ? labelByKind(active.kind) : 'Adjunto')}
            </DialogTitle>
          </DialogHeader>

          {!active ? null : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a href={active.url} target="_blank" rel="noreferrer">
                    Abrir en nueva pestaña
                  </a>
                </Button>
                <Button asChild>
                  <a href={active.url} download>
                    Descargar
                  </a>
                </Button>
              </div>

              {active.kind === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.url}
                  alt={active.label || 'Imagen'}
                  className="w-full rounded-xl border object-contain"
                />
              )}

              {active.kind === 'pdf' && (
                <iframe
                  title="PDF"
                  src={active.url}
                  className="h-[70vh] w-full rounded-xl border"
                />
              )}

              {active.kind === 'video' && (
                <div className="rounded-xl border p-3">
                  <p className="text-sm text-muted-foreground">
                    Si es un link externo (Drive/YouTube), se abre en nueva pestaña. Si es un mp4 directo,
                    puede embebirse.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button asChild>
                      <a href={active.url} target="_blank" rel="noreferrer">
                        Ver video
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
