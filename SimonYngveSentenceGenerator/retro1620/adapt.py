#!/usr/bin/env python3
"""Adapt ysimon.card (the faithful transcription) to Beyer's 1620 IPL-V.

Changes:
  1. Data terms: drop the sign in col 48; integer values right-justified in
     the LINK field (cols 57-61), as in raven.ipl / Ackermann-Fixed.
  2. C2 trace: J153 (not in the 1620 system) -> J152.
  5. L1 and L2 defined as empty data lists. On the 1620 an undefined
     regional symbol is not usable as an empty list.
  4. J82 -> C8 (J60 J60 J80). In Beyer's interpreter "J81 DS 12" follows
     "J80 DS ,J0+12*80" so J81-J83 label the J72-J74 table cells, and J82's
     internal call to J81 goes astray. J81 itself works only if J80 is
     loaded; the loader fills only J cells the program names, and C8 names
     J80.
  3. C3: the 1620 system has no print line (J155/J157/J160/J161). Replace the
     line printer with J152 per word symbol and per fragment (card punch).
     The pencil fix (10L1 / J75 J71) is kept.

With --fast: the unnumbered trace cards (40H0 / J152 in C1 and C2) are
dropped, and C0 first sets W20 (the print unit cell) to N1, a nonzero
integer, so Beyer's output routine types on the typewriter instead of
punching. Only the sentences are typed: one word fragment per line (the
word symbols are not typed), and C3 types a period (the symbol .0, in a new one-cell region) after each
sentence.

--seed N sets the random seed N0 (default 53, as in 1962). C0 moves N0's
name to W10, which J129 uses as its seed.

--count N sets the number of sentences N20 (default 20).

Usage: adapt.py src dst [--fast] [--seed N] [--count N]
"""
import re, sys

src, dst = sys.argv[1], sys.argv[2]
fast = '--fast' in sys.argv[3:]
seed = sys.argv[sys.argv.index('--seed') + 1] if '--seed' in sys.argv else None
count = sys.argv[sys.argv.index('--count') + 1] if '--count' in sys.argv else None
lines = open(src).read().split('\n')
if lines and lines[-1] == '':
    lines.pop()

def card(comment='', name='', pq='', symb='', link='', ident=''):
    s = ('     ' + comment).ljust(42) + name.ljust(6) + pq.ljust(2) + symb.ljust(6) + link
    if ident:
        s = s.ljust(72) + ident
    return s.rstrip()

NEW_C3 = [
    card('C3 FOR 1620. NO PRINT LINE. ' + ('TYPE' if fast else 'PUNCH'), 'C3', '10', '9-0', ident='C3040'),
    card('EACH WORD' + ('S FRAGMENTS' if fast else ' SYMBOL AND ITS FRAGMENTS'), '', '00', 'J100', ident='C3050'),
] + ([
    card('FAST. TYPE PERIOD AT SENTENCE END', '', '10', '.0'),
    card('', '', '00', 'J152'),
] if fast else []) + [
    card('ORIG 10L1 J71. PENCIL FIX FOLLOWS', '', '10', 'L1', ident='C3055'),
    card('PENCIL FIX. KEEP L1 HEAD', '', '00', 'J75', 'J71', ident='C3058'),
] + ([
    card('PER WORD. GENERATE ITS FRAGMENTS', '9-0', '10', '9-10'),
    card('', '', '00', 'J100', 'J4'),
] if fast else [
    card('PER WORD. PUNCH WORD SYMBOL', '9-0', '40', 'H0'),
    card('', '', '00', 'J152'),
    card('THEN GENERATE ITS FRAGMENTS', '', '10', '9-10'),
    card('', '', '00', 'J100', 'J4'),
]) + [
    card('PER FRAGMENT. ' + ('TYPE' if fast else 'PUNCH') + ' IT, H5+', '9-10', '00', 'J152', 'J4'),
    card('C8 = J82. BEYER J82 IS BROKEN', 'C8', '00', 'J60'),
    card('(ITS J81 LINK HITS THE J72 CELL)', '', '00', 'J60'),
    card('NAMING J80 ALSO LOADS IT FOR J81', '', '00', 'J80', '0'),
]

HEADER = [
    'FIXED VERSION FOR IBM 1620 IPL-V',
    'BEYER INTERPRETER, MOD-3-4 DECKS.',
    'DERIVED FROM YSIMON.CARD.',
    'DATA TERM SIGN COL 48 DROPPED. INTS',
    'RIGHT JUSTIFIED IN COLS 57-61.',
    'L1 AND L2 DEFINED AS EMPTY LISTS.',
    'J82 REPLACED BY C8 (J60 J60 J80)',
    'BECAUSE BEYER J82 IS BROKEN.',
    'C3 PUNCHES WORDS VIA J152 (NO',
    'PRINT LINE ON 1620). J153 TO J152.',
] + ([
    'FAST VERSION. TRACE CARDS REMOVED.',
    'C0 SETS W20 TO N1 (NONZERO) SO ALL',
    'OUTPUT GOES TO THE TYPEWRITER.',
    'WORD SYMBOLS ARE NOT TYPED, ONLY',
    'THE WORD FRAGMENTS.',
    'SENTENCES END WITH A PERIOD (.0).',
] if fast else [])

out, i = [], 0
word, elems = None, []          # current B word list and its element locals
while i < len(lines):
    if i > 0 and lines[i - 1].rstrip().endswith('SPLIT PER PENCIL FIX (C3058).      1'):
        out.extend(('     ' + h).ljust(40) + '1' for h in HEADER)
    ln = lines[i]
    if fast and 'TRACE (UNNUMBERED IN ORIGINAL)' in ln:
        i += 1
        continue
    body = ln.ljust(80)
    name, pq = body[42:47].strip(), body[48:50]
    if fast and name == 'C0' and body[40] == ' ':
        out.append(card('W20 = N1. OUTPUT TO TYPEWRITER', 'C0', '10', 'N1'))
        out.append(card('INSTEAD OF CARD PUNCH', '', '20', 'W20'))
        ln = (body[:42] + ' ' * 5 + body[47:]).rstrip()
        body = ln.ljust(80)
        name = ''
    if fast and body[40] == '2' and name == 'T0':
        out.append(ln)
        out.append(' ' * 40 + '2 .0    00      1')
        i += 1
        continue
    if body[40] == ' ' and re.fullmatch(r'B\d+', name):
        word, elems = name, []
    elif word and not name and body[48:50] == '00' and body[50:55].startswith('9-'):
        elems.append(body[50:55].strip())
    elif name and not name.startswith('9-'):
        word = None
    # C3: replace from its first card to the card before the DATA header
    if name == 'C3':
        while not lines[i].strip().startswith('DATA'):
            i += 1
        out.extend(NEW_C3)
        continue
    if body[47] == '+' and pq in ('01', '21'):
        if pq == '01':
            val = body[50:62].strip()
            if seed is not None and name == 'N0':
                val = str(int(seed))
            if count is not None and name == 'N20':
                val = str(int(count))
            ln = card(ln[:42].strip(), name, '01', '', '').ljust(56) + val.rjust(5)
        else:
            ln = body[:47] + ' ' + body[48:]
        ln = ln.rstrip()
    if body[48:53] == '00J82':
        ln = ln.replace('00J82', '00C8 ')
    if body[48:54] == '00J153':
        ln = ln.replace('00J153', '00J152')
    if name == 'N1' and pq == '01' or (body[47] == '+' and name == 'N1'):
        out.append(card('L1 OUTPUT, L2 TEMP MEMORY. EMPTY', 'L1', '00', '0', '0'))
        out.append(card('LISTS MUST BE DEFINED ON 1620', 'L2', '00', '0', '0'))
    out.append(ln)
    i += 1

open(dst, 'w').write('\n'.join(out) + '\n')
