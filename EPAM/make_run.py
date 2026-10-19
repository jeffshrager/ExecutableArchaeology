#!/usr/bin/env python3
"""Make epam2-run.card, a runnable EPAM II deck, from epamfixed.card.

epamfixed.card is the earlier transcription of the EPAM II listing in the
appendix of Feigenbaum, P-1817 (RAND, 9 Oct 1959), pp. 133ff, kept exactly as
transcribed. This script makes the changes needed to run it on the Lisp IPL-V
(../IPL-V/iplv.lisp). Each change was checked against the P-1817 appendix:

  1. Spelling of symbols:
     - termination written 0000 (as the listing prints it) becomes 0. The
       card reader takes only "0" or blank as the termination symbol.
     - leading zeros in the number part of a symbol are dropped: U0002 = U2
       (defined U0002, referenced U2), J0003 = J3, A0000 = A0, and so on.
     - OCR letter O for zero in names: DO -> D0 (card ID D0001), 09 -> D9
       (card ID D0909), PO -> P0 (card ID P0001).
  2. D0 is patched (3 cards, marked PATCH): it skips "ASSIGN TRACKING LIST
     TO RESPONSE" (D00 34-36, J11) when the response is a data term. In the
     letter dictionary X0 every response is an alphanumeric data term (X1 ->
     L1 = "A"), which has no description list; on a real IPL-V the J11 would
     write into whatever the packed letter addressed. EPAM II was only
     hand-simulated, so the writer D1 (whose letters all take this path) never
     ran. Responses that are lists (images) are unaffected.
  3. P0 is defined twice in the listing, both with card ID P0001: N1 N3 N2
     ("NOTICING ORDER FOR LINES") and N1 ("NOTICING ORDER"). A loader keeps
     the last. --p0 lines (default) keeps N1 N3 N2, the order used in the
     rote-learning experiments of P-1817 section 4.1; --p0 single keeps N1.
  4. Section headers: the transcription has none. The integers N0-N20 are
     put in a data section (type 5, Q=1) so their values load as numbers;
     everything else stays a routine section, which loads lists the same way.
  5. *0, E13's scratch cell (E13 is the body of EPAM's own J190-J199,
     "advance Wn"), is defined as an empty cell. The listing never defines
     it; the Lisp IPL-V creates undefined regionals only for letter+digit
     names, not for the * region.
  6. The start card the earlier transcriber added (Z1, which is only a net
     test) is removed. The driver deck given with --driver is appended
     instead; it is not part of EPAM II (see its own comment cards).

Usage: make_run.py [--driver FILE] [--p0 lines|single] [src] [dst]
       (defaults: epamfixed.card -> epam2-run.card)
"""
import re, sys

args = sys.argv[1:]
driver = None
p0 = 'lines'
if '--driver' in args:
    i = args.index('--driver'); driver = args[i + 1]; del args[i:i + 2]
if '--p0' in args:
    i = args.index('--p0'); p0 = args[i + 1]; del args[i:i + 2]
src = args[0] if args else 'epamfixed.card'
dst = args[1] if len(args) > 1 else 'epam2-run.card'

NAME_FIX = {'DO': 'D0', '09': 'D9', 'PO': 'P0'}


def fix(sym):
    s = sym.strip()
    if not s:
        return s
    if re.fullmatch(r'0+', s):
        return '0'
    m = re.fullmatch(r'([A-Z])0+(\d+)', s)          # U0002 -> U2, A0000 -> A0
    if m:
        return m.group(1) + str(int(m.group(2)))
    return NAME_FIX.get(s, s)


def card(comment='', typ='', name='', pq='', symb='', link='', ident=''):
    s = ('     ' + comment).ljust(40) + typ.ljust(1) + ' ' + name.ljust(5) + ' '
    s += pq.ljust(2) + symb.ljust(5) + ' ' + link.ljust(5) + ' ' * 9 + ident.ljust(10)
    return s.rstrip()


HEADER = [
    'EPAM II RUN DECK, MADE BY MAKE_RUN.PY',
    'FROM EPAMFIXED.CARD (P-1817 APPX).',
    '0000 TO 0. LEADING ZEROS DROPPED.',
    'DO D0, 09 D9, PO P0 (OCR O FOR 0).',
    'D0 PATCHED. NO J11 ON A DATA TERM.',
    'P0 = ' + ('N1 N3 N2 (SEC 4.1)' if p0 == 'lines' else 'N1 (SINGLE LINE)') + '.',
    'N0-N20 IN A DATA SECTION.',
    'ADDED Z1 START CARD REMOVED.',
    '*0 (E13 SCRATCH CELL) DEFINED.',
]

lines = open(src).read().split('\n')
out = [card(h, '1') for h in HEADER] + [card('ROUTINES AND LISTS', '5', pq='00')]
in_n = False
p0_seen = 0
skip_block = False
for ln in lines:
    if not ln.strip():
        continue
    b = ln.ljust(80)
    typ, name, pq = b[40], b[42:47].strip(), b[48:50]
    if typ == '5' or 'ADDED EXEC START' in b:
        continue                                   # drop the added start card
    if typ == '1':
        out.append(ln)
        continue
    # the two P0 definitions
    if name in ('PO', 'P0'):
        p0_seen += 1
        keep = (p0_seen == 1) == (p0 == 'lines')
        skip_block = not keep
        if skip_block:
            out.append(card('OTHER P0 OF LISTING DROPPED', '1', ident=b[70:80].strip()))
    elif name:
        skip_block = False
    if skip_block:
        continue
    # integers N0-N20 go in a data section
    is_n = bool(re.fullmatch(r'N\d+', fix(name))) and pq == '01'
    if is_n and not in_n:
        out.append(card('INTEGERS', '5', pq='01')); in_n = True
    if in_n and not is_n:
        out.append(card('ROUTINES AND LISTS', '5', pq='00')); in_n = False
    symb, link = b[50:55], b[56:61]
    if pq == '21':
        nsymb = symb.rstrip()                      # alphanumeric: keep as is
    elif is_n:
        nsymb, link = '', str(int(symb.strip() + link.strip() or '0')).rjust(5)
    else:
        nsymb = fix(symb)
    nlink = link if is_n else fix(link)
    ident = b[70:80].strip()
    if ident == 'D00 37':                          # D0 patch: label the exit
        name = '990'
    new = b[:42] + fix(name).ljust(5) + b[47:50] + nsymb.ljust(5) + ' ' + nlink.ljust(5) + b[61:]
    out.append(new.rstrip())
    if ident == 'D00 33':                          # D0 patch: skip J11 on a data term
        out.append(card('PATCH. RESPONSE (W1) A DATA TERM?', '', '', '11', 'W1', '', 'PATCH 1'))
        out.append(card('PATCH. IF SO SKIP THE J11', '', '', '00', 'J131', '', 'PATCH 2'))
        out.append(card('PATCH.', '', '', '70', '', '990', 'PATCH 3'))
if in_n:
    out.append(card('ROUTINES AND LISTS', '5', pq='00'))
out.append(card('*0 SCRATCH CELL OF E13 (NOT IN', '1'))
out.append(card('LISTING). EMPTY.', '', '*0', '00', '0', '0'))
if driver:
    out += open(driver).read().rstrip('\n').split('\n')
open(dst, 'w').write('\n'.join(out) + '\n')
print('%d cards -> %s' % (len(out), dst))
