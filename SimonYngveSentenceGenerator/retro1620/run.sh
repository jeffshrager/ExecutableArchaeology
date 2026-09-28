#!/bin/sh
# Rebuild the 1620 deck from ../ysimon.card and run it on the headless
# retro-1620 emulator. RETRO1620 = path to the retro-1620 fork checkout.
set -e
: "${RETRO1620:=$HOME/Desktop/AIHistory/IPL-V/retro-1620-fork}"
cd "$(dirname "$0")"
python3 adapt.py ../ysimon.card ../ysimon-fixed.card
I="$RETRO1620/software/IPL-V"
node "$RETRO1620/tools/cli/run1620.mjs" --quiet --timeout 600000 \
    "$I/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-1.card" ../ysimon-fixed.card \
    "$I/IPL-V-Subroutines.card" "$I/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-2.card" \
    > punch_output.txt
python3 decode.py punch_output.txt
