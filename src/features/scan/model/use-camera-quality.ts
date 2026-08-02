import { useEffect, useRef, useState, type RefObject } from "react";
import type { CaptureType } from "./capture-guidance";
import {
  analyzeFramePixels,
  assessFrameQuality,
  type FrameAssessment,
} from "./frame-quality";

export function useCameraQuality({
  active,
  videoRef,
  captureType,
}: {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  captureType: CaptureType;
}): FrameAssessment | null {
  const previousLuma = useRef<Uint8Array | null>(null);
  const [assessment, setAssessment] = useState<FrameAssessment | null>(null);

  useEffect(() => {
    previousLuma.current = null;
    setAssessment(null);
    if (!active) return;

    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 72;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const inspect = () => {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const sample = analyzeFramePixels(
        pixels.data,
        canvas.width,
        canvas.height,
        previousLuma.current,
      );
      previousLuma.current = sample.luma;
      setAssessment(assessFrameQuality(sample.metrics, captureType));
    };

    inspect();
    const timer = window.setInterval(inspect, 720);
    return () => window.clearInterval(timer);
  }, [active, captureType, videoRef]);

  return assessment;
}
