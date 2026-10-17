import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Search, MessageCircle, Vote, VenetianMask } from "lucide-react";
import { GameLayout } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/how-to-play")({
  head: () =>
    pageHead(
      "How to play",
      "Learn to give hints, vote and bluff in Imposter's Classic and Double Agent modes.",
    ),
  component: Rules,
});

const steps = [
  {
    title: "Get a secret word",
    body: "Crew see the same word. Keep your card hidden from your friends.",
    Icon: Search,
  },
  {
    title: "Give one hint",
    body: "Take turns giving one hint. Don't say the secret word or give it away.",
    Icon: MessageCircle,
  },
  {
    title: "Vote out the imposter",
    body: "Choose your suspect. Crew win when all imposters are out. A tied vote sends everyone to another hint round.",
    Icon: Vote,
  },
  {
    title: "Imposter? Blend in!",
    body: "In Classic, you don't know the word. In Double Agent, you get a different word — and your card looks like crew. Imposters win when they equal or outnumber crew.",
    Icon: VenetianMask,
  },
] as const;

function Rules() {
  const [step, setStep] = useState(0);
  const currentStep = steps[step] ?? steps[0];

  return (
    <GameLayout back>
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">How to play</p>
        <Button asChild variant="link" size="sm">
          <Link to="/">Skip</Link>
        </Button>
      </div>
      <div className="my-auto py-12 text-center">
        <div className="mx-auto mb-10 grid size-36 rotate-[-5deg] place-items-center rounded-3xl border-3 border-border bg-accent text-accent-foreground shadow-panel">
          <currentStep.Icon className="size-20" strokeWidth={1.8} />
        </div>
        <h1 className="font-display text-4xl">{currentStep.title}</h1>
        <p className="mt-5 leading-relaxed text-muted-foreground">{currentStep.body}</p>
      </div>
      <div className="step-dots">
        {steps.map((_, i) => (
          <span key={i} className={`step-dot ${i === step ? "active" : ""}`} />
        ))}
      </div>
      <div className="primary-dock">
        {step === 3 ? (
          <Button asChild className="w-full">
            <Link to="/">Got it</Link>
          </Button>
        ) : (
          <Button className="w-full" onClick={() => setStep(step + 1)}>
            Next
            <ArrowRight />
          </Button>
        )}
      </div>
    </GameLayout>
  );
}
