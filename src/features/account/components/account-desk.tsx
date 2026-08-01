import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import {
  CreditCard,
  Fingerprint,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Plate, StatusStamp, VintageLabel } from "@/components/morrow/bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  createAddress,
  deleteAddress,
  deleteCard,
  listAddresses,
  listCards,
  setDefaultAddress,
  updateAddress,
} from "../api/client";
import type { AddressInput, UserAddress } from "../api/types";
import { AddressEditorDialog } from "./address-editor-dialog";

const addressQueryKey = ["account", "addresses"] as const;
const cardQueryKey = ["account", "prava-cards"] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The account record could not be updated.";
}

function cardLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function AccountDesk() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(
    null,
  );

  const addresses = useQuery({
    queryKey: addressQueryKey,
    queryFn: listAddresses,
  });
  const cards = useQuery({
    queryKey: cardQueryKey,
    queryFn: listCards,
    retry: 1,
  });

  const saveAddress = useMutation({
    mutationFn: async (input: AddressInput) =>
      editingAddress
        ? updateAddress(editingAddress.id, input)
        : createAddress(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: addressQueryKey });
      setEditorOpen(false);
      setEditingAddress(null);
    },
  });
  const makeDefault = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: addressQueryKey });
    },
  });
  const removeAddress = useMutation({
    mutationFn: deleteAddress,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: addressQueryKey });
    },
  });
  const retireCard = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cardQueryKey });
    },
  });

  function openNewAddress() {
    saveAddress.reset();
    setEditingAddress(null);
    setEditorOpen(true);
  }

  function openAddress(address: UserAddress) {
    saveAddress.reset();
    setEditingAddress(address);
    setEditorOpen(true);
  }

  const displayName = user?.fullName || user?.firstName || "Morrow customer";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Signed-in account";

  return (
    <main className="mx-auto w-full max-w-[680px] px-4 py-5">
      <section className="receipt-enter" aria-labelledby="account-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-caps text-postal">Private customer ledger</p>
            <h1 id="account-title" className="mt-2 text-3xl">
              Your Morrow account.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Delivery records live with Morrow. Card and passkey details stay
              with Prava.
            </p>
          </div>
          <UserRound className="h-8 w-8 shrink-0 text-primary" aria-hidden />
        </div>

        <Plate className="mt-5 overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-border bg-secondary/45 p-4">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                className="h-12 w-12 rounded-full border border-brass/60 object-cover"
              />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full border border-brass/60 bg-ivory">
                <UserRound className="h-5 w-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display text-xl">{displayName}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {email}
              </p>
            </div>
          </div>
          <div className="flex gap-3 p-4 text-sm text-muted-foreground">
            <ShieldCheck
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <p>
              Only your signed-in account can read these records or use them in
              a bounded purchase.
            </p>
          </div>
        </Plate>

        <section className="mt-8" aria-labelledby="address-title">
          <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <VintageLabel>Delivery book</VintageLabel>
              <h2 id="address-title" className="mt-2 font-display text-2xl">
                Saved addresses
              </h2>
            </div>
            <Button size="sm" className="min-h-11" onClick={openNewAddress}>
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </Button>
          </div>

          {addresses.isLoading && (
            <Plate className="mt-3 p-5 text-center">
              <p className="mono-caps text-muted-foreground" role="status">
                Opening delivery book
              </p>
            </Plate>
          )}
          {addresses.error && (
            <Plate className="mt-3 border-postal/45 p-4">
              <p className="text-sm text-postal" role="alert">
                {errorMessage(addresses.error)}
              </p>
            </Plate>
          )}
          {addresses.data?.length === 0 && (
            <Plate className="mt-3 p-5 text-center">
              <MapPin className="mx-auto h-6 w-6 text-brass" aria-hidden />
              <p className="mt-3 font-medium">No delivery address yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add one before a physical dispatch is approved.
              </p>
            </Plate>
          )}
          <div className="mt-3 grid gap-3">
            {addresses.data?.map((address) => (
              <Plate key={address.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl">{address.label}</h3>
                      {address.isDefault && (
                        <StatusStamp tone="verified">Default</StatusStamp>
                      )}
                    </div>
                    <address className="mt-2 not-italic text-sm leading-relaxed text-muted-foreground">
                      <span className="block text-foreground">
                        {address.recipientName}
                      </span>
                      <span className="block">{address.line1}</span>
                      {address.line2 && (
                        <span className="block">{address.line2}</span>
                      )}
                      <span className="block">
                        {address.city}, {address.region} {address.postalCode}
                      </span>
                      <span className="block">
                        {address.countryCode} · {address.phone}
                      </span>
                    </address>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    aria-label={`Edit ${address.label}`}
                    onClick={() => openAddress(address)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  {!address.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      disabled={makeDefault.isPending}
                      onClick={() => makeDefault.mutate(address.id)}
                    >
                      Make default
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-10 text-postal"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100%-1.5rem)] border-brass/50 bg-parchment sm:rounded-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-display text-2xl font-normal">
                          Remove {address.label}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Future purchases will no longer be able to use this
                          delivery record.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep address</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-postal text-white hover:bg-postal/90"
                          onClick={() => removeAddress.mutate(address.id)}
                        >
                          Remove address
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Plate>
            ))}
          </div>
        </section>

        <section className="mt-9" aria-labelledby="payment-title">
          <div className="border-b border-border pb-3">
            <VintageLabel>Prava wallet link</VintageLabel>
            <h2 id="payment-title" className="mt-2 font-display text-2xl">
              Cards and passkeys
            </h2>
          </div>

          <Plate className="mt-3 p-4">
            <div className="flex gap-3">
              <Fingerprint
                className="h-6 w-6 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">Passkey approval</p>
                  <StatusStamp tone="info">Managed by Prava</StatusStamp>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Prava requests Touch ID, Face ID, or a security key during
                  approval. Morrow cannot read or store that passkey.
                </p>
              </div>
            </div>
          </Plate>

          {cards.isLoading && (
            <Plate className="mt-3 p-5 text-center">
              <p className="mono-caps text-muted-foreground" role="status">
                Checking Prava card records
              </p>
            </Plate>
          )}
          {cards.error && (
            <Plate className="mt-3 border-postal/45 p-4">
              <p className="text-sm text-postal" role="alert">
                {errorMessage(cards.error)}
              </p>
            </Plate>
          )}
          <div className="mt-3 grid gap-3">
            {cards.data?.map((card) => (
              <Plate key={card.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center border border-brass/45 bg-secondary/45">
                      <CreditCard className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {cardLabel(card.brand)} •••• {card.last4}
                        </p>
                        {card.isDefault && (
                          <StatusStamp tone="verified">Default</StatusStamp>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {card.expMonth && card.expYear
                          ? `Expires ${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
                          : "Expiry held by Prava"}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0 text-postal"
                        aria-label={`Retire card ending ${card.last4}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100%-1.5rem)] border-brass/50 bg-parchment sm:rounded-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-display text-2xl font-normal">
                          Retire card ending {card.last4}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Prava will delete the enrolled card record and retire
                          its network token. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep card</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-postal text-white hover:bg-postal/90"
                          onClick={() => retireCard.mutate(card.id)}
                        >
                          Retire card
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Plate>
            ))}
          </div>

          {cards.data?.length === 0 && (
            <Plate className="mt-3 p-5 text-center">
              <CreditCard className="mx-auto h-6 w-6 text-brass" aria-hidden />
              <p className="mt-3 font-medium">No card enrolled yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A card is added only inside Prava’s secure approval surface.
              </p>
            </Plate>
          )}

          <Button variant="outline" className="mt-3 min-h-11 w-full" asChild>
            <Link to="/scan">Open a secure approval from a verified item</Link>
          </Button>
        </section>
      </section>

      <AddressEditorDialog
        key={editingAddress?.id ?? "new-address"}
        open={editorOpen}
        address={editingAddress}
        busy={saveAddress.isPending}
        error={saveAddress.error ? errorMessage(saveAddress.error) : null}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingAddress(null);
        }}
        onSave={(input) => saveAddress.mutate(input)}
      />
    </main>
  );
}
