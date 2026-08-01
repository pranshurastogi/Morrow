import { useEffect, useState, type FormEvent } from "react";
import { MapPinCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddressInput, UserAddress } from "../api/types";

const fields = [
  {
    name: "label",
    label: "Address label",
    placeholder: "Home",
    autoComplete: "off",
  },
  {
    name: "recipientName",
    label: "Recipient name",
    placeholder: "Full name",
    autoComplete: "name",
  },
  {
    name: "line1",
    label: "Address line 1",
    placeholder: "House, building and street",
    autoComplete: "address-line1",
  },
  {
    name: "line2",
    label: "Address line 2",
    placeholder: "Area or landmark (optional)",
    autoComplete: "address-line2",
    optional: true,
  },
  {
    name: "city",
    label: "City",
    placeholder: "Jaipur",
    autoComplete: "address-level2",
  },
  {
    name: "region",
    label: "State or region",
    placeholder: "Rajasthan",
    autoComplete: "address-level1",
  },
  {
    name: "postalCode",
    label: "Postal code",
    placeholder: "302001",
    autoComplete: "postal-code",
  },
  {
    name: "countryCode",
    label: "Country code",
    placeholder: "IN",
    autoComplete: "country",
    maxLength: 2,
  },
  {
    name: "phone",
    label: "Contact phone",
    placeholder: "+91 98765 43210",
    autoComplete: "tel",
    type: "tel",
  },
] as const;

export function AddressEditorDialog({
  open,
  address,
  busy,
  error,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  address: UserAddress | null;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: AddressInput) => void;
}) {
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);

  useEffect(() => {
    if (open) setIsDefault(address?.isDefault ?? false);
  }, [address, open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      label: String(form.get("label") ?? ""),
      recipientName: String(form.get("recipientName") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? "").trim() || null,
      city: String(form.get("city") ?? ""),
      region: String(form.get("region") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      countryCode: String(form.get("countryCode") ?? "IN").toUpperCase(),
      phone: String(form.get("phone") ?? ""),
      isDefault,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-y-auto border-brass/50 bg-parchment p-0 sm:max-w-xl sm:rounded-sm">
        <div className="border-b border-border bg-primary px-5 py-3 text-primary-foreground">
          <p className="mono-caps">
            {address ? "Amend delivery record" : "New delivery record"}
          </p>
        </div>
        <form onSubmit={submit} className="px-5 pb-5">
          <DialogHeader className="pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 font-display text-2xl font-normal">
              <MapPinCheck className="h-5 w-5 text-primary" aria-hidden />
              {address ? "Edit this address" : "Where should it go?"}
            </DialogTitle>
            <DialogDescription>
              Stored encrypted and released only to an approved checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const value =
                address?.[field.name] ??
                (field.name === "countryCode" ? "IN" : "");
              const wide = ["recipientName", "line1", "line2"].includes(
                field.name,
              );
              return (
                <div
                  key={field.name}
                  className={
                    wide ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"
                  }
                >
                  <Label htmlFor={`address-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`address-${field.name}`}
                    name={field.name}
                    type={"type" in field ? field.type : "text"}
                    autoComplete={field.autoComplete}
                    placeholder={field.placeholder}
                    defaultValue={value ?? ""}
                    required={!("optional" in field && field.optional)}
                    maxLength={"maxLength" in field ? field.maxLength : 120}
                    className="h-11 rounded-sm bg-ivory"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 border-y border-border py-4">
            <Checkbox
              id="address-default"
              checked={isDefault}
              onCheckedChange={(value) => setIsDefault(value === true)}
              className="mt-0.5 h-5 w-5"
            />
            <Label htmlFor="address-default" className="leading-relaxed">
              Use as the default delivery address
            </Label>
          </div>

          {error && (
            <p
              className="mt-4 border border-postal/45 bg-postal/5 p-3 text-sm text-postal"
              role="alert"
            >
              {error}
            </p>
          )}

          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? "Recording…" : "Save address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
