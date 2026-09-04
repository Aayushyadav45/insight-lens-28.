import { useCallback, useRef, useState } from 'react';
import { Camera, ImagePlus, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CameraCapture } from './CameraCapture';
import { toast } from 'sonner';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export const UploadZone = ({ onFile, disabled }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!f.type.startsWith('image/')) return;
      onFile(f);
    },
    [onFile],
  );

  const openCamera = async () => {
    if (disabled) return;
    // If the API is missing or we're on insecure origin, fall straight to the native picker.
    const secure = window.isSecureContext || location.hostname === 'localhost';
    if (!navigator.mediaDevices?.getUserMedia || !secure) {
      toast.info('Live camera unavailable — opening device camera.');
      cameraRef.current?.click();
      return;
    }
    setCameraOpen(true);
  };

  return (
    <>
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-dashed border-border bg-card/40 transition-all',
        'p-6 sm:p-10 md:p-16 text-center',
        drag && 'glow-ring border-primary/60 bg-primary/5 scale-[1.01]',
        disabled && 'opacity-60 pointer-events-none',
      )}
    >
      <div className="absolute inset-0 bg-glow opacity-60 pointer-events-none" aria-hidden />
      <div className="relative flex flex-col items-center gap-6">
        <div className="size-16 rounded-2xl glass flex items-center justify-center">
          <UploadCloud className="size-7 text-primary" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">Drop a photo to begin</h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-md px-2">
            Drag &amp; drop, paste, or pick from your device. We compress locally and analyze with multimodal AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-aurora px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:brightness-110 transition"
          >
            <ImagePlus className="size-4" aria-hidden /> Choose file
          </button>
          <button
            type="button"
            onClick={openCamera}
            className="inline-flex items-center gap-2 rounded-full glass px-5 py-2.5 text-sm font-medium hover:bg-secondary transition"
          >
            <Camera className="size-4" aria-hidden /> Use camera
          </button>
        </div>
        <p className="text-xs text-muted-foreground">JPEG · PNG · WEBP · up to 10MB</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label="Upload image"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label="Capture image with camera"
      />
    </div>
      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(f) => onFile(f)}
        onFallback={() => cameraRef.current?.click()}
      />
    </>
  );
};