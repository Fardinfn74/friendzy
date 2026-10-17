import { BookOpen, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { isMuted, onMuteChange, play, setMuted } from "@/lib/sounds";

export function SoundToggle() {
  const [muted, setM] = useState(false);
  useEffect(() => {
    setM(isMuted());
    const off = onMuteChange(setM);
    return () => void off();
  }, []);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 shrink-0 rounded-full"
      aria-label={muted ? "Turn sounds on" : "Mute sounds"}
      title={muted ? "Sounds off" : "Sounds on"}
      onClick={() => {
        setMuted(!muted);
        if (muted) play("pick");
      }}
    >
      {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </Button>
  );
}

const RULES: { title: string; body: string }[] = [
  {
    title: "1. Gather the crew",
    body: "3–12 players join with the room code. Everyone taps “I'm ready”, then the host starts.",
  },
  {
    title: "2. Read your secret card",
    body: "Crew see the secret word and its category. Imposters see nothing — they must bluff. Keep your card hidden!",
  },
  {
    title: "3. Give clues",
    body: "On your turn (35 seconds) give one word or short phrase about the word. Too vague helps the imposter, too obvious gives it away. You can't say the word itself.",
  },
  {
    title: "4. Vote",
    body: "After everyone has given a clue, vote for who you suspect (90 seconds). You can change your vote until time runs out, or vote for another clue round instead (max 2 in a row).",
  },
  {
    title: "5. Unmask",
    body: "The most-voted player is out and their role is revealed. A tie means nobody leaves.",
  },
  {
    title: "6. Win",
    body: "Crew win when every imposter is out. Imposters win when they equal or outnumber the crew.",
  },
  {
    title: "Host extras",
    body: "The host sets difficulty, number of imposters, and can type a theme so AI picks a fresh themed word for the next round.",
  },
];

export function RuleBook() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label="Open rule book"
          title="Rule book"
        >
          <BookOpen aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wide">Rule book</DialogTitle>
          <DialogDescription>Find the imposter before they blend in.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {RULES.map((r) => (
            <li key={r.title} className="player-piece p-3">
              <p className="font-display text-xl tracking-wide text-ember">{r.title}</p>
              <p className="text-sm">{r.body}</p>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
