import { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Check, SwitchCamera, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Called when the camera cannot be used so the parent can fall back to the file picker. */
  onFallback: () => void;
}

type Facing = 'environment' | 'user';

/**
 * Mobile-friendly camera capture with explicit permission handling.
 * Uses getUserMedia + a <video> preview + <canvas> snapshot.
 * Falls back to the native file picker (capture=environment) on any failure.
 */
export const CameraCapture = ({ open, onClose, onCapture, onFallback }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  };

  const start = async (mode: Facing) => {
    setError(null);
    setSnapshot(null);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support camera access. Use file upload instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (e) {
      const err = e as DOMException;
      let msg = 'Camera unavailable.';
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        msg = 'Camera permission denied. Enable it in your browser settings, or use file upload.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        msg = 'No camera found on this device.';
      } else if (err?.name === 'NotReadableError') {
        msg = 'Camera is in use by another app.';
      }
      setError(msg);
    }
  };

  useEffect(() => {
    if (open) void start(facing);
    return stopStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const flip = async () => {
    const next: Facing = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await start(next);
  };

  const snap = () => {
    const v = videoRef.current;
    if (!v || !ready) return;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    setSnapshot(canvas.toDataURL('image/jpeg', 0.92));
  };

  const confirm = () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Re-render from the data URL we already produced to keep parity with the preview.
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error('Could not capture image.');
            return;
          }
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          stopStream();
          onCapture(file);
          onClose();
        },
        'image/jpeg',
        0.92,
      );
    };
    img.src = snapshot!;
  };

  const close = () => {
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera capture"
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Camera className="size-4 text-primary" /> Camera
        </div>
        <button
          onClick={close}
          className="size-9 rounded-full glass flex items-center justify-center hover:bg-secondary transition"
          aria-label="Close camera"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden flex items-center justify-center bg-black">
        {!error && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`max-h-full max-w-full object-contain ${snapshot ? 'hidden' : ''}`}
            />
            {snapshot && (
              <img src={snapshot} alt="Captured preview" className="max-h-full max-w-full object-contain" />
            )}
            {!ready && !snapshot && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Requesting camera permission…
              </div>
            )}
          </>
        )}

        {error && (
          <div className="max-w-md text-center px-6 space-y-4">
            <div className="mx-auto size-12 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <p className="text-sm text-foreground/90">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => start(facing)}
                className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm hover:bg-secondary transition"
              >
                <RefreshCw className="size-3.5" /> Retry
              </button>
              <button
                onClick={() => {
                  stopStream();
                  onClose();
                  onFallback();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-aurora px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:brightness-110 transition"
              >
                Use file upload instead
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-5 border-t border-border bg-background/80">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {!snapshot ? (
            <>
              <button
                onClick={flip}
                disabled={!ready}
                className="size-12 rounded-full glass flex items-center justify-center hover:bg-secondary transition disabled:opacity-40"
                aria-label="Switch camera"
              >
                <SwitchCamera className="size-5" />
              </button>
              <button
                onClick={snap}
                disabled={!ready}
                aria-label="Take photo"
                className="size-16 rounded-full bg-aurora shadow-elegant ring-4 ring-background flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition"
              >
                <span className="size-12 rounded-full bg-primary-foreground/95" />
              </button>
              <button
                onClick={() => {
                  stopStream();
                  onClose();
                  onFallback();
                }}
                className="size-12 rounded-full glass flex items-center justify-center hover:bg-secondary transition"
                aria-label="Use file upload"
                title="Use file upload"
              >
                <RefreshCw className="size-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSnapshot(null)}
                className="inline-flex items-center gap-2 rounded-full glass px-5 py-2.5 text-sm hover:bg-secondary transition"
              >
                <RefreshCw className="size-4" /> Retake
              </button>
              <button
                onClick={confirm}
                className="inline-flex items-center gap-2 rounded-full bg-aurora px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant hover:brightness-110 transition"
              >
                <Check className="size-4" /> Use photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};