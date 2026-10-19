#!/usr/bin/env python3
"""Write EPAMFixed.liplv as 80-column IPL-V cards, field for field.

No normalization: every field goes into its card columns unchanged, so the
deck is the same transcription in card form. The columns are those of the
Lisp IPL-V card reader (../../IPL-V/iplv.lisp, read-card):

  comment 1-40 (text from col 6), type 41, name 43-47, sign 48, PQ 49-50,
  SYMB 51-55, LINK 57-61, comment 62-70, id 71-80

The .liplv rows are (comments type name sign pq symb link comments.1 id).
A ";;" remark after a row (the added start card has one) becomes a type-1
comment card before it. Integer data terms keep their value where the
transcription put it (in LINK). The one second comment wider than cols
62-70 (F0119) is folded into the first comment; comments don't load.

Usage: liplv2cards.py [EPAMFixed.liplv] [epamfixed.card]
"""
import re, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'EPAMFixed.liplv'
dst = sys.argv[2] if len(sys.argv) > 2 else 'epamfixed.card'
WIDTH = {'comment': 35, 'type': 1, 'name': 5, 'sign': 1, 'pq': 2,
         'symb': 5, 'link': 5, 'comment1': 9, 'id': 10}
FIELD = re.compile(r'"((?:[^"\\]|\\.)*)"')


def card(comment, typ, name, sign, pq, symb, link, comment1, ident):
    for k, v in (('comment', comment), ('type', typ), ('name', name), ('sign', sign),
                 ('pq', pq), ('symb', symb), ('link', link), ('comment1', comment1),
                 ('id', ident)):
        if len(v) > WIDTH[k]:
            raise SystemExit('field %s too wide (%d): %r' % (k, WIDTH[k], v))
    s = ('     ' + comment).ljust(40) + typ.ljust(1) + ' ' + name.ljust(5) + sign.ljust(1)
    s += pq.ljust(2) + symb.ljust(5) + ' ' + link.ljust(5) + comment1.ljust(9)
    s += ident.ljust(10)
    assert len(s) == 80, s
    return s.rstrip()


lines = open(src).read().split('\n')
assert lines[0].startswith('(:comments'), 'not a .liplv file'
out = []
for ln in lines[1:]:
    row, _, remark = ln.partition(';;')
    fields = FIELD.findall(row)
    if not fields:
        continue
    assert len(fields) == 9, ln
    c, t, n, s, pq, sy, lk, c1, i = fields
    if len(c1) > WIDTH['comment1']:
        # F0119's second comment, "DISC. DONE", is one character too wide
        # for cols 62-70; fold it into the first comment instead.
        c, c1 = (c + '. ' + c1).strip('. ') if c else c1, ''
    if remark.strip():
        out.append(card(remark.strip().upper()[:35], '1', '', '', '', '', '', '', ''))
    out.append(card(c, t, n, s, pq, sy, lk, c1, i))
open(dst, 'w').write('\n'.join(out) + '\n')
print('%d cards -> %s' % (len(out), dst))
