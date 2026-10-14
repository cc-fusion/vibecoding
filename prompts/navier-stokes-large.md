Generate a complete HTML, Javascript, and CSS implementation of an optimized 2D incompressible Navier-Stokes solver tailored for large grid resolutions (e.g., 1024x1024 or higher). 

Use Chorin's Projection Method (splitting scheme) to compute intermediate velocities, solve for pressure, and project to a divergence-free field.
Implement a Collocated or Staggered MAC layout using periodic boundary conditions on all sides.
Semi-implicit scheme (explicit for advection/diffusion, implicit pressure correction).

Do not use iterative methods. Implement a spectral solver using Fast Fourier Transforms to achieve O(N log N) scaling.
Use a highly efficient, fully vectorized Semi-Lagrangian advection scheme with bilinear interpolation to avoid explicit loops. Provide an option or toggle for BFECC (Back and Forth Error Compensation and Correction) to mitigate numerical diffusion.
