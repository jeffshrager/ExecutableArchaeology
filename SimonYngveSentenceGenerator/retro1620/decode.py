#!/usr/bin/env python3
"""Decode the output of ysimon-fixed.card (punch) or ysimon-fast.card (typewriter).

ysimon-fixed: C1's trace punches every symbol it expands (A.., B..) and C2
punches each random draw (an integer data term, type 01). C3 punches, per word,
the word symbol (B..) and then its fragments (alphanumeric data terms, type 81).

ysimon-fast: only the fragments are typed, and the symbol C3 ends each
sentence. With no word symbols, the fragments are split into words using the
spellings of B1-B48 in the deck (longest match first).

Usage: decode.py output.txt [--trace] [--deck ../ysimon.card]
"""
import os, re, sys

sym = re.compile(r'^\s+([A-Z]\d+)\s*$')
alpha = re.compile(r'^\s+\d{7}\s+81\s+(\S+)\s*$')
num = re.compile(r'^\s+\d{7}\s+01\s+(-?\d+)\s*$')

def vocabulary(deck):
    """Map tuple of fragments -> word, from the B lists of the deck."""
    words, cur, order, text = {}, None, [], {}
    def finish():
        if cur and order and all(o in text for o in order):
            frags = tuple(text[o] for o in order)
            words[frags] = ''.join(frags)
    for line in open(deck):
        b = line.rstrip('\n').ljust(80)
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

def segment(frags, vocab):
    longest = max(len(k) for k in vocab)
    out, i = [], 0
    while i < len(frags):
        for n in range(min(longest, len(frags) - i), 0, -1):
            if tuple(frags[i:i + n]) in vocab:
                out.append(vocab[tuple(frags[i:i + n])])
                i += n
                break
        else:
            out.append(frags[i])
            i += 1
    return out

args = sys.argv[1:]
deck = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ysimon.card')
if '--deck' in args:
    deck = args[args.index('--deck') + 1]
vocab = None

sentences, words, trace, in_c3, by_symbol = [], [], [], False, True

def finish_sentence():
    global vocab
    if by_symbol:
        ws = words
    else:
        vocab = vocab or vocabulary(deck)
        ws = segment(words, vocab)
    sentences.append((' '.join(ws), trace))

for line in open(args[0]):
    line = line.rstrip('\n')
    m = alpha.match(line)
    if m:
        if not in_c3:
            in_c3 = True
            by_symbol = bool(trace) and trace[-1].startswith('B')
            if by_symbol:
                trace.pop()                # the B.. just seen starts the first word
            words = [''] if by_symbol else []
        if by_symbol:
            words[-1] += m.group(1)
        else:
            words.append(m.group(1))
        continue
    m = sym.match(line)
    if m and in_c3 and by_symbol and m.group(1).startswith('B'):
        words.append('')
        continue
    if in_c3:
        finish_sentence()
        in_c3, trace = False, []
    if m:
        trace.append(m.group(1))
    elif num.match(line):
        trace.append('[%s]' % num.match(line).group(1))
if in_c3:
    finish_sentence()

for i, (s, t) in enumerate(sentences, 1):
    print('%2d. %s' % (i, s))
    if '--trace' in args and t and t != ['C3']:
        print('    ' + ' '.join(t))
if trace and trace != ['C3'] and not in_c3:
    print('(unfinished derivation at end: %s)' % ' '.join(trace[-40:]))
