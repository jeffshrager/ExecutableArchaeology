#!/bin/sh
# Rebuild the decks and run the Heuristic Coder on the Lisp IPL-V.
# Writes run/t1.txt (faithful run) and run/t1-sdsc.txt (X105 DSCN erased).
set -e
cd "$(dirname "$0")"
python3 transcription/build.py
python3 adapt.py
mkdir -p run
cd lisp
sbcl --non-interactive --eval '(load (compile-file "iplv.lisp"))' >/dev/null 2>&1
for deck in run sdsc; do
  case $deck in run) card=heuristic-run.card; out=t1.txt;; sdsc) card=heuristic-run-sdsc.card; out=t1-sdsc.txt;; esac
  sbcl --non-interactive --eval '(load "iplv.fasl")' \
       --eval "(progn (set-trace-mode :none) (load-ipl \"../$card\" :adv-limit 400000))" 2>&1 \
    | grep '^::::' | sed 's/^:*//; s/ *$//' > ../run/$out
  echo "run/$out: $(wc -l < ../run/$out) lines"
done
rm -f iplv.fasl
