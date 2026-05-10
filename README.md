# NEPv Visual Lab

An interactive website for building intuition about a nonlinear eigenvalue problem with eigenvector dependency (NEPv). The app is intentionally centered on a small, inspectable toy model rather than a production-grade solver. The goal is to make the feedback loop visible: the operator changes when the current eigenvector estimate changes, which turns the problem into a self-consistency search.

## Link of the website

https://chiyaxing666-sudo.github.io/nepv-visual-lab/

## Clone, Install, and Run

```bash
git clone <your-public-repo-url>
cd <repo-folder>

# No package install is required. The site is dependency-free.
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

This repo is intentionally dependency-free, so it can also be opened directly from `index.html`, but a small local server is the safest option.

## Design Choices

I chose a teaching-first interaction instead of a scatterplot of opaque numbers. The app reduces the state space to the unit circle in 2D and then shows linked views:

1. A story section: ordinary eigenvectors first, then the NEPv feedback loop.
2. A step-by-step derivation lab: current guess, generated matrix, target eigendirection, and next update.
3. A coordinate view: how the matrix output compares with the target direction.
4. An error staircase and basin map: how convergence changes with parameters and starting direction.
5. A matrix snapshot: the actual `2 x 2` matrix and eigendirection for the current state.

This makes the assignment's core idea visible without pretending that a tiny browser demo is solving a real electronic-structure or dimensionality-reduction benchmark.

## Problem Statement

Linear eigenproblems keep the operator fixed and search for vectors that the operator scales. In an eigenvector-dependent nonlinear eigenvalue problem, the operator itself depends on the unknown eigenvector, so the search becomes self-referential. The challenge for this project is not to prove new theory, but to build intuition for what that feedback does to the geometry of the problem.

The app therefore studies a toy symmetric matrix-valued operator

```text
A(v) = [a(v)  b(v)]
       [b(v)  d(v)]
```

where `v` is restricted to a unit vector parameterized by an angle on the circle. For each direction `v(theta)`, the app computes:

- the operator `A(v(theta))`
- the smallest-eigenvalue eigenvector of that operator
- the angular residual between the current direction and the returned eigendirection
- the next iterate of a simple SCF-style fixed-point update with mixing

## Methodology

We solve the toy NEPv using a simple self-consistent field (SCF) iteration with mixing. 

The implementation follows this workflow:

1. Parameterize unit vectors by angle `theta`.
2. Define a small symmetric operator `A(v)` whose entries contain both linear and vector-dependent terms.
3. For each sampled angle, solve the 2x2 eigenproblem analytically.
4. Align the returned eigenvector direction with the current iterate because `v` and `-v` represent the same eigenspace.
5. Measure self-consistency residual as the signed angular mismatch.
6. Run a mixed fixed-point iteration:

```text
theta_(k+1) = theta_k + mix * residual(theta_k)
```

The resulting charts let us see when the map is nearly linear, when multiple self-consistent directions coexist, and when the iteration becomes sticky or slow.

The full submission report is also available in [`REPORT.md`](./REPORT.md).

## Evaluation Dataset

No external dataset is used. This is a synthetic mathematical demo.

## Evaluation Methods

Because the project is explanatory rather than benchmark-driven, evaluation is based on whether the app makes the qualitative structure legible:

1. Fixed-point visibility: residual crossings should be easy to spot.
2. Basin sensitivity: changing feedback parameters should alter convergence behavior in a readable way.
3. Iteration readability: the dashed trajectory should show how the seed moves toward or away from self-consistency.
4. Responsiveness: the app should remain smooth enough for a live demo on common laptop and mobile viewport sizes.

## Experimental Results

Three presets are included to demonstrate different regimes.

- `Balanced`: produces a readable fixed-point structure with moderate feedback and stable convergence.
- `Sticky basins`: increases vector feedback and twist so the residual field bends more sharply and the iteration can linger.
- `Near linear`: reduces nonlinear terms so the map behaves closer to a conventional fixed-operator picture.

The most useful result is qualitative: the same operator family can look simple or tangled depending on how strongly the vector feeds back into the matrix.

## Limitations

- The model is a toy 2D construction designed for interpretability, not a canonical benchmark problem.
- The app visualizes one eigendirection family on the unit circle, so it does not represent the full geometry of higher-dimensional NEPv instances.
- The SCF-style iteration shown here is intentionally simple and should not be treated as a statement about best numerical practice.

## Sources

Primary sources used to shape the explanation:

1. Yunfeng Cai, Lei-Hong Zhang, Zhaojun Bai, and Ren-Cang Li, "On an Eigenvector-Dependent Nonlinear Eigenvalue Problem," *SIAM Journal on Matrix Analysis and Applications*, 39(3), 2018. DOI: <https://doi.org/10.1137/17M115935X>
   The abstract states that the paper gives existence and uniqueness conditions for an algebraic eigenvalue problem with eigenvector nonlinearity and analyzes self-consistent field iteration.
2. Raffaele Chiappinelli, "What Do You Mean by 'Nonlinear Eigenvalue Problems'?" *Axioms*, 7(2), 2018. DOI: <https://doi.org/10.3390/axioms7020039>
   This paper gives a broad framing of nonlinear eigenvalue problems and distinguishes operator dependence on the eigenvalue from nonlinearity tied to the vector side of the problem.

Useful context surfaced by those papers:

- NEPv appears in applications such as discrete Kohn-Sham equations and trace-ratio formulations for dimensionality reduction.
- Self-consistency is not a visualization gimmick here; it is central to how these problems are solved and analyzed.

## AI Assistance Note

AI was used to help with:

- cross-checking the mathematical terminology and explanations for consistency.
- drafting and refining the browser interface 
- reorganizing the README and report sections so they matched the submission requirements more clearly.

## What I verified by hand or directly in code:

- the app uses an explicitly labeled toy model rather than claiming a faithful physical simulation
- the iteration logic, residual definition, and eigenvector sign alignment are implemented directly in the code
- the README claims are kept narrow and consistent with the cited sources
