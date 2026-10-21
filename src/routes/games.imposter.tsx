import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/games/imposter")({
  beforeLoad: () => {
    throw redirect({ to: "/games/imposta" });
  },
  component: () => null,
});
