#!/usr/bin/env python3
"""Build annexer.card from the per-page transcription of RM-3588-PR Appendix B.

Each transcription file pNNN.txt (NNN = memo page) holds one card per line:

    address | comment | name | pq | symb | link | id                (7 fields)
    address | comment | type | name | sign | pq | symb | link | id  (9 fields)

The address is the machine address the 1963 loader printed at the left of
the listing; it is kept here as evidence but is not part of the card.
Lines starting with '#' are transcriber notes. Card columns are those of
../transcription/build.py.
"""
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'transcription'))
from build import card  # noqa: E402

OUT = os.path.join(HERE, 'annexer.card')


def main():
    cards = []
    files = sorted(glob.glob(os.path.join(HERE, 'transcription', 'p[0-9][0-9][0-9].txt')))
    for path in files:
        for n, raw in enumerate(open(path), 1):
            raw = raw.rstrip('\n')
            if not raw.strip() or raw.lstrip().startswith('#'):
                continue
            f = raw.split('|')
            where = f'{os.path.basename(path)}:{n}'
            if len(f) == 7:
                f = f[1:]
            elif len(f) == 9:
                f = f[1:]
            else:
                sys.exit(f'{where}: expected 7 or 9 fields, got {len(f)}')
            cards.append(card(f, where))
    with open(OUT, 'w') as out:
        out.write('\n'.join(cards) + '\n')
    print(f'{len(cards)} cards from {len(files)} pages -> {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
