#!/usr/bin/env python3
"""Build heuristic.card from the per-page transcriptions.

Each transcription file pNN.txt (NN = scan page) holds one card per line
as eight '|'-separated fields, in the order they appear on the listing:

    comment | type | name | sign | pq | symb | link | id

The common case, a card with no type and no sign, may instead be written
in the 6-field short form

    comment | name | pq | symb | link | id

Fields may be empty. Lines starting with '#' are transcriber notes and
are not cards. A one-character PQ is a Q with blank P (as in the
listing's "1L101"). Cards are laid out in the standard columns: comment
1-40 (text from col 6), type 41, name 43-47, sign 48, PQ 49-50, SYMB
51-55, LINK 57-61 (right-justified), id 71-80 (right-justified, so the
listing's "C"/"D" section suffix ends in col 80).

Page 41 duplicates page 40 in the scan and is skipped.
"""
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'heuristic.card')
SKIP = {'p41.txt'}


def card(fields, where):
    if len(fields) == 6:
        fields = [fields[0], '', fields[1], ''] + fields[2:]
    if len(fields) != 8:
        sys.exit(f'{where}: expected 6 or 8 fields, got {len(fields)}: {fields}')
    comment, typ, name, sign, pq, symb, link, ident = (f.strip() for f in fields)
    for label, val, width in (('comment', comment, 35), ('type', typ, 1), ('name', name, 5),
                              ('sign', sign, 1), ('pq', pq, 2), ('symb', symb, 5),
                              ('link', link, 5), ('id', ident, 10)):
        if len(val) > width:
            sys.exit(f'{where}: {label} {val!r} is wider than {width}')
    # SYMB keeps its leading blanks for alphanumeric terms, so take it raw.
    raw_symb = fields[5].rstrip() if pq.endswith('21') else symb
    line = [' '] * 80

    def put(col, text):
        for i, ch in enumerate(text):
            line[col - 1 + i] = ch

    put(6, comment)
    put(41, typ)
    put(43, name)
    put(48, sign)
    put(49, pq.rjust(2) if pq else '')
    put(51, raw_symb[:5])
    put(61 - len(link) + 1, link)
    put(80 - len(ident) + 1, ident)
    return ''.join(line).rstrip()


def main():
    files = sorted(glob.glob(os.path.join(HERE, 'p[0-9][0-9].txt')))
    cards = []
    for path in files:
        if os.path.basename(path) in SKIP:
            continue
        with open(path) as f:
            for n, raw in enumerate(f, 1):
                raw = raw.rstrip('\n')
                if not raw.strip() or raw.lstrip().startswith('#'):
                    continue
                cards.append(card(raw.split('|'), f'{os.path.basename(path)}:{n}'))
    with open(OUT, 'w') as f:
        f.write('\n'.join(cards) + '\n')
    print(f'{len(cards)} cards from {len(files)} pages -> {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
