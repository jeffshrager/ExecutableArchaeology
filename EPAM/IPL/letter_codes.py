#!/usr/bin/env python3
"""Reconstruct EPAM II letter codes from its letter net U1.

The P-1817 listing gives only one letter code, Q1 = A = 10001100010111
(p. 149; "No specific data inputs are shown, with the exception of an example
of a capital letter code", p. 133). But it also gives U1, the "SORTING NET FOR
CAPITAL LETTERS": 26 terminals X1-X26, which the dictionary X0 maps to the
letters L1-L26. Every testing point of U1 runs Z0 on line 1, bit A5, and goes
to its minus branch on a 1 (J3) and its plus branch on a 0 (J4) (P-1817
§3.5.1.2).

So for each letter, the path to its terminal fixes the value of every bit it
tests. This script reconstructs each code as: the bits fixed by the path, and
0 for every bit the path does not test. A keeps its historical code. Every code
is then sorted through U1 to check that it reaches its own letter.

Output: letter_codes.txt, lines "<letter> <14 bits> <bits fixed by U1>".

Usage: letter_codes.py [epamfixed.card]
"""
import re, sys

deck = sys.argv[1] if len(sys.argv) > 1 else 'epamfixed.card'
cards = [l.ljust(80) for l in open(deck).read().split('\n') if l]


def norm(s):
    s = s.strip()
    if re.fullmatch(r'9\d+', s):
        return '9-' + s[1:]
    if re.fullmatch(r'0+', s):
        return '0'
    m = re.fullmatch(r'([A-Z])0*(\d+)', s)
    return m.group(1) + m.group(2) if m else s


# Lists of U1 (its locals) and of X0, as name -> [symbols after the head]
blocks, cur, routine = {}, None, None
for c in cards:
    if c[40] in '159':
        continue
    name, sy, lk = norm(c[42:47]), norm(c[50:55]), norm(c[56:61])
    if name and not name.startswith('9-'):
        routine = name
    if name:
        cur = (routine, name)
        blocks[cur] = [sy]
    elif cur:
        blocks[cur].append(sy)
    if lk == '0':
        cur = None


def lst(routine, name):
    b = blocks[(routine, name)]
    return b[0], b[1:]


def desc(routine, name):
    head, _ = lst(routine, name)
    _, items = lst(routine, head)
    return dict(zip(items[0::2], items[1::2]))


paths = {}                                       # X-number -> {bit: value}


def walk(name, fixed):
    _, items = lst('U1', name)
    d = desc('U1', name)
    if d.get('A0') == 'J3':
        paths[int(d['A1'][1:])] = fixed
        return
    bit = int(d['A5'][1:])
    walk(items[1], {**fixed, bit: 1})            # minus branch: bit is 1
    walk(items[2], {**fixed, bit: 0})            # plus branch: bit is 0


walk('U1', {})
assert sorted(paths) == list(range(1, 27)), sorted(paths)


def sort(code):
    name = 'U1'
    while True:
        _, items = lst('U1', name)
        d = desc('U1', name)
        if d.get('A0') == 'J3':
            return int(d['A1'][1:])
        name = items[1] if code[int(d['A5'][1:]) - 1] == '1' else items[2]


HISTORICAL = {'A': '10001100010111'}
out = []
for k in range(1, 27):
    letter = chr(ord('A') + k - 1)
    fixed = paths[k]
    code = HISTORICAL.get(letter) or ''.join(str(fixed.get(b, 0)) for b in range(1, 15))
    for b, v in fixed.items():
        assert code[b - 1] == str(v), (letter, b)
    assert sort(code) == k, (letter, code, sort(code))
    out.append('%s %s %s' % (letter, code, ''.join(
        str(fixed[b]) if b in fixed else '.' for b in range(1, 15))))
open('letter_codes.txt', 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
print('all 26 codes sort to their own letter through U1')
