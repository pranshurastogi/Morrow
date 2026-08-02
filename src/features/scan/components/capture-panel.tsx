import { useRef } from "react";
import {
  Camera,
  Focus,
  Image as ImageIcon,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Plate, SectionKicker } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";

interface CapturePanelProps {
  onFile: (file: File) => void;
}

export function CapturePanel({ onFile }: CapturePanelProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  return (
    <section className="animate-slip" aria-labelledby="capture-title">
      <SectionKicker>Discover</SectionKicker>
      <h1 id="capture-title" className="mt-4 text-4xl leading-[1.05]">
        What have you found?
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Show one object and its clearest identifying marks.
      </p>

      <Plate className="relative mt-6 overflow-hidden p-4">
        <div className="pointer-events-none absolute inset-3 border border-dashed border-brass/50" />
        <div className="relative flex flex-col items-center gap-4 py-6">
          <div className="capture-alignment-guide" aria-hidden="true">
            <span className="capture-alignment-corner" data-corner="tl" />
            <span className="capture-alignment-corner" data-corner="tr" />
            <span className="capture-alignment-corner" data-corner="bl" />
            <span className="capture-alignment-corner" data-corner="br" />
            <Focus className="h-8 w-8 text-primary" />
            <span className="capture-alignment-line" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Fill the guide · keep the label square · avoid glare
          </p>
          <Button
            size="lg"
            className="min-h-12 w-full text-base active:translate-y-px"
            onClick={() => cameraInput.current?.click()}
          >
            <Camera className="mr-2 h-5 w-5" aria-hidden />
            Scan an object
          </Button>
          <input
            ref={cameraInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </Plate>

      <Button
        variant="outline"
        className="mt-3 min-h-11 w-full justify-start"
        onClick={() => imageInput.current?.click()}
      >
        <ImageIcon className="mr-2 h-4 w-4 text-brass" aria-hidden />
        Upload photo or screenshot
      </Button>
      <input
        ref={imageInput}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />

      <div className="mt-8 flex gap-3 border-y border-border py-4">
        <div className="flex shrink-0 gap-1 text-primary" aria-hidden="true">
          <ScanLine className="mt-0.5 h-5 w-5" />
          <ShieldCheck className="mt-0.5 h-5 w-5" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Morrow aligns the object and label separately, then checks identifiers
          and contradictions before calling anything exact.
        </p>
      </div>
    </section>
  );
}
