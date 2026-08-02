import { useRef, useState } from "react";
import { Camera, CircleHelp } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type { ScanRecord } from "../api/types";
import { CameraCaptureDialog } from "./camera-capture-dialog";

export function EvidenceRequest({
  scan,
  onFile,
}: {
  scan: ScanRecord;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const request = scan.nextCapture;
  return (
    <section
      className="receipt-enter py-8"
      aria-labelledby="more-evidence-title"
    >
      <StatusStamp tone="info">More evidence needed</StatusStamp>
      <h1 id="more-evidence-title" className="mt-5 text-3xl leading-tight">
        {request?.title ?? "Show another identifying mark"}
      </h1>
      <Plate className="mt-5 p-4">
        <div className="flex gap-3">
          <CircleHelp
            className="mt-0.5 h-5 w-5 shrink-0 text-brass"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {request?.message ??
              "The current image does not support an exact purchase decision."}
          </p>
        </div>
      </Plate>
      <Button
        className="mt-5 min-h-12 w-full text-base"
        onClick={() => setCameraOpen(true)}
      >
        <Camera className="mr-2 h-5 w-5" aria-hidden />
        Add evidence
      </Button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={onFile}
        onChooseFile={() => input.current?.click()}
        title={request?.title ?? "Capture another identifying mark"}
      />
    </section>
  );
}
