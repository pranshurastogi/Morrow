import { useRef } from "react";
import {
  Camera,
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
          <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-brass/70">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-ink/25 bg-primary/5">
              <ScanLine className="h-7 w-7 text-primary" aria-hidden />
            </div>
          </div>
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
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Morrow checks identifiers and contradictions before it calls anything
          an exact match.
        </p>
      </div>
    </section>
  );
}
