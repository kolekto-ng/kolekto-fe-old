import React, { useRef, useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import FundraisingShareCanvas, { FundraisingShareCanvasProps } from './FundraisingShareCanvas';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FundraisingShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: {
    title: string;
    banner_url?: string | null;
    target_amount?: number | null;
    deadline?: string | null;
  };
  totalRaised: number;
  donorCount: number;
  shareUrl: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const FundraisingShareDialog: React.FC<FundraisingShareDialogProps> = ({
  open,
  onOpenChange,
  collection,
  totalRaised,
  donorCount,
  shareUrl,
}) => {
  // captureRef points to the SAME canvas that is shown in the preview.
  // html2canvas captures that element at its native 1080×1080 size,
  // regardless of the CSS scale applied to its parent wrapper.
  const captureRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.433);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setPreviewScale(entry.contentRect.width / 1080);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canvasProps: FundraisingShareCanvasProps = {
    title: collection.title,
    bannerUrl: collection.banner_url,
    targetAmount: collection.target_amount,
    totalRaised,
    donorCount,
    shareUrl,
    deadline: collection.deadline,
  };

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = async (format: 'png' | 'jpeg') => {
    if (!captureRef.current) return;
    setIsGenerating(true);

    try {
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(captureRef.current, {
        width: 1080,
        height: 1080,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0C3318',
        logging: false,
        imageTimeout: 20000,
        // onclone runs on the cloned document before rendering.
        // We strip transforms and overflow:hidden from every ancestor so
        // html2canvas sees the full 1080×1080 element exactly as designed.
        onclone: (doc: Document) => {
          const el = doc.querySelector('[data-flyer-canvas]') as HTMLElement | null;
          if (!el) return;
          // Fix the canvas itself
          el.style.position = 'fixed';
          el.style.top = '0';
          el.style.left = '0';
          el.style.width = '1080px';
          el.style.height = '1080px';
          el.style.transform = 'none';
          el.style.visibility = 'visible';
          el.style.overflow = 'hidden';
          // Clear overflow + transforms on every ancestor so nothing clips it
          let parent = el.parentElement;
          while (parent && parent !== doc.body) {
            parent.style.overflow = 'visible';
            parent.style.transform = 'none';
            parent.style.position = 'static';
            parent = parent.parentElement;
          }
        },
      } as any);

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'jpeg' ? 0.95 : undefined;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => { if (b) resolve(b); else reject(new Error('Blob creation failed')); },
          mimeType,
          quality,
        );
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collection.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-flyer.${format === 'jpeg' ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Flyer downloaded as ${format === 'jpeg' ? 'JPG' : 'PNG'}`, {
        description: '1080 × 1080 px · Ready to share on social media',
      });
    } catch (err) {
      console.error('Flyer generation error:', err);
      toast.error('Failed to generate image', {
        description: 'Please try again or check your internet connection.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] w-full p-6">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            Campaign Flyer
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1">
            Download a branded 1080 × 1080 image to share on social media and drive more donations.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">

          {/* ── Preview ─────────────────────────────────────────────────
              The FundraisingShareCanvas is rendered at its true 1080×1080
              size inside this wrapper. The wrapper clips it visually to a
              square at dialog width. css transform-origin = top left so
              it scales from the top-left corner perfectly.

              captureRef is on the ACTUAL canvas element — not a clone —
              so "what you see here = what you download".
          ────────────────────────────────────────────────────────────── */}
          <div
            ref={previewContainerRef}
            className="rounded-2xl border border-gray-200 shadow-sm"
            style={{
              width: '100%',
              paddingTop: '100%',
              position: 'relative',
              overflow: 'hidden',
              background: '#0C3318',
            }}
          >
            {/* Absolutely-fill layer that holds the scaled canvas */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              overflow: 'hidden',
            }}>
              <div style={{
                width: 1080,
                height: 1080,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}>
                <FundraisingShareCanvas ref={captureRef} {...canvasProps} />
              </div>
            </div>
          </div>

          {/* ── Meta strip ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between text-xs text-gray-400 px-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              1080 × 1080 px · High resolution
            </span>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-green-700 hover:underline"
            >
              View campaign <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* ── Download buttons ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="bg-green-700 hover:bg-green-800 text-white font-semibold h-11"
              onClick={() => handleDownload('png')}
              disabled={isGenerating}
            >
              {isGenerating
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              Download PNG
            </Button>
            <Button
              variant="outline"
              className="border-green-700 text-green-700 hover:bg-green-50 font-semibold h-11"
              onClick={() => handleDownload('jpeg')}
              disabled={isGenerating}
            >
              {isGenerating
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              Download JPG
            </Button>
          </div>

          <p className="text-center text-xs text-gray-400">
            PNG for crisp edges · JPG for smaller file size (WhatsApp / SMS)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FundraisingShareDialog;
