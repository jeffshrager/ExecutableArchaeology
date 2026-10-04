;;; Run the Simon/Yngve sentence generator (ysimon.card, unmodified) on
;;; ../IPL-V/iplv.lisp.  Usage (from this directory):
;;;   ./run.sh, which copies ysimon.card to ysimon-run.card (setting N20 and N0
;;;   if asked) and then runs: sbcl --non-interactive --load run-yngve.lisp
(load (compile-file "../IPL-V/iplv.lisp" :output-file (merge-pathnames "iplv.fasl" (truename "."))))
(set-trace-mode :none)
(handler-bind ((error (lambda (e)
                        (format t "~%ERROR at cycle ~a: ~a~%" (h3-cycles) e)
                        (sb-debug:print-backtrace :count 8)
                        (sb-ext:exit :code 1))))
  (load-ipl "ysimon-run.card" :adv-limit 100000000))
