import { createFileRoute } from "@tanstack/react-router";
import { AuthenticatedDeskRoute } from "@/features/desk/components/authenticated-desk-route";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Archive — Morrow" },
      {
        name: "description",
        content: "Review prior Morrow inspections and their evidence state.",
      },
    ],
  }),
  component: () => <AuthenticatedDeskRoute section="archive" />,
});
