import { createFileRoute } from "@tanstack/react-router";
import { AuthenticatedDeskRoute } from "@/features/desk/components/authenticated-desk-route";

export const Route = createFileRoute("/dispatches")({
  head: () => ({
    meta: [
      { title: "Dispatches — Morrow" },
      {
        name: "description",
        content: "Review merchant orders and recorded dispatch outcomes.",
      },
    ],
  }),
  component: () => <AuthenticatedDeskRoute section="dispatches" />,
});
