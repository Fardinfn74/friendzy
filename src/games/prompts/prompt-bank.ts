export type PromptLevel = "Chill" | "Funny" | "Wild";

export type PromptItem = {
  id: string;
  type: "truth" | "dare";
  level: PromptLevel;
  text: string;
};

export const TRUTHS: PromptItem[] = [
  // Chill (20)
  { id: "t1", type: "truth", level: "Chill", text: "What is your biggest irrational pet peeve?" },
  {
    id: "t2",
    type: "truth",
    level: "Chill",
    text: "If you could only eat one breakfast food forever, what would it be?",
  },
  {
    id: "t3",
    type: "truth",
    level: "Chill",
    text: "What is a movie you secretly love that everyone else hates?",
  },
  {
    id: "t4",
    type: "truth",
    level: "Chill",
    text: "What is the weirdest habit you have when you're completely alone?",
  },
  {
    id: "t5",
    type: "truth",
    level: "Chill",
    text: "What cartoon character did you have a crush on growing up?",
  },
  {
    id: "t6",
    type: "truth",
    level: "Chill",
    text: "What's the longest you've ever gone without washing your favorite hoodie?",
  },
  {
    id: "t7",
    type: "truth",
    level: "Chill",
    text: "What's a trend you participated in that you now cringe thinking about?",
  },
  {
    id: "t8",
    type: "truth",
    level: "Chill",
    text: "If you had to trade lives with someone in this room for 24 hours, who?",
  },
  {
    id: "t9",
    type: "truth",
    level: "Chill",
    text: "What is something you pretend to understand but really don't?",
  },
  { id: "t10", type: "truth", level: "Chill", text: "What's the most useless talent you possess?" },
  {
    id: "t11",
    type: "truth",
    level: "Chill",
    text: "What fictional world would you instantly move to if given the chance?",
  },
  {
    id: "t12",
    type: "truth",
    level: "Chill",
    text: "What food combination do you enjoy that disgusts other people?",
  },
  {
    id: "t13",
    type: "truth",
    level: "Chill",
    text: "What's the most childish thing you still do regularly?",
  },
  { id: "t14", type: "truth", level: "Chill", text: "What song is your ultimate guilty pleasure?" },
  {
    id: "t15",
    type: "truth",
    level: "Chill",
    text: "If your pet could talk, what's the worst secret they could reveal about you?",
  },
  {
    id: "t16",
    type: "truth",
    level: "Chill",
    text: "What was your first email address or screen name?",
  },
  {
    id: "t17",
    type: "truth",
    level: "Chill",
    text: "What's the silliest thing you've ever cried over?",
  },
  {
    id: "t18",
    type: "truth",
    level: "Chill",
    text: "If you had to rename yourself right now, what name would you pick?",
  },
  {
    id: "t19",
    type: "truth",
    level: "Chill",
    text: "What's a superstition you secretly follow even though you know it's silly?",
  },
  {
    id: "t20",
    type: "truth",
    level: "Chill",
    text: "What's the most ridiculous outfit you ever wore in public on purpose?",
  },

  // Funny (20)
  {
    id: "t21",
    type: "truth",
    level: "Funny",
    text: "What's the dumbest lie you ever told that someone actually believed?",
  },
  {
    id: "t22",
    type: "truth",
    level: "Funny",
    text: "Have you ever blamed a pet for something embarrassing you did?",
  },
  {
    id: "t23",
    type: "truth",
    level: "Funny",
    text: "What's the most embarrassing thing in your search history from the past month?",
  },
  {
    id: "t24",
    type: "truth",
    level: "Funny",
    text: "Have you ever waved at someone who was definitely waving at someone behind you?",
  },
  {
    id: "t25",
    type: "truth",
    level: "Funny",
    text: "What's the worst haircut or hairstyle you've ever had?",
  },
  {
    id: "t26",
    type: "truth",
    level: "Funny",
    text: "Have you ever practiced an argument in the shower and then lost it in your own head?",
  },
  {
    id: "t27",
    type: "truth",
    level: "Funny",
    text: "What excuse have you used to get out of plans that was completely made up?",
  },
  {
    id: "t28",
    type: "truth",
    level: "Funny",
    text: "What is the most awkward text you've accidentally sent to the wrong person?",
  },
  {
    id: "t29",
    type: "truth",
    level: "Funny",
    text: "What's something you did as a kid that you thought was genius but was actually ridiculous?",
  },
  {
    id: "t30",
    type: "truth",
    level: "Funny",
    text: "Have you ever eaten something off the floor way past the 5-second rule?",
  },
  {
    id: "t31",
    type: "truth",
    level: "Funny",
    text: "What's a weird habit you have while watching TV or scrolling your phone?",
  },
  {
    id: "t32",
    type: "truth",
    level: "Funny",
    text: "What is the most uncoordinated thing you've done in front of a crowd?",
  },
  {
    id: "t33",
    type: "truth",
    level: "Funny",
    text: "If you were arrested with no explanation, what would your friends assume it was for?",
  },
  {
    id: "t34",
    type: "truth",
    level: "Funny",
    text: "Have you ever pretended to be on a phone call just to avoid talking to someone?",
  },
  {
    id: "t35",
    type: "truth",
    level: "Funny",
    text: "What's the worst gift you ever received that you had to pretend to love?",
  },
  {
    id: "t36",
    type: "truth",
    level: "Funny",
    text: "What is the most bizarre dream you can remember having recently?",
  },
  {
    id: "t37",
    type: "truth",
    level: "Funny",
    text: "What's the most awkward silence you've ever experienced?",
  },
  {
    id: "t38",
    type: "truth",
    level: "Funny",
    text: "What's a phrase you overused until everyone around you got annoyed?",
  },
  {
    id: "t39",
    type: "truth",
    level: "Funny",
    text: "Have you ever laughed so hard at the wrong moment that people stared?",
  },
  {
    id: "t40",
    type: "truth",
    level: "Funny",
    text: "What is your go-to fake story when talking to strangers in public transit?",
  },

  // Wild (20)
  {
    id: "t41",
    type: "truth",
    level: "Wild",
    text: "Who in this room would survive the shortest amount of time in a zombie apocalypse?",
  },
  {
    id: "t42",
    type: "truth",
    level: "Wild",
    text: "If everyone in this room were on a sinking ship, who would you push in first (jokingly)?",
  },
  {
    id: "t43",
    type: "truth",
    level: "Wild",
    text: "What is the biggest misunderstanding someone has ever had about your personality?",
  },
  {
    id: "t44",
    type: "truth",
    level: "Wild",
    text: "What's the pettiest reason you've ever stopped being friends with someone?",
  },
  {
    id: "t45",
    type: "truth",
    level: "Wild",
    text: "What rumor about yourself turned out to be completely hilarious?",
  },
  {
    id: "t46",
    type: "truth",
    level: "Wild",
    text: "What is the most dramatic overreaction you've ever had to something minor?",
  },
  {
    id: "t47",
    type: "truth",
    level: "Wild",
    text: "If you had to expose your most played playlist right now, would you survive?",
  },
  {
    id: "t48",
    type: "truth",
    level: "Wild",
    text: "Who in this room has the best sense of humor, and who thinks they do?",
  },
  {
    id: "t49",
    type: "truth",
    level: "Wild",
    text: "What is the most trouble you ever got into at school?",
  },
  {
    id: "t50",
    type: "truth",
    level: "Wild",
    text: "What's the weirdest nickname you've ever been given?",
  },
  {
    id: "t51",
    type: "truth",
    level: "Wild",
    text: "If you could delete one thing you ever posted online, what would it be?",
  },
  {
    id: "t52",
    type: "truth",
    level: "Wild",
    text: "What's something you secretly think you're way better at than everyone else here?",
  },
  {
    id: "t53",
    type: "truth",
    level: "Wild",
    text: "What's the biggest purchase you made that ended up being completely useless?",
  },
  {
    id: "t54",
    type: "truth",
    level: "Wild",
    text: "What is the most embarrassing nickname your parents ever used for you in public?",
  },
  {
    id: "t55",
    type: "truth",
    level: "Wild",
    text: "Have you ever snooped on someone's phone or room, and what did you find?",
  },
  {
    id: "t56",
    type: "truth",
    level: "Wild",
    text: "What's the most bizarre rumor you ever accidentally started?",
  },
  {
    id: "t57",
    type: "truth",
    level: "Wild",
    text: "What's something you do that you're 99% sure no one else in this room does?",
  },
  {
    id: "t58",
    type: "truth",
    level: "Wild",
    text: "Who in this room is the most likely to become a villain in a comic book?",
  },
  {
    id: "t59",
    type: "truth",
    level: "Wild",
    text: "What was your most dramatic breakup or fallout with a friend?",
  },
  {
    id: "t60",
    type: "truth",
    level: "Wild",
    text: "What's a truth about yourself that nobody here knows yet?",
  },
];

export const DARES: PromptItem[] = [
  // Chill (20)
  {
    id: "d1",
    type: "dare",
    level: "Chill",
    text: "Talk in an exaggerated pirate accent for the next two rounds.",
  },
  {
    id: "d2",
    type: "dare",
    level: "Chill",
    text: "Let another player style your hair however they want for the next 5 minutes.",
  },
  {
    id: "d3",
    type: "dare",
    level: "Chill",
    text: "Do your best impression of a cat coughing up a hairball.",
  },
  {
    id: "d4",
    type: "dare",
    level: "Chill",
    text: "Sing the chorus of your favorite song like an opera singer.",
  },
  {
    id: "d5",
    type: "dare",
    level: "Chill",
    text: "Balance a spoon or book on your nose for 20 seconds.",
  },
  {
    id: "d6",
    type: "dare",
    level: "Chill",
    text: "Tell the group a joke with a completely straight, serious face.",
  },
  { id: "d7", type: "dare", level: "Chill", text: "Speak in slow motion until your next turn." },
  {
    id: "d8",
    type: "dare",
    level: "Chill",
    text: "Give a 30-second dramatic commercial pitch for an ordinary pencil.",
  },
  {
    id: "d9",
    type: "dare",
    level: "Chill",
    text: "Do 10 jumping jacks while chanting your favorite food.",
  },
  {
    id: "d10",
    type: "dare",
    level: "Chill",
    text: "Speak like a robotic GPS navigation system for the next round.",
  },
  { id: "d11", type: "dare", level: "Chill", text: "Try to lick your elbow for 15 seconds." },
  {
    id: "d12",
    type: "dare",
    level: "Chill",
    text: "Do your best celebrity impression and let everyone guess who it is.",
  },
  {
    id: "d13",
    type: "dare",
    level: "Chill",
    text: "Wear your socks on your hands for the next 3 rounds.",
  },
  {
    id: "d14",
    type: "dare",
    level: "Chill",
    text: "Recite the alphabet backwards starting from Z down to P without pausing.",
  },
  {
    id: "d15",
    type: "dare",
    level: "Chill",
    text: "Hold a wall sit for 30 seconds while smiling.",
  },
  {
    id: "d16",
    type: "dare",
    level: "Chill",
    text: "Whisper everything you say until the next spin/turn.",
  },
  {
    id: "d17",
    type: "dare",
    level: "Chill",
    text: "Do a runway model walk across the room and strike a dramatic pose.",
  },
  {
    id: "d18",
    type: "dare",
    level: "Chill",
    text: "Make up a 4-line rhyme about someone in this room on the spot.",
  },
  {
    id: "d19",
    type: "dare",
    level: "Chill",
    text: "High-five everyone in the room with your elbow.",
  },
  {
    id: "d20",
    type: "dare",
    level: "Chill",
    text: "Narrate everything the person to your left does for the next minute.",
  },

  // Funny (20)
  {
    id: "d21",
    type: "dare",
    level: "Funny",
    text: "Act like a chicken discovering a worm for the first time for 20 seconds.",
  },
  {
    id: "d22",
    type: "dare",
    level: "Funny",
    text: "Eat a slice of lemon or a spoon of ketchup without making a face.",
  },
  {
    id: "d23",
    type: "dare",
    level: "Funny",
    text: "Pretend to be an alien reporting on human behavior to your mothership.",
  },
  {
    id: "d24",
    type: "dare",
    level: "Funny",
    text: "Act like an enthusiastic infomercial host pitching the person sitting next to you.",
  },
  {
    id: "d25",
    type: "dare",
    level: "Funny",
    text: "Try not to blink for 45 seconds while staring at the group.",
  },
  {
    id: "d26",
    type: "dare",
    level: "Funny",
    text: "Speak only in questions until your next turn.",
  },
  {
    id: "d27",
    type: "dare",
    level: "Funny",
    text: "Do your absolute worst dance move with maximum confidence.",
  },
  {
    id: "d28",
    type: "dare",
    level: "Funny",
    text: "Pretend the floor is hot lava every time you move for the rest of the game.",
  },
  {
    id: "d29",
    type: "dare",
    level: "Funny",
    text: "Sing 'Happy Birthday' in a dramatic villain voice.",
  },
  {
    id: "d30",
    type: "dare",
    level: "Funny",
    text: "Let the group compose a ridiculous text to send to your group chat.",
  },
  {
    id: "d31",
    type: "dare",
    level: "Funny",
    text: "Drink a glass of water without using your hands (use a straw or cup on table).",
  },
  {
    id: "d32",
    type: "dare",
    level: "Funny",
    text: "Give a dramatic soap opera speech pretending someone here betrayed you.",
  },
  {
    id: "d33",
    type: "dare",
    level: "Funny",
    text: "Imitate an animal of the group's choosing until someone guesses it.",
  },
  {
    id: "d34",
    type: "dare",
    level: "Funny",
    text: "Do an intense workout instructor routine for 30 seconds.",
  },
  {
    id: "d35",
    type: "dare",
    level: "Funny",
    text: "Talk to a piece of furniture as if it just broke your heart.",
  },
  {
    id: "d36",
    type: "dare",
    level: "Funny",
    text: "Do your best mime trapped in an invisible box performance.",
  },
  {
    id: "d37",
    type: "dare",
    level: "Funny",
    text: "Try to juggle 3 small household objects for 10 seconds.",
  },
  {
    id: "d38",
    type: "dare",
    level: "Funny",
    text: "Act out a famous movie scene without making any sound.",
  },
  {
    id: "d39",
    type: "dare",
    level: "Funny",
    text: "Speak with your tongue sticking out for the next minute.",
  },
  {
    id: "d40",
    type: "dare",
    level: "Funny",
    text: "Do a 20-second beatbox performance, regardless of skill.",
  },

  // Wild (20)
  {
    id: "d41",
    type: "dare",
    level: "Wild",
    text: "Put an ice cube in your hand and hold it until it completely melts (or 60 seconds).",
  },
  {
    id: "d42",
    type: "dare",
    level: "Wild",
    text: "Let the person to your right draw a fake mustache on you with a washable marker or eyeliner.",
  },
  {
    id: "d43",
    type: "dare",
    level: "Wild",
    text: "Eat a cracker and try to whistle immediately afterwards.",
  },
  {
    id: "d44",
    type: "dare",
    level: "Wild",
    text: "Do 20 pushups or 20 squats right now while shouting motivational quotes.",
  },
  {
    id: "d45",
    type: "dare",
    level: "Wild",
    text: "Wear a silly hat, towel, or pillow on your head for the rest of the game.",
  },
  {
    id: "d46",
    type: "dare",
    level: "Wild",
    text: "Let another player choose your profile status or reaction emoji for 1 hour.",
  },
  {
    id: "d47",
    type: "dare",
    level: "Wild",
    text: "Do an emotional apology to an inanimate object in the room.",
  },
  {
    id: "d48",
    type: "dare",
    level: "Wild",
    text: "Speak only in movie quotes for the next three turns/spins.",
  },
  {
    id: "d49",
    type: "dare",
    level: "Wild",
    text: "Switch one piece of clothing with the person to your left (e.g. jacket or hat).",
  },
  {
    id: "d50",
    type: "dare",
    level: "Wild",
    text: "Do the Macarena or Chicken Dance with intense serious eye contact.",
  },
  {
    id: "d51",
    type: "dare",
    level: "Wild",
    text: "Show the last 3 photos in your camera roll to the group.",
  },
  {
    id: "d52",
    type: "dare",
    level: "Wild",
    text: "Let someone tickle your feet for 10 seconds without laughing.",
  },
  {
    id: "d53",
    type: "dare",
    level: "Wild",
    text: "Post a funny harmless selfie with a caption chosen by the group to your story.",
  },
  {
    id: "d54",
    type: "dare",
    level: "Wild",
    text: "Try to keep a straight face while everyone else tries to make you laugh for 30 seconds.",
  },
  {
    id: "d55",
    type: "dare",
    level: "Wild",
    text: "Call a friend on speaker and say 'I don't have much time, the squirrels are here' and hang up.",
  },
  {
    id: "d56",
    type: "dare",
    level: "Wild",
    text: "Do your best impersonation of a grumpy grandma/grandpa complaining about modern youth.",
  },
  {
    id: "d57",
    type: "dare",
    level: "Wild",
    text: "Wear your shirt backwards for the rest of the game.",
  },
  {
    id: "d58",
    type: "dare",
    level: "Wild",
    text: "Take a sip of a mystery drink mixed by the other players (safe drinks only).",
  },
  {
    id: "d59",
    type: "dare",
    level: "Wild",
    text: "Act like a professional wrestler making your grand ring entrance.",
  },
  {
    id: "d60",
    type: "dare",
    level: "Wild",
    text: "Let someone in the room give you a dramatic makeover for 2 minutes.",
  },
];

export function getPromptPool(
  type: "truth" | "dare",
  level: "All" | PromptLevel = "All",
  customPrompts: PromptItem[] = [],
): PromptItem[] {
  const base = type === "truth" ? TRUTHS : DARES;
  const filteredBase = level === "All" ? base : base.filter((p) => p.level === level);
  const matchingCustom = customPrompts.filter(
    (p) => p.type === type && (level === "All" || p.level === level),
  );
  return [...filteredBase, ...matchingCustom];
}

export function pickRandomPrompt(
  type: "truth" | "dare",
  level: "All" | PromptLevel = "All",
  usedIds: string[] = [],
  customPrompts: PromptItem[] = [],
): PromptItem {
  const pool = getPromptPool(type, level, customPrompts);
  const available = pool.filter((p) => !usedIds.includes(p.id));

  // If all used, recycle pool
  const candidates = available.length > 0 ? available : pool;
  if (candidates.length === 0) {
    return {
      id: "fallback",
      type,
      level: "Chill",
      text:
        type === "truth"
          ? "Tell your favorite childhood memory."
          : "Do 5 jumping jacks with a smile!",
    };
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex]!;
}
