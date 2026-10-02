;;; Load the Heuristic Coder deck and report every SYMB/LINK symbol that
;;; names nothing: undefined J's, undefined regionals, etc.
;;; sbcl --non-interactive --load survey.lisp
(load (compile-file "iplv.lisp"))
(set-trace-mode :none)
(load-ipl "../heuristic.card")
(let ((missing (make-hash-table :test #'equal)))
  (loop for v being the hash-values of *symtab*
	when (cell? v)
	  do (unless (and (= 2 (cell-p v)) (= 1 (cell-q v))) ; skip alphanumeric data
	       (dolist (s (list (cell-symb v) (cell-link v)))
		 (when (and (stringp s) (plusp (length s))
			    (not (every #'digit-char-p s))
			    (not (gethash s *symtab*)))
		   (push (cell-id v) (gethash s missing))))))
  (let ((keys (sort (loop for k being the hash-keys of missing collect k) #'string<)))
    (format t "~%~a undefined symbols:~%" (length keys))
    (dolist (k keys)
      (format t "  ~6a ~3d uses, e.g. ~{~a~^, ~}~%" k (length (gethash k missing))
	      (subseq (gethash k missing) 0 (min 3 (length (gethash k missing))))))))
