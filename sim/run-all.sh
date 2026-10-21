#!/usr/bin/env bash
# Plays complete games of every game type against an in-memory fake database (no Supabase needed).
# Usage: bash sim/run-all.sh      (uses `npx tsx`, nothing is added to package.json)
cd "$(dirname "$0")/.." || exit 1
status=0
for f in imposter worduel numberguess party chess ludo; do
  echo "######## $f"
  out=$(npx --yes tsx --tsconfig sim/tsconfig.json sim/$f.sim.ts 2>&1)
  echo "$out" | grep -E '^(PASS|FAIL|==)|rror' 
  echo "$out" | grep -qE '^FAIL|rror:' && status=1
done
[ $status -eq 0 ] && echo -e "\nALL CHECKS PASSED" || echo -e "\nSOME CHECKS FAILED"
exit $status
