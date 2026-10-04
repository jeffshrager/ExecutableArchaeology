#!/bin/sh
# Run an IPL-V program deck on W. T. Beyer's 1963 IBM 1620 IPL-V (Mod-3-4)
# in the headless retro-1620 emulator. The hopper is: interpreter deck 1,
# the program, the IPL-coded J-function library, interpreter deck 2.
#   run-ipl.sh my.card [run1620 options]   e.g. --switches 2 --timeout 600000
# Typewriter and punch output go to stdout, status to stderr.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
deck="$1"; shift
I="$here/software/IPL-V"
exec node "$here/tools/cli/run1620.mjs" --quiet --timeout 600000 "$@" \
    "$I/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-1.card" "$deck" \
    "$I/IPL-V-Subroutines.card" "$I/Mod-3-4/IPL-V-Interpreter-Mod-3-4-Deck-2.card"
