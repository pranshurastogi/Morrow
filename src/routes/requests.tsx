import { createFileRoute } from "@tanstack/react-router";
import { AuthenticatedDeskRoute } from "@/features/desk/components/authenticated-desk-route";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "Requests — Morrow" },
      {
        name: "description",
        content: "Review bounded purchase requests prepared by Morrow.",
      },
    ],
  }),
  component: () => <AuthenticatedDeskRoute section="requests" />,
});
