#!/usr/bin/env python3
"""Make heuristic-run.card, the runnable variant of the faithful deck.

heuristic.card (built from transcription/ by transcription/build.py) is
the faithful transcription and is never edited by hand. Every change
needed to run it is made here, so each one is documented and repeatable.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'heuristic.card')
OUT = os.path.join(HERE, 'heuristic-run.card')
OUT_SDSC = os.path.join(HERE, 'heuristic-run-sdsc.card')


def card(name='', pq='', symb='', link='', typ='', comment='', ident=''):
    line = [' '] * 80

    def put(col, text):
        for i, ch in enumerate(text):
            line[col - 1 + i] = ch

    put(6, comment)
    put(41, typ)
    put(43, name)
    put(49, pq)
    put(51, symb)
    put(61 - len(link) + 1, link)
    put(80 - len(ident) + 1, ident)
    return ''.join(line).rstrip()


def main():
    cards = open(SRC).read().splitlines()
    # 1. U126 ("ENTER DSCN IN PRINT LINE", called from U128 100) is not in
    #    the listing: U125 is followed by U127. This is a RECONSTRUCTION,
    #    not Simon's code. Input (0) is a routine; it enters the BCD
    #    fragments of the process of its DSCN (X20 -> X30) in the print
    #    line, and "( )" for each argument slot (X31). The text is only as
    #    good as the 5-character fragments, whose trailing blanks the
    #    listing cannot show.
    u126 = [
        card('U126', '10', 'X20', comment='RECONSTRUCTED. ENTER DSCN OF (0)', ident='ADAPT 101'),
        card('', '', 'J10', ident='ADAPT 102'),
        card('', '70', 'J8', comment='NO DSCN, QUIT', ident='ADAPT 103'),
        card('', '10', 'X30', ident='ADAPT 104'),
        card('', '', 'J10', comment='PROCESS OF DSCN', ident='ADAPT 105'),
        card('', '70', 'J8', ident='ADAPT 106'),
        card('', '10', '9-1', ident='ADAPT 107'),
        card('', '', 'J100', '0', comment='ENTER EACH FRAGMENT', ident='ADAPT 108'),
        card('9-1', '40', 'H0', ident='ADAPT 109'),
        card('', '10', 'X31', ident='ADAPT 110'),
        card('', '', 'J2', comment='ARGUMENT SLOT', ident='ADAPT 111'),
        card('', '70', '9-2', ident='ADAPT 112'),
        card('', '30', 'H0', ident='ADAPT 113'),
        card('', '10', '9-3', ident='ADAPT 114'),
        card('9-2', '', 'J157', 'J4', ident='ADAPT 115'),
        card('9-3', '21', '( )', ident='ADAPT 116'),
    ]
    c_header = next(i for i, c in enumerate(cards) if c.endswith('000 000 C'))
    cards[c_header:c_header] = u126

    # 2. The listing has no start card. T1 runs the demonstrations of the
    #    1963 paper (X102, X105, X100, J77), so start there.
    write(OUT, cards + [card(typ='5', symb='T1', comment='START AT T1 (ADDED)', ident='ADAPT 001')])

    # EXPERIMENT (separate deck): X105 (J3, SET H5 MINUS) has both a DSCN
    # and an SDSC. U136 always prefers the DSCN, U134 finds no routine with
    # the same process, and U135 gives up, so the faithful run never tries
    # the state description compiler. This deck erases X105's DSCN first
    # (J14), so T1 compiles J3 from its state description, as in the paper.
    write(OUT_SDSC, cards + [
        card(typ='5', pq='00', comment='EXPERIMENT. NOT IN LISTING', ident='ADAPT 201'),
        card('Z0', '10', 'X105', comment='ERASE DSCN OF X105', ident='ADAPT 202'),
        card('', '10', 'X20', ident='ADAPT 203'),
        card('', '', 'J14', 'T1', comment='THEN RUN T1', ident='ADAPT 204'),
        card(typ='5', symb='Z0', comment='START AT Z0', ident='ADAPT 205')])


def write(path, cards):
    with open(path, 'w') as f:
        f.write('\n'.join(cards) + '\n')
    print(f'{len(cards)} cards -> {os.path.relpath(path)}')


if __name__ == '__main__':
    main()
