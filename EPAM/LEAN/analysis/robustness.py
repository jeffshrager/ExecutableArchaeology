#!/usr/bin/env python3
"""How sensitive is EPAM's behavior on List A to the assumptions of the hand
simulation? (P-1817 p. 87, footnote: "we have satisfied ourselves that the
qualitative behavior of the system ... does not depend in any sensitive
manner on the precise form of these assumptions".)

This re-implements, in Python, exactly the model of ../Epam/Experiment.lean
and the schedule of ../Epam/Fig41.lean (checked: the default configuration
reproduces the Lean results, 33/34). It then varies:

  * the letter codes: each letter's bits that the letter net U1 does not test
    are drawn at random (U1's tested bits, and A's historical code, are kept);
  * the noticing order of letters: all 6 permutations (the figure's is 1-3-2);
  * P2, the number of differences noticed per confusion: 1, 2, 3 (figure: 3).

For each configuration it records the agreement with Fig. 4.1's 34 recorded
responses, and four landmark phenomena:
  PEM   trial 4: PEM confused with ROM, giving ROM's response TIL (note 7)
  OSC   trial 4: LUK's cue insufficient, "none" possible (note 6, oscillation)
  CRIT  trial 7: every response forced correct (criterion), and trial 6 not
  KAG6  trial 6: KAG's precarious link can fail (note 12)

Usage: robustness.py [samples per configuration, default 1000] [seed]
"""
import itertools, random, sys

N_SAMPLES = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1959)
HERE = __file__.rsplit('/', 1)[0]
rows = [l.split() for l in open(HERE + '/../../IPL/letter_codes.txt')]
FIXED = {r[0]: r[2] for r in rows}           # '.' = not tested by U1
BASE = {r[0]: r[1] for r in rows}
LETTERS = sorted(set('KAGLUKRILPEMROMTIL'))
SYL = 'KAG LUK RIL PEM ROM TIL'.split()

SCHEDULE = [(1, 1, ('F1', 'KAG')), (1, 2, ('F1', 'LUK')), (1, 5, ('F2', 'KAG', 'LUK')),
            (2, 2, ('F1', 'LUK')), (2, 5, ('F1', 'RIL')), (2, 6, ('F2', 'LUK', 'RIL')),
            (3, 6, ('F1', 'ROM')), (4, 1, ('F1', 'TIL')), (4, 3, ('F2', 'ROM', 'TIL')),
            (4, 5, ('F1', 'PEM')), (5, 0, ('F2', 'LUK', 'RIL')),
            (5, 2, ('F1', 'ROM')), (5, 5, ('F2', 'PEM', 'ROM')),
            (6, 5, ('F1', 'RIL')), (7, 0, ('F1', 'PEM')), (7, 1, ('F2', 'RIL', 'PEM'))]
FIG = {(1, 0): 'none', (1, 1): 'none', (1, 2): 'none', (1, 3): 'none', (1, 4): 'none',
       (2, 0): 'LUK', (2, 1): 'none', (2, 2): 'none', (2, 3): 'none', (2, 4): 'none',
       (3, 0): 'LUK', (3, 1): 'RIL', (3, 2): 'none', (3, 3): 'none', (3, 4): 'none',
       (4, 0): 'LUK', (4, 1): 'none', (4, 2): 'none', (4, 3): 'TIL', (4, 4): 'TIL',
       (5, 0): 'LUK', (5, 2): 'none', (5, 3): 'none', (5, 4): 'TIL',
       (6, 0): 'none', (6, 1): 'RIL', (6, 2): 'none', (6, 3): 'ROM', (6, 4): 'TIL',
       (7, 0): 'LUK', (7, 1): 'RIL', (7, 2): 'PEM', (7, 3): 'ROM', (7, 4): 'TIL'}


def run(codes, letter_order, k):
    item = {s: tuple(b == '1' for b in codes[s[0]] + codes[s[1]] + codes[s[2]]) for s in SYL}
    name = {v: s for s, v in item.items()}
    order = [f for L in letter_order for f in range(14 * L, 14 * L + 14)]

    def chain(fs, x):
        if not fs:
            return ('leaf', x)
        sub = chain(fs[1:], x)
        return ('test', fs[0], ('leaf', None), sub) if x[fs[0]] else ('test', fs[0], sub, ('leaf', None))

    def learn(N, x):
        if N[0] == 'leaf':
            z = N[1]
            if z is None:
                return ('leaf', x)
            if z == x:
                return N
            fs = [f for f in order if x[f] != z[f]][:k]
            if not fs:
                return N
            sub = chain(fs[1:], x)
            return ('test', fs[0], ('leaf', z), sub) if x[fs[0]] else ('test', fs[0], sub, ('leaf', z))
        _, f, n0, n1 = N
        return ('test', f, n0, learn(n1, x)) if x[f] else ('test', f, learn(n0, x), n1)

    def select(N, x):
        while N[0] == 'test':
            N = N[3] if x[N[1]] else N[2]
        return N[1]

    def path(N, x):
        p = []
        while N[0] == 'test':
            p.append(N[1]); N = N[3] if x[N[1]] else N[2]
        return p

    def cue_results(N, cue):
        if N[0] == 'leaf':
            return {N[1]}
        _, f, n0, n1 = N
        if f in cue:
            return cue_results(n1 if cue[f] else n0, cue)
        return cue_results(n0, cue) | cue_results(n1, cue)

    def state(t, r):
        N, assoc = ('leaf', None), {}
        for (et, er, ev) in SCHEDULE:
            if (et, er) <= (t, r):
                if ev[0] == 'F1':
                    N = learn(N, item[ev[1]])
                else:
                    s, y = item[ev[1]], item[ev[2]]
                    img = select(N, s) or s
                    assoc[img] = {f: y[f] for f in path(N, y)}
        return N, assoc

    def responses(t, r):
        N, assoc = state(t, r)
        img = select(N, item[SYL[r]])
        if img is None or img not in assoc:
            return {'none'}
        return {name.get(x, '?') if x else 'none' for x in cue_results(N, assoc[img])}

    resp = {(t, r): responses(t, r) for t in range(1, 8) for r in range(5)}
    agree = sum(1 for key, v in FIG.items() if v in resp[key])
    marks = {
        'PEM': resp[(4, 3)] == {'TIL'},
        'OSC': 'none' in resp[(4, 1)],
        'CRIT': all(resp[(7, r)] == {SYL[r + 1]} for r in range(5))
                and any(resp[(6, r)] != {SYL[r + 1]} for r in range(5)),
        'KAG6': 'none' in resp[(6, 0)],
    }
    return agree, marks


def complete(rng):
    codes = {}
    for L in LETTERS:
        if L == 'A':
            codes[L] = BASE[L]
        else:
            codes[L] = ''.join(c if c != '.' else rng.choice('01') for c in FIXED[L])
    return codes


if __name__ == '__main__':
    base = run(BASE, (0, 2, 1), 3)
    print('reconstructed codes, order 1-3-2, P2=3: agreement %d/34, %s' % base)
    print()
    print('%-6s %-3s %8s %8s %6s %6s %6s %6s' % ('order', 'P2', 'mean', 'min-max', 'PEM', 'OSC', 'CRIT', 'KAG6'))
    for perm in itertools.permutations((0, 1, 2)):
        for k in (1, 2, 3):
            rng = random.Random(hash((perm, k)) & 0xffffffff)
            ags, cnt = [], {m: 0 for m in ('PEM', 'OSC', 'CRIT', 'KAG6')}
            for _ in range(N_SAMPLES):
                a, m = run(complete(rng), perm, k)
                ags.append(a)
                for key in cnt:
                    cnt[key] += m[key]
            label = '-'.join(str(i + 1) for i in perm)
            print('%-6s %-3d %8.1f %8s %5.0f%% %5.0f%% %5.0f%% %5.0f%%' % (
                label, k, sum(ags) / len(ags), '%d-%d' % (min(ags), max(ags)),
                *(100.0 * cnt[m] / N_SAMPLES for m in ('PEM', 'OSC', 'CRIT', 'KAG6'))))
