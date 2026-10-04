#!/usr/bin/env python3
"""Decode the output of ysimon.card run on the Lisp IPL-V (run-yngve.lisp).

C1's trace prints each symbol it expands (J152, boxed: "| {A103||...} |"),
C2 prints each random draw (J153, a bare integer), and C3 prints the sentence
with Simon's print-line routines (J155 lines, prefixed "::::...: "). A
sentence's first line starts in col 12, one column right of its continuation
lines (C3 enters a space, 10N1 J161, before each word, but not after a line
overflows); a word may be split across lines between its fragments.

A line break is ambiguous: it may fall between two words or between the
fragments of one word (FIRE / BOX), and the layout does not tell which. The
two pieces are joined without a space when the result is a word of the deck's
vocabulary (B1-B48). The trace omits the start symbol A0,
as the 1620 decoder does.

Usage: decode.py yngve-lisp.out [--trace] [--deck ysimon.card]
Output has the same format as ../SimonYngveSentenceGenerator/retro1620/decode.py.
"""
import os, re, sys

box = re.compile(r'^\| \{([^|]+)\|')
num = re.compile(r'^(-?\d+)$')
line = re.compile(r'^:+ (.*)$')

def vocabulary(deck):
    """The words spelled by the B lists of the deck (fragments joined)."""
    words, cur, order, text = set(), None, [], {}
    def finish():
        if cur and order and all(o in text for o in order):
            words.add(''.join(text[o] for o in order))
    for card in open(deck):
        b = card.rstrip('\n').ljust(80)
        name, pq, symb = b[42:47].strip(), b[48:50], b[50:55].strip()
        if re.fullmatch(r'B\d+', name):
            finish()
            cur, order, text = name, [], {}
        elif cur and not name and pq == '00' and symb.startswith('9-'):
            order.append(symb)
        elif cur and name.startswith('9-') and pq == '21':
            text[name] = symb
        elif name and not name.startswith('9-'):
            finish()
            cur = None
    finish()
    return words

args = sys.argv[1:]
deck = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ysimon.card')
if '--deck' in args:
    deck = args[args.index('--deck') + 1]
vocab = vocabulary(deck)

def join(cur, text):
    head, _, last = cur.rpartition(' ')
    first, _, rest = text.partition(' ')
    if last + first in vocab:
        return cur + text
    return cur + ' ' + text

sentences, trace, cur = [], [], None
for ln in open(args[0]):
    ln = ln.rstrip('\n')
    m = line.match(ln)
    if m:
        text = m.group(1)
        if text.startswith(' ' * 11):            # first line (col 12)
            if cur is not None:
                sentences.append((cur, trace)); trace = []
            cur = text.strip()
        else:                                     # continuation
            cur = join(cur, text.strip())
        continue
    if cur is not None and (box.match(ln) or num.match(ln)):
        sentences.append((cur, trace)); trace = []; cur = None
    m = box.match(ln)
    if m and m.group(1) != 'A0':
        trace.append(m.group(1))
    elif num.match(ln):
        trace.append('[%s]' % ln)
if cur is not None:
    sentences.append((cur, trace))

for i, (s, t) in enumerate(sentences, 1):
    print('%2d. %s' % (i, s))
    if '--trace' in args and t:
        print('    ' + ' '.join(t))
