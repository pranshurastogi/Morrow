import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Aperture,
  Camera,
  Check,
  CircleDashed,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { captureGuidance, type CaptureType } from "../model/capture-guidance";
import type { FrameAssessment } from "../model/frame-quality";
import { useCameraQuality } from "../model/use-camera-quality";

type CameraState = "requesting" | "ready" | "error";

interface CapturedFrame {
  file: File;
  previewUrl: string;
  assessment: FrameAssessment | null;
}

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  onChooseFile: () => void;
  title?: string;
  captureType?: CaptureType;
}

function FrameQualityReadout({
  assessment,
}: {
  assessment: FrameAssessment | null;
}) {
  if (!assessment) {
    return (
      <div className="camera-quality-readout" aria-hidden="true">
        {(["Light", "Detail", "Centring"] as const).map((label) => (
          <span key={label} data-state="waiting">
            <CircleDashed />
            {label}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div
      className="camera-quality-readout"
      aria-label="Advisory camera quality checks"
    >
      {assessment.checks.map((check) => (
        <span key={check.id} data-state={check.state}>
          {check.state === "good" ? <Check /> : <CircleDashed />}
          {check.label}
        </span>
      ))}
    </div>
  );
}

function cameraErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return "A live camera requires a secure HTTPS page.";
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was not allowed. Enable it in this site’s browser permissions, then try again.";
    }
    if (error.name === "NotFoundError") {
      return "No connected camera was found.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is already in use by another application.";
    }
    if (error.name === "OverconstrainedError") {
      return "That camera cannot provide the requested frame. Choose another camera.";
    }
  }
  return "The camera could not be opened. You can still choose an existing image.";
}

function releaseVideoStream(
  streamRef: RefObject<MediaStream | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
): void {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
  if (videoRef.current) videoRef.current.srcObject = null;
}

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  onChooseFile,
  title = "Live inspection camera",
  captureType = "full_object",
}: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestVersion = useRef(0);
  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(
    null,
  );
  const guidance = captureGuidance(captureType);
  const frameAssessment = useCameraQuality({
    active: open && cameraState === "ready" && !capturedFrame,
    videoRef,
    captureType,
  });

  const clearCapturedFrame = useCallback(() => {
    setCapturedFrame((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  const stopCamera = useCallback(() => {
    requestVersion.current += 1;
    releaseVideoStream(streamRef, videoRef);
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      const currentRequest = requestVersion.current + 1;
      requestVersion.current = currentRequest;
      releaseVideoStream(streamRef, videoRef);
      clearCapturedFrame();
      setCameraState("requesting");
      setCameraError(null);

      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new DOMException(
            "Camera capture is unavailable",
            "NotSupportedError",
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1440 },
              }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1440 },
              },
        });

        if (currentRequest !== requestVersion.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (currentRequest !== requestVersion.current) return;

        const availableDevices = (
          await navigator.mediaDevices.enumerateDevices()
        ).filter((device) => device.kind === "videoinput");
        const activeDeviceId =
          stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? "";
        setDevices(availableDevices);
        setSelectedDeviceId(activeDeviceId);
        setCameraState("ready");
      } catch (error) {
        if (currentRequest !== requestVersion.current) return;
        releaseVideoStream(streamRef, videoRef);
        setCameraError(cameraErrorMessage(error));
        setCameraState("error");
      }
    },
    [clearCapturedFrame],
  );

  useEffect(() => {
    if (!open) return;
    void startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  useEffect(
    () => () => {
      stopCamera();
      clearCapturedFrame();
    },
    [clearCapturedFrame, stopCamera],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        stopCamera();
        clearCapturedFrame();
      }
      onOpenChange(nextOpen);
    },
    [clearCapturedFrame, onOpenChange, stopCamera],
  );

  const chooseFile = useCallback(() => {
    handleOpenChange(false);
    onChooseFile();
  }, [handleOpenChange, onChooseFile]);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("The camera frame is not ready yet. Please try again.");
      setCameraState("error");
      return;
    }

    const maximumDimension = 2560;
    const scale = Math.min(
      1,
      maximumDimension / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("The browser could not prepare this camera frame.");
      setCameraState("error");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setCameraError("The browser could not save this camera frame.");
      setCameraState("error");
      return;
    }

    stopCamera();
    const file = new File(
      [blob],
      `morrow-camera-${new Date().toISOString().replaceAll(":", "-")}.jpg`,
      { type: "image/jpeg", lastModified: Date.now() },
    );
    setCapturedFrame({
      file,
      previewUrl: URL.createObjectURL(file),
      assessment: frameAssessment,
    });
  }, [frameAssessment, stopCamera]);

  const useCapturedFrame = useCallback(() => {
    if (!capturedFrame) return;
    const file = capturedFrame.file;
    handleOpenChange(false);
    onCapture(file);
  }, [capturedFrame, handleOpenChange, onCapture]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[96dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto border-brass/60 bg-parchment p-0 sm:rounded-sm">
        <div className="border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogHeader className="text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
              Camera instrument
            </p>
            <DialogTitle className="font-display text-2xl font-normal">
              {title}
            </DialogTitle>
            <DialogDescription>{guidance.instruction}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-3 pb-5 sm:px-6 sm:pb-6">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-ink/40 bg-ink">
            {capturedFrame ? (
              <img
                src={capturedFrame.previewUrl}
                alt="Captured object ready for review"
                className="h-full w-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Live camera preview"
                className="h-full w-full object-contain"
              />
            )}

            {!capturedFrame && cameraState === "ready" && (
              <div
                className="camera-alignment-overlay"
                data-shape={guidance.guideShape}
                aria-hidden="true"
              >
                <span className="capture-alignment-corner" data-corner="tl" />
                <span className="capture-alignment-corner" data-corner="tr" />
                <span className="capture-alignment-corner" data-corner="bl" />
                <span className="capture-alignment-corner" data-corner="br" />
                <span className="capture-alignment-line" />
                <span className="camera-alignment-label">{guidance.title}</span>
              </div>
            )}

            {!capturedFrame && cameraState === "requesting" && (
              <div className="absolute inset-0 grid place-items-center bg-ink/80 text-center text-ivory">
                <div>
                  <Camera className="mx-auto h-8 w-8 text-brass" aria-hidden />
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em]">
                    Opening camera
                  </p>
                </div>
              </div>
            )}

            {!capturedFrame && cameraState === "error" && (
              <div className="absolute inset-0 grid place-items-center bg-parchment p-6 text-center">
                <div>
                  <Camera className="mx-auto h-8 w-8 text-postal" aria-hidden />
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {cameraError}
                  </p>
                </div>
              </div>
            )}
          </div>

          <p
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {capturedFrame
              ? (capturedFrame.assessment?.advice ?? "Frame held for review")
              : cameraState === "ready"
                ? (frameAssessment?.advice ?? "Reading the live frame")
                : cameraState === "error"
                  ? "Camera unavailable"
                  : "Requesting browser permission"}
          </p>

          {(cameraState === "ready" || capturedFrame) && (
            <FrameQualityReadout
              assessment={capturedFrame?.assessment ?? frameAssessment}
            />
          )}

          {!capturedFrame && devices.length > 1 && (
            <label className="block text-sm" htmlFor="morrow-camera-source">
              <span className="mb-1.5 block text-muted-foreground">
                Camera source
              </span>
              <select
                id="morrow-camera-source"
                value={selectedDeviceId}
                onChange={(event) => {
                  const deviceId = event.currentTarget.value;
                  setSelectedDeviceId(deviceId);
                  void startCamera(deviceId);
                }}
                className="min-h-11 w-full border border-input bg-ivory px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {capturedFrame ? (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void startCamera(selectedDeviceId || undefined)
                  }
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Retake frame
                </Button>
                <Button className="min-h-11" onClick={useCapturedFrame}>
                  <Aperture className="h-4 w-4" aria-hidden />
                  Use this frame
                </Button>
              </>
            ) : cameraState === "error" ? (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void startCamera(selectedDeviceId || undefined)
                  }
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Try camera again
                </Button>
                <Button className="min-h-11" onClick={chooseFile}>
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Choose an image
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={chooseFile}
                >
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Choose an image
                </Button>
                <Button
                  className="min-h-11"
                  disabled={cameraState !== "ready"}
                  onClick={() => void captureFrame()}
                >
                  <Aperture className="h-4 w-4" aria-hidden />
                  Capture frame
                </Button>
              </>
            )}
          </div>

          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            The live feed stays in this browser. Morrow uploads only the frame
            you approve.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
