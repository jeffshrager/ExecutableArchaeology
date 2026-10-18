#!/bin/sh
# Run the Simon/Yngve generator on the Lisp IPL-V, ../IPL-V/iplv.lisp.
#
#   run.sh [--count N] [--seed N]
#       The faithful deck, ysimon.card, with Simon's trace and printer.
#       Writes yngve-lisp.out (raw output), printout.txt (just the lines C3
#       printed) and sentences.txt (decoded, with derivations).
#   run.sh clean [--count N] [--seed N]
#       ysimon-clean.card, made by make_clean_deck.py: no trace, and a new
#       printer that prints finished sentences. Writes clean_sentences.txt.
#
# --count sets N20 (number of sentences, default 20), --seed sets N0 (random
# seed, default 53 as in 1962).
set -e
cd "$(dirname "$0")"
if [ "$1" = clean ]; then
    shift
    python3 make_clean_deck.py ysimon.card ysimon-clean.card "$@"
    cp ysimon-clean.card ysimon-run.card
    # The deck prints nothing but sentences, so print lines need no marker:
    # *ipl-print-prefix* is "", and SBCL's banner, init file and compiler
    # messages are kept off stdout. Only the 80-column lines' trailing blanks
    # are trimmed.
    sbcl --noinform --non-interactive --no-userinit \
        --eval '(let ((*standard-output* (make-broadcast-stream)) (*error-output* (make-broadcast-stream))) (load (compile-file "../IPL-V/iplv.lisp" :output-file (merge-pathnames "iplv.fasl" (truename ".")))))' \
        --eval '(setf *ipl-print-prefix* "")' \
        --eval '(progn (set-trace-mode :none) (load-ipl "ysimon-run.card" :adv-limit 100000000))' \
        > ysimon-clean.out 2>&1 || { cat ysimon-clean.out; rm -f ysimon-run.card iplv.fasl; exit 1; }
    rm -f ysimon-run.card iplv.fasl
    sed 's/ *$//' ysimon-clean.out > clean_sentences.txt
    rm -f ysimon-clean.out
    cat clean_sentences.txt
    exit 0
fi
python3 make_clean_deck.py ysimon.card ysimon-run.card --faithful "$@"
sbcl --non-interactive --load run-yngve.lisp > yngve-lisp.out 2>&1
rm -f ysimon-run.card iplv.fasl
grep '^::::' yngve-lisp.out | sed 's/^:* //; s/ *$//' > printout.txt
python3 decode.py yngve-lisp.out --trace > sentences.txt
grep -v '^    ' sentences.txt
