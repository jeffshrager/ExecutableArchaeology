#!/bin/sh
# Build the annexer deck, append the input statements, and run it on the
# Lisp IPL-V (../../IPL-V/iplv.lisp). Output: output.txt (the program's printing) and memory.txt
# (what was annexed to X105).
set -e
cd "$(dirname "$0")"
python3 build.py
cat annexer.card input.txt > annexer-run.card
sbcl --non-interactive --eval '(compile-file "../../IPL-V/iplv.lisp" :output-file (merge-pathnames "iplv.fasl" (truename ".")))' >/dev/null 2>&1
sbcl --non-interactive --eval '(load "iplv.fasl")' \
  --eval '(progn (set-trace-mode :none) (load-ipl "annexer-run.card" :adv-limit 200000))' 2>&1 \
  | sed -n '/^+----.*"9-/,$p' > output.txt
sbcl --non-interactive --eval '(load "iplv.fasl")' --eval '(progn (set-trace-mode :none)
  (load-ipl "annexer-run.card" :adv-limit 200000)
  (labels ((v (obj att)
             (let ((dl (cell-symb (cell obj))))
               (loop for a = (cell-link (cell dl)) then (cell-link vc)
                     for ac = (unless (zero? a) (cell a))
                     for vc = (when ac (cell (cell-link ac)))
                     while vc when (string= (cell-symb ac) att) return (cell-symb vc))))
           (members (l) (loop for n = (cell-link (cell l)) then (cell-link c)
                              for c = (unless (zero? n) (cell n)) while c collect (cell-symb c))))
    (let* ((d (v "X105" "X20")) (o (v "X105" "X25")) (l (v o "X34")))
      (format t "~%MEMORY the X20 of X105 = ~a, whose X31 = ~a~%" d (v d "X31"))
      (format t "MEMORY the X25 of X105 = ~a, whose X33 = ~a and X34 = ~a~%" o (v o "X33") l)
      (format t "MEMORY members of ~a = ~a~%" l (members l)))))' 2>&1 | grep '^MEMORY' | sed 's/^MEMORY //' > memory.txt
rm -f iplv.fasl
cat memory.txt
