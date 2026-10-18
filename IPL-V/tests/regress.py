#!/usr/bin/env python3
"""Regression suite for the Lisp IPL-V (../iplv.lisp).

Runs every program known to work on the interpreter and checks that its output
is unchanged:

  ackermann  tests/Acker.Ipl -> 125, tests/Ackermann.liplv -> 61
  jprobe     tests/jprobe.card (J-function probes)
  symbols    tests/symprobe.card (symbol identity: Q1 /= Q10, A = A0)
  fixes      tests/fixprobe.card (J166, J66)
  lt         ../../LogicTheorist/run.sh: 24/24 theorems as in 1963 (except the
             known *2.15 difference: it fails at the effort limit in both runs,
             after 31 subproblems in 1963 and 48 here; see LogicTheorist/README.md)
  hc         ../../HeuristicCoder/run.sh: the T1 compilations
  annexer    ../../HeuristicCoder/annexer/run.sh: RM-3588 App. B
  yngve      ../../SimonYngve2/run.sh: faithful deck, and the same sentences
             as the IBM 1620 run
  yngve-clean  ../../SimonYngve2/run.sh clean

The reference ("golden") output is:
  - for the project programs, the output files committed in the project
    directory. The harness saves them, runs the project's run.sh (which
    rewrites them), compares, and puts the saved files back, so a test run
    leaves the repository as it was;
  - for ackermann and jprobe, tests/golden/*.out, a snapshot of the
    interpreter's behavior when the suite was made (2026-10-18). A snapshot
    records what the interpreter did, not necessarily what is correct.

Lines starting with ';' (SBCL compiler messages, which carry timestamps and
paths) are ignored in comparisons. A failing program's new output and a diff
go to $TMPDIR/iplv-regress/<program>/ (outside the repository). A run also reports any other file in the project
directory that changed (git status), which would mean a run.sh writes
something the suite doesn't know about.

Usage:
  regress.py                 run everything
  regress.py lt yngve        run some
  regress.py --accept [...]  keep the new outputs as the reference (after a
                             change that is meant to alter output)
Exit status 0 if everything passes.
"""
import difflib, os, shutil, subprocess, sys, tempfile, time

TESTS = os.path.dirname(os.path.abspath(__file__))
IPLV = os.path.dirname(TESTS)
REPO = os.path.dirname(IPLV)
OUT = os.path.join(tempfile.gettempdir(), 'iplv-regress')
GOLDEN = os.path.join(TESTS, 'golden')

# name: (project dir, command, output files written by the command)
PROJECTS = {
    'lt': ('LogicTheorist', ['sh', 'run.sh'], ['lt-stefferud-lisp.out']),
    'hc': ('HeuristicCoder', ['sh', 'run.sh'],
           ['heuristic.card', 'heuristic-run.card', 'heuristic-run-sdsc.card',
            'run/t1.txt', 'run/t1-sdsc.txt']),
    'annexer': ('HeuristicCoder/annexer', ['sh', 'run.sh'],
                ['annexer.card', 'annexer-run.card', 'output.txt', 'memory.txt']),
    'yngve': ('SimonYngve2', ['sh', 'run.sh'],
              ['yngve-lisp.out', 'printout.txt', 'sentences.txt']),
    'yngve-clean': ('SimonYngve2', ['sh', 'run.sh', 'clean'],
                    ['ysimon-clean.card', 'clean_sentences.txt']),
}
SMALL = {  # name: [(deck in tests/, golden file, expected substring)]
    'ackermann': [('Acker.Ipl', 'acker.out', '|125 [VALUE OF N;]'),
                  ('Ackermann.liplv', 'ackermann-liplv.out', '|61 [VALUE OF N;]')],
    'jprobe': [('jprobe.card', 'jprobe.out', None)],
    # Symbol identity (J2, J10): exact, except A = A0. Before the 2026-10-18
    # fix, R1, R3 and R4 gave T and R7 found V10.
    'symbols': [('symprobe.card', 'symprobe.out',
                 [': R1 F ', ': R2 T ', ': R3 F ', ': R4 F ', ': R5 T ', ': R6 F ',
                  ': R7 V1 ', ': R8 V10 '])],
}
LT_KNOWN = {'2.15'}   # documented in LogicTheorist/README.md
ORDER = ['ackermann', 'jprobe', 'symbols', 'lt', 'hc', 'annexer', 'yngve', 'yngve-clean']


def norm(text):
    return [l for l in text.splitlines() if not l.startswith(';')]


def read(path):
    with open(path, errors='replace') as f:
        return f.read()


def report_diff(name, label, old, new):
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    base = label.replace('/', '_')
    with open(os.path.join(d, base + '.new'), 'w') as f:
        f.write(new)
    diff = list(difflib.unified_diff(norm(old), norm(new), 'golden/' + label,
                                     'new/' + label, lineterm='', n=2))
    with open(os.path.join(d, base + '.diff'), 'w') as f:
        f.write('\n'.join(diff) + '\n')
    changed = sum(1 for l in diff if l[:1] in '+-' and l[:3] not in ('+++', '---'))
    return '%s differs (%d lines; %s)' % (label, changed, os.path.join(d, base + '.diff'))


def git_changes(path):
    r = subprocess.run(['git', 'status', '--porcelain', '--', path], cwd=REPO,
                       capture_output=True, text=True)
    return set(r.stdout.splitlines())


FASL = None


def fasl():
    global FASL
    if FASL is None:
        FASL = os.path.join(OUT, 'iplv.fasl')
        os.makedirs(OUT, exist_ok=True)
        subprocess.run(['sbcl', '--non-interactive', '--eval',
                        '(compile-file "%s" :output-file "%s")'
                        % (os.path.join(IPLV, 'iplv.lisp'), FASL)],
                       capture_output=True, text=True, check=True)
    return FASL


def run_small(name, accept):
    problems = []
    for deck, golden, expect in SMALL[name]:
        r = subprocess.run(
            ['sbcl', '--non-interactive', '--eval', '(load "%s")' % fasl(), '--eval',
             '(progn (set-trace-mode :none) (load-ipl "%s" :adv-limit 10000000))'
             % os.path.join(TESTS, deck)],
            capture_output=True, text=True, timeout=600)
        new = '\n'.join(norm(r.stdout + r.stderr)) + '\n'
        for e in ([expect] if isinstance(expect, str) else expect or []):
            if e not in new:
                problems.append('%s: expected %r not in output' % (deck, e))
        g = os.path.join(GOLDEN, golden)
        if accept or not os.path.exists(g):
            os.makedirs(GOLDEN, exist_ok=True)
            with open(g, 'w') as f:
                f.write(new)
        elif norm(read(g)) != norm(new):
            problems.append(report_diff(name, golden, read(g), new))
    return problems


def run_project(name, accept):
    pdir, cmd, files = PROJECTS[name]
    pabs = os.path.join(REPO, pdir)
    before = git_changes(pdir)
    save = tempfile.mkdtemp(prefix='regress-')
    for f in files:
        src = os.path.join(pabs, f)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(os.path.join(save, f)), exist_ok=True)
            shutil.copy2(src, os.path.join(save, f))
    problems = []
    try:
        r = subprocess.run(cmd, cwd=pabs, capture_output=True, text=True, timeout=1800)
        log = r.stdout + r.stderr
        if r.returncode != 0:
            problems.append('run.sh exited %d' % r.returncode)
            d = os.path.join(OUT, name)
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, 'run.log'), 'w') as f:
                f.write(log)
        for f in files:
            old_p, new_p = os.path.join(save, f), os.path.join(pabs, f)
            if not os.path.exists(new_p):
                problems.append('%s was not written' % f)
            elif not os.path.exists(old_p):
                problems.append('%s has no reference copy' % f)
            elif norm(read(old_p)) != norm(read(new_p)):
                problems.append(report_diff(name, f, read(old_p), read(new_p)))
        problems += extra_checks(name, log, pabs)
    finally:
        if not accept:
            for f in files:
                if os.path.exists(os.path.join(save, f)):
                    shutil.copy2(os.path.join(save, f), os.path.join(pabs, f))
        shutil.rmtree(save)
    stray = git_changes(pdir) - before
    if stray:
        problems.append('other files changed: ' + ', '.join(sorted(s[3:] for s in stray)))
    return problems


def extra_checks(name, log, pabs):
    """Checks beyond 'same output as before'."""
    p = []
    if name == 'lt':
        lines = log.splitlines()
        if '24 24' not in lines:
            p.append('compare.py did not report 24 24 theorems')
        p += ['1963 comparison: ' + l.split()[0] + ' differs' for l in lines
              if 'differs' in l and l.split()[0] not in LT_KNOWN]
    if name == 'yngve':
        ref = os.path.join(REPO, 'SimonYngveSentenceGenerator/retro1620/sentences.txt')
        if read(os.path.join(pabs, 'sentences.txt')) != read(ref):
            p.append('sentences.txt no longer matches the IBM 1620 run')
    return p


def main():
    args = sys.argv[1:]
    accept = '--accept' in args
    names = [a for a in args if a != '--accept'] or ORDER
    for n in names:
        if n not in ORDER:
            sys.exit('unknown program %r; choose from %s' % (n, ' '.join(ORDER)))
    for n in names:
        shutil.rmtree(os.path.join(OUT, n), ignore_errors=True)
    failed = 0
    for n in names:
        t = time.time()
        problems = run_small(n, accept) if n in SMALL else run_project(n, accept)
        status = 'ACCEPTED' if accept else ('FAIL' if problems else 'PASS')
        print('%-12s %-8s %5.1fs' % (n, status, time.time() - t), flush=True)
        for pr in problems:
            print('             ' + pr, flush=True)
        failed += bool(problems) and not accept
    if FASL and os.path.exists(FASL):
        os.remove(FASL)
    print('%d of %d passed' % (len(names) - failed, len(names)))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
