#!/bin/sh
# Rebuild a 1620 deck from ../ysimon.card and run it on the headless
# retro-1620 emulator. RETRO1620 = path to the headless 1620
# (default ../../HeadlessIBM1620IPL-V, or a retro-1620 fork checkout).
#   run.sh          ysimon-fixed.card: punched output with the trace
#   run.sh fast     ysimon-fast.card: typewriter output, sentences only
# Extra arguments are passed to adapt.py, e.g. run.sh fast --count 5 --seed 7
set -e
: "${RETRO1620:=$(cd "$(dirname "$0")/../../HeadlessIBM1620IPL-V" && pwd)}"
cd "$(dirname "$0")"
if [ "$1" = fast ]; then
    shift
    deck=../ysimon-fast.card; out=fast_typewriter_output.txt; sents=fast_sentences.txt
    python3 adapt.py ../ysimon.card "$deck" --fast "$@"
else
    deck=../ysimon-fixed.card; out=punch_output.txt; sents=sentences.txt
    python3 adapt.py ../ysimon.card "$deck" "$@"
fi
I="$RETRO1620/software/IPL-V"
node "$RETRO1620/tools/cli/run1620.mjs" --quiet --timeout 600000 \
    "$I/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-1.card" "$deck" \
    "$I/IPL-V-Subroutines.card" "$I/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-2.card" \
    > "$out.tmp"
if [ "$out" = fast_typewriter_output.txt ]; then
    tail -n +3 "$out.tmp" > "$out"     # drop the driver's header: exactly what was typed
else
    mv "$out.tmp" "$out"
fi
rm -f "$out.tmp"
python3 decode.py "$out" --trace > "$sents"
cat "$sents"
