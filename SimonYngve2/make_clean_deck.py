#!/usr/bin/env python3
"""Make ysimon-clean.card, a quiet, readable version of the Simon/Yngve generator
for the Lisp IPL-V, from the faithful transcription ysimon.card.

The grammar, C0, C1 and C2 are Simon's, except:
  1. The four unnumbered trace cards (40H0 / J152 in C1, 40H0 / J153 in C2)
     are removed, so the run prints only sentences.
  2. B41 PROUD. loses its stray period (the fragment D. becomes D).
  3. C3, the printer, is replaced by C3-C9 below. It prints each sentence
     from column 1, wraps at word boundaries (a word is never split), joins
     the comma and the plural S to the word before them (BOILERS, WATER,),
     ends the sentence with a period, and leaves a blank line after it.
  4. New data: N2 is the period, L3 and L4 are empty work lists.

How C3 works. A "unit" is a list of fragments printed with no spaces in it:
an ordinary word, plus any comma or S that follows it, plus the period at the
end of the sentence. C4 builds the units of the sentence (on L1) into L3. C5
prints each unit: it enters the unit's fragments with J157, which enters
nothing and sets H5- when a fragment does not fit. On a misfit, the line is
cleared and rebuilt from L4 (the units already on it), printed, and the unit
starts the next line. Words are at most 12 characters, so a unit always fits
on an empty line.

Usage: make_clean_deck.py [src] [dst] [--count N] [--seed N] [--faithful]
       (default ysimon.card -> ysimon-clean.card)
--faithful copies the deck unchanged except for --count/--seed (run.sh uses
it to run the faithful deck with other settings).
"""
import sys

args = sys.argv[1:]
faithful = '--faithful' in args
if faithful:
    args.remove('--faithful')
opts = {}
for o in ('--count', '--seed'):
    if o in args:
        i = args.index(o)
        opts[o] = str(int(args[i + 1]))
        del args[i:i + 2]
src = args[0] if args else 'ysimon.card'
dst = args[1] if len(args) > 1 else 'ysimon-clean.card'


def card(comment='', name='', pq='', symb='', link='', typ=' ', sign=' '):
    assert len(comment) <= 35, comment
    s = ('     ' + comment).ljust(40) + typ + ' ' + name.ljust(5) + sign
    s += pq.ljust(2) + symb.ljust(6) + link
    return s.rstrip()


C = card
PRINTER = [
    C('C3. PRINT SENTENCE ON L1', 'C3', '10', 'L1'),
    C('BUILD ITS UNITS ON L3', '', '10', 'C4'),
    C('', '', '00', 'J100'),
    C('PERIOD JOINS THE LAST UNIT', '', '10', 'N2'),
    C('', '', '10', 'L3'),
    C('', '', '00', 'J61'),
    C('', '', '52', 'H0'),
    C('', '', '00', 'J6'),
    C('', '', '00', 'J65'),
    C('PRINT THE UNITS, WRAPPING', '', '00', 'J154'),
    C('', '', '10', 'L3'),
    C('', '', '10', 'C5'),
    C('', '', '00', 'J100'),
    C('PRINT LAST LINE', '', '00', 'J155'),
    C('THEN A BLANK LINE', '', '00', 'J154'),
    C('', '', '00', 'J155'),
    C('ERASE THE UNITS', '', '10', 'L3'),
    C('', '', '10', 'C9'),
    C('', '', '00', 'J100'),
    C('EMPTY L3, L4 AND L1', '', '10', 'L3'),
    C('KEEPING THEIR HEADS', '', '00', 'J75'),
    C('', '', '00', 'J71'),
    C('', '', '10', 'L4'),
    C('', '', '00', 'J75'),
    C('', '', '00', 'J71'),
    C('', '', '10', 'L1'),
    C('', '', '00', 'J75', 'J71'),

    C('C4. ADD WORD (0) TO UNITS ON L3', 'C4', '40', 'H0'),
    C('COMMA JOINS THE UNIT BEFORE', '', '10', 'B37'),
    C('', '', '00', 'J2'),
    C('', '', '70', '', '9-1'),
    C('SO DOES PLURAL S', '', '40', 'H0'),
    C('', '', '10', 'B47'),
    C('', '', '00', 'J2'),
    C('', '', '70', '', '9-1'),
    C('ELSE NEW UNIT AT END OF L3', '', '00', 'J90'),
    C('', '', '40', 'H0'),
    C('', '', '10', 'L3'),
    C('', '', '00', 'J6'),
    C('', '', '00', 'J65', '9-2'),
    C('TARGET IS LAST UNIT ON L3', '9-1', '10', 'L3'),
    C('', '', '00', 'J61'),
    C('', '', '52', 'H0'),
    C('COPY FRAGMENTS OF (1) TO (0)', '9-2', '00', 'J50'),
    C('', '', '10', 'C6'),
    C('', '', '00', 'J100'),
    C('', '', '00', 'J30', 'J4'),

    C('C5. PRINT UNIT (0), WRAPPING', 'C5', '40', 'H0'),
    C('ENTER FRAGMENTS, H5- IF NO FIT', '', '10', 'J157'),
    C('', '', '00', 'J100'),
    C('', '', '70', '', '9-1'),
    C('NO FIT. REBUILD LINE FROM L4', '', '00', 'J154'),
    C('', '', '10', 'L4'),
    C('', '', '10', 'C7'),
    C('', '', '00', 'J100'),
    C('PRINT IT, START A NEW LINE', '', '00', 'J155'),
    C('', '', '00', 'J154'),
    C('', '', '10', 'L4'),
    C('', '', '00', 'J75'),
    C('', '', '00', 'J71'),
    C('UNIT STARTS THE NEW LINE', '', '40', 'H0'),
    C('', '', '00', 'C8'),
    C('FITS. SPACE, NOTE UNIT ON L4', '9-1', '10', 'N1'),
    C('', '', '00', 'J161'),
    C('', '', '10', 'L4'),
    C('', '', '00', 'J6'),
    C('', '', '00', 'J65', 'J4'),

    C('C6. PUT (0) AT END OF LIST W0', 'C6', '11', 'W0'),
    C('', '', '00', 'J6'),
    C('', '', '00', 'J65', 'J4'),

    C('C7. ENTER UNIT (0) AND A SPACE', 'C7', '00', 'C8'),
    C('', '', '10', 'N1'),
    C('', '', '00', 'J161', 'J4'),

    C('C8. ENTER FRAGMENTS OF UNIT (0)', 'C8', '10', 'J157'),
    C('', '', '00', 'J100', 'J4'),

    C('C9. ERASE UNIT (0)', 'C9', '00', 'J71', 'J4'),
]

HEADER = [
    'CLEAN VERSION FOR LISP IPL-V',
    'MADE BY MAKE_CLEAN_DECK.PY FROM',
    'YSIMON.CARD. TRACE CARDS REMOVED.',
    'C3 REPLACED BY C3-C9. PRINTS EACH',
    'SENTENCE FROM COL 1, WRAPS AT WORD',
    'BOUNDARIES, JOINS , AND S TO THE',
    'WORD BEFORE, ENDS WITH A PERIOD.',
    'B41 PROUD. LOSES ITS STRAY PERIOD.',
]

lines = open(src).read().split('\n')
if lines and lines[-1] == '':
    lines.pop()
out, i = [], 0
while i < len(lines):
    ln = lines[i]
    b = ln.ljust(80)
    name, pq = b[42:47].strip(), b[48:50]
    if name in ('N20', 'N0') and pq == '01':
        o = '--count' if name == 'N20' else '--seed'
        if o in opts:
            ln = (b[:50] + ' ' * 6 + opts[o].rjust(5)).rstrip()
    if faithful:
        out.append(ln)
        i += 1
        continue
    if 'TRACE (UNNUMBERED IN ORIGINAL)' in ln:
        i += 1
        continue
    if name == 'C3' and b[40] == ' ':
        while not lines[i].strip().startswith('DATA'):
            i += 1
        out.extend(PRINTER)
        continue
    if b[40] == '5' and pq == '00' and not b[50:55].strip():
        out.extend(card(h, typ='1') for h in HEADER)
    if name == '9-1' and b[50:55] == 'D.   ' and out[-1][42:47].strip() == '9-0' \
            and 'PROU' in out[-1]:
        ln = b[:50] + 'D    ' + b[55:]
        ln = ln.rstrip()
    if name == 'N1' and pq == '01':
        out.append(card('PERIOD AT SENTENCE END', 'N2', '21', '.', sign='+'))
        out.append(card('UNITS OF THE SENTENCE', 'L3', '00', '0', '0'))
        out.append(card('UNITS ON THE CURRENT LINE', 'L4', '00', '0', '0'))
    out.append(ln)
    i += 1

open(dst, 'w').write('\n'.join(out) + '\n')
