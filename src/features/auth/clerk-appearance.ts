export const morrowClerkAppearance = {
  variables: {
    colorPrimary: "#294d40",
    colorBackground: "#fbf5e6",
    colorText: "#27231f",
    colorTextSecondary: "#6f6658",
    colorInputBackground: "#f3e9d3",
    colorInputText: "#27231f",
    colorDanger: "#a34837",
    borderRadius: "4px",
    fontFamily: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
    fontFamilyButtons:
      '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: "font-sans",
    cardBox: "shadow-none",
    card: "border border-border bg-ivory shadow-[0_18px_42px_-28px_rgba(39,35,31,0.7)]",
    headerTitle: "font-display text-3xl font-medium tracking-tight text-ink",
    headerSubtitle: "text-sm leading-relaxed text-muted-foreground",
    socialButtonsBlockButton:
      "min-h-11 border-input bg-parchment text-ink shadow-none hover:bg-secondary",
    socialButtonsBlockButtonText: "font-medium",
    dividerLine: "bg-border",
    dividerText:
      "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
    formFieldLabel: "label-caps text-ink",
    formFieldInput:
      "min-h-11 border-input bg-parchment text-ink shadow-none focus:border-primary focus:ring-primary",
    formButtonPrimary:
      "min-h-11 bg-primary font-medium text-primary-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)] hover:bg-primary/90",
    footer: "bg-transparent",
    footerActionText: "text-muted-foreground",
    footerActionLink: "font-medium text-primary hover:text-primary/80",
    identityPreview: "border border-border bg-parchment",
    identityPreviewText: "text-ink",
    identityPreviewEditButton: "text-primary",
    formFieldAction: "text-primary",
    alert: "border border-postal/30 bg-postal/5 text-postal",
    userButtonTrigger:
      "h-11 w-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    userButtonAvatarBox: "h-9 w-9",
  },
} as const;
