/-
EPAM, the macroprocess postulates (M0-M3), qualitatively.

P-1817 §2.4 (from Feigenbaum and Simon's serial-position model, Brit. J.
Psychol. 53, 1962):

"M0: Serial Mechanism. Capable of doing only one thing at a time, needs to
time-share among its information processes."
"M1: Unit Processing Time. Processing an item requires a substantial amount
of processing time, used up by the microprocesses."
"M2: Immediate Memory. There exists a fast-access, small size immediate
memory, through which the microprocesses obtain their information."
"M3: Anchor Points. Items with features of uniqueness will be attended to
first for learning. Once these anchor points are established, attention will
be given to items adjacent to those already learned."

In the serial-anticipation task the two ends of the list are the anchor
points, so attention works inward from both ends.

Results:
* `trials_at_least_pairs` (M0 + M1): if a trial leaves time for at most one
  learning cycle, a list with `n` associations to learn takes at least `n`
  trials.
* `serial_position_effect` (M3): with attention moving inward from the two
  anchors, an association further from the nearer end is learned later, so it
  collects more errors. The error curve over serial position is bowed, lowest
  at the ends and highest in the middle.
-/

namespace Epam

/-- M0 + M1: in each trial the serial mechanism has time for at most one
learning cycle, so after `t` trials at most `t` associations are learned. -/
theorem trials_at_least_pairs (learned : Nat → Nat) (n T : Nat)
    (hunit : ∀ t, learned t ≤ t) (hcrit : n ≤ learned T) : n ≤ T :=
  Nat.le_trans hcrit (hunit T)

/-- Serial positions `0 .. n-1`. The distance of position `i` from the nearer
end of the list (the anchor points of M3). -/
def anchorDist (n i : Nat) : Nat := min i (n - 1 - i)

/-- M3: attention order. The trial on which the association at position `i`
is learned, attending to both anchors first, then to the positions next to
them, and so on inward, one learning cycle per trial (M0, M1). Positions at
equal distance are taken front first. -/
def learnedOnTrial (n i : Nat) : Nat :=
  2 * anchorDist n i + (if i ≤ n - 1 - i then 0 else 1)

/-- In serial anticipation the association at position `i` is wrong on every
trial before it is learned. -/
def errorsAt (n i : Nat) : Nat := learnedOnTrial n i

/-- **The serial position effect (M3).** An association further from its
nearer anchor collects strictly more errors. -/
theorem serial_position_effect (n i j : Nat)
    (h : anchorDist n i < anchorDist n j) : errorsAt n i < errorsAt n j := by
  unfold errorsAt learnedOnTrial
  split <;> (try split) <;> omega

/-- The ends of the list are its best-learned positions: the first position
has the fewest errors of all. -/
theorem first_position_fewest_errors (n i : Nat) : errorsAt n 0 ≤ errorsAt n i := by
  unfold errorsAt learnedOnTrial anchorDist
  split <;> (try split) <;> omega

/-- **The curve is bowed.** Errors rise from the front of the list toward the
middle: `i ≤ j ≤ middle` gives no fewer errors at `j`. -/
theorem errors_rise_toward_middle (n i j : Nat) (hij : i ≤ j) (hj : j ≤ n - 1 - j) :
    errorsAt n i ≤ errorsAt n j := by
  unfold errorsAt learnedOnTrial anchorDist
  split <;> (try split) <;> omega

/-- ...and fall again toward the back: `middle ≤ j ≤ i < n` gives no fewer
errors at `j`. -/
theorem errors_fall_toward_end (n i j : Nat) (hji : j ≤ i) (hi : i < n)
    (hj : n - 1 - j ≤ j) : errorsAt n i ≤ errorsAt n j := by
  unfold errorsAt learnedOnTrial anchorDist
  split <;> (try split) <;> omega

end Epam
