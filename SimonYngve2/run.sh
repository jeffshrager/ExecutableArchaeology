#!/bin/sh
# Run the Simon/Yngve generator (ysimon.card) on the Lisp IPL-V, ../IPL-V/iplv.lisp.
#   run.sh                      20 sentences, seed 53, as in 1962
#   run.sh --count 5 --seed 7   change N20 (sentences) and N0 (random seed)
# Writes yngve-lisp.out (raw output: trace and print lines), printout.txt
# (just the lines C3 printed) and sentences.txt (decoded, with derivations).
set -e
cd "$(dirname "$0")"
python3 - ysimon.card ysimon-run.card "$@" <<'PY'
import sys
src, dst, args = sys.argv[1], sys.argv[2], sys.argv[3:]
opt = {'--count': 'N20', '--seed': 'N0'}
vals = {opt[a]: str(int(args[i + 1])) for i, a in enumerate(args) if a in opt}
out = []
for ln in open(src).read().split('\n'):
    b = ln.ljust(80)
    name = b[42:47].strip()
    if name in vals and b[48:50] == '01':
        ln = (b[:50] + ' ' * 6 + vals[name].rjust(5)).rstrip()
    out.append(ln)
open(dst, 'w').write('\n'.join(out))
PY
sbcl --non-interactive --load run-yngve.lisp > yngve-lisp.out 2>&1
rm -f ysimon-run.card iplv.fasl
grep '^::::' yngve-lisp.out | sed 's/^:* //; s/ *$//' > printout.txt
python3 decode.py yngve-lisp.out --trace > sentences.txt
grep -v '^    ' sentences.txt
