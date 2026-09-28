#!/usr/bin/env python3
"""Decode the card-punch output of ysimon-1620.ipl.

C1's trace punches every symbol it expands (A.., B..) and C2 punches each
random draw (an integer data term, type 01). The adapted C3 punches, per word,
the word symbol (B..) and then its fragments (alphanumeric data terms, type 81).
Fragments are joined into words; a run of words is one sentence.
Usage: decode.py punch.txt [--trace]
"""
import re, sys

sym = re.compile(r'^\s+([A-Z]\d+)\s*$')
alpha = re.compile(r'^\s+\d{7}\s+81\s+(\S+)\s*$')
num = re.compile(r'^\s+\d{7}\s+01\s+(-?\d+)\s*$')

sentences, words, trace, in_c3 = [], [], [], False
for line in open(sys.argv[1]):
    line = line.rstrip('\n')
    m = alpha.match(line)
    if m:
        if not in_c3:              # first fragment: the B.. just seen starts C3
            in_c3 = True
            words = [''] if trace and trace[-1].startswith('B') else []
            if trace: trace.pop()
        words[-1] += m.group(1)
        continue
    m = sym.match(line)
    if m and in_c3 and m.group(1).startswith('B'):
        words.append('')
        continue
    if in_c3:
        sentences.append((' '.join(words), trace))
        in_c3, trace = False, []
    if m:
        trace.append(m.group(1))
    elif num.match(line):
        trace.append('[%s]' % num.match(line).group(1))
if in_c3:
    sentences.append((' '.join(words), trace))

for i, (s, t) in enumerate(sentences, 1):
    print('%2d. %s' % (i, s))
    if '--trace' in sys.argv:
        print('    ' + ' '.join(t))
if trace and not in_c3:
    print('(unfinished derivation at end: %s)' % ' '.join(trace[-40:]))
