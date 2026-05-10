# NEPv Visual Lab Report

## Problem Statement

This project visualizes a nonlinear eigenvalue problem with eigenvector dependency (NEPv):

```text
A(x)x = lambda x
```

In an ordinary eigenvalue problem, the matrix `A` is fixed. We only ask which vectors keep the same direction after the matrix acts on them. In an NEPv, the matrix also depends on the unknown vector `x`, so the vector helps define the matrix that is then used to test the vector. The goal becomes self-consistency: find a direction that builds a matrix and is still an eigendirection of that matrix.

The website is designed for students who know basic linear algebra but may not have seen nonlinear eigenvalue problems. Instead of presenting the topic as a dense formula first, the page introduces vectors as arrows, matrices as machines that push arrows, and NEPv as a feedback loop between the arrow and the machine.

## Methodology

We solve the toy NEPv using a simple self-consistent field (SCF) iteration with mixing. The implementation uses a small two-dimensional teaching model. Each candidate vector is restricted to the unit circle:

```text
x(theta) = [cos(theta), sin(theta)]
```

For each direction, the app builds a symmetric `2 x 2` matrix:

```text
A(x) = [a(x)  b(x)]
       [b(x)  d(x)]
```

The entries change with both the current direction and the user-controlled parameters. The app then computes the eigendirection returned by that matrix, compares it with the current direction, and optionally updates the current guess.

The visual workflow is:

1. Choose a current direction `x_k`.
2. Build the matrix `A(x_k)`.
3. Compute the target eigendirection `v_k`.
4. Move partway toward that direction to obtain `x_(k+1)`.
5. Repeat until the direction gap becomes small.

The update shown in the interface is:

```text
theta_(k+1) = theta_k + alpha * (theta(v_k) - theta_k)
```

where `alpha` is the update step. The app deliberately uses a simplified model so students can see every geometric object: the current vector, matrix output, target eigendirection, next iterate, error bars, basin map, and generated matrix.

## Evaluation Dataset

No external dataset is used. This is a synthetic mathematical visualization built to explain a concept. The "data" shown in the charts is generated live from the current parameters and starting angle.

## Evaluation Methods

The project is evaluated as an educational front-end rather than as a numerical benchmark. The main checks are:

- Whether the page explains NEPv from ordinary eigenvectors toward the nonlinear case.
- Whether the diagrams make the relationship among `x_k`, `A(x_k)x_k`, `v_k`, and `x_(k+1)` visible.
- Whether the sliders produce immediate and interpretable geometric changes.
- Whether the iteration animation is stable and shows one computed step at a time.
- Whether the README explains clone, run, design choices, limitations, and AI assistance.

## Experimental Results

The app includes three parameter presets:

- **Balanced Mode**: a stable classroom example with several self-consistent directions and a readable iteration path.
- **Sticky Case**: stronger feedback, where the direction can move more slowly or bend in a less obvious way.
- **Almost Linear**: weaker nonlinear feedback, closer to the intuition of an ordinary fixed-matrix eigenvalue problem.

The most important result is qualitative: changing the strength of vector feedback changes the geometry of the problem. The same starting direction can move smoothly toward a self-consistent solution in one setting and behave more sensitively in another.

## Design Choices

The interface is intentionally story-driven. It begins with ordinary eigenvectors, introduces the feedback idea, then moves into the interactive lab. This avoids dropping students directly into a symbolic NEPv equation.

The visual design uses a clean glass-like layout, large readable typography, and animated reveal effects. The lab section keeps the controls next to the diagrams so users can connect slider movement with geometric change. The main iteration chart emphasizes four vectors:

- cyan: current guess `x_k`
- orange-red: matrix output `A(x_k)x_k`
- yellow: target eigendirection `v_k`
- violet: next update `x_(k+1)`

## Limitations

- The model is a two-dimensional teaching toy, not a production solver.
- Real NEPv systems can be high-dimensional and may require specialized algorithms.
- The app focuses on geometric intuition, not proof of convergence.A large update step may cause the fixed-point iteration to     overshoot or fail to converge, so the displayed path should be interpreted as a teaching illustration rather than a guaranteed solver.
- The displayed iteration is a simple mixed fixed-point update and should not be treated as the best general numerical method.

## AI Assistance Note

AI was used to help to provide the framework of the website, refine UI copy, and iterate on the front-end layout. The mathematical claims were kept narrow and checked against the cited sources and the actual implementation.

## References

1. Yunfeng Cai, Lei-Hong Zhang, Zhaojun Bai, and Ren-Cang Li, "On an Eigenvector-Dependent Nonlinear Eigenvalue Problem," *SIAM Journal on Matrix Analysis and Applications*, 39(3), 2018. DOI: <https://doi.org/10.1137/17M115935X>
2. Raffaele Chiappinelli, "What Do You Mean by 'Nonlinear Eigenvalue Problems'?" *Axioms*, 7(2), 2018. DOI: <https://doi.org/10.3390/axioms7020039>
