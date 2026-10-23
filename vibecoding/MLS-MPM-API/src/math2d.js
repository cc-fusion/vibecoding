/**
 * Compact 2x2 singular value decomposition.
 *
 * Output layout: [u00, u01, u10, u11, s0, s1, v00, v01, v10, v11].
 * F = U * diag(s0, s1) * transpose(V), with singular values in descending
 * order. V is constructed as a proper rotation; U may be a reflection when
 * det(F) < 0, which retains the sign of an inverted deformation.
 *
 * This replaces taichi.svd for the 2D solver and allocates no temporary objects.
 */
export function svd2(f00, f01, f10, f11, out) {
    // Eigen-decompose A = F^T F. Its eigenvectors are the columns of V.
    const a = f00 * f00 + f10 * f10;
    const b = f00 * f01 + f10 * f11;
    const c = f01 * f01 + f11 * f11;
    const discriminant = Math.hypot(a - c, 2 * b);
    const lambda0 = Math.max(0, 0.5 * (a + c + discriminant));
    const lambda1 = Math.max(0, 0.5 * (a + c - discriminant));
    const s0 = Math.sqrt(lambda0);
    const s1 = Math.sqrt(lambda1);
    if (s0 < 1e-30) {
        out.fill(0);
        out[0] = 1;
        out[3] = 1;
        out[6] = 1;
        out[9] = 1;
        return;
    }
    let vx;
    let vy;
    if (Math.abs(b) > 1e-15 * (a + c + 1)) {
        // Both forms are eigenvectors. Choosing the larger one avoids loss of
        // precision when one of them is close to zero.
        const ax = b;
        const ay = lambda0 - a;
        const bx = lambda0 - c;
        const by = b;
        if (ax * ax + ay * ay >= bx * bx + by * by) {
            const length = Math.hypot(ax, ay);
            vx = ax / length;
            vy = ay / length;
        }
        else {
            const length = Math.hypot(bx, by);
            vx = bx / length;
            vy = by / length;
        }
    }
    else if (a >= c) {
        vx = 1;
        vy = 0;
    }
    else {
        vx = 0;
        vy = 1;
    }
    // Second eigenvector; V = [v0 v1] has determinant +1.
    const wx = -vy;
    const wy = vx;
    let u0x = (f00 * vx + f01 * vy) / s0;
    let u0y = (f10 * vx + f11 * vy) / s0;
    const u0Length = Math.hypot(u0x, u0y);
    u0x /= u0Length;
    u0y /= u0Length;
    let u1x;
    let u1y;
    if (s1 > s0 * 1e-12) {
        u1x = (f00 * wx + f01 * wy) / s1;
        u1y = (f10 * wx + f11 * wy) / s1;
        // Re-orthogonalize to suppress round-off in nearly singular cases.
        const projection = u1x * u0x + u1y * u0y;
        u1x -= projection * u0x;
        u1y -= projection * u0y;
        const u1Length = Math.hypot(u1x, u1y);
        u1x /= u1Length;
        u1y /= u1Length;
    }
    else {
        const determinantSign = f00 * f11 - f01 * f10 < 0 ? -1 : 1;
        u1x = -u0y * determinantSign;
        u1y = u0x * determinantSign;
    }
    out[0] = u0x;
    out[1] = u1x;
    out[2] = u0y;
    out[3] = u1y;
    out[4] = s0;
    out[5] = s1;
    out[6] = vx;
    out[7] = wx;
    out[8] = vy;
    out[9] = wy;
}
/** Quadratic B-spline weights used by the original MLS-MPM kernel. */
export function quadraticWeights(fraction, out) {
    const a = 1.5 - fraction;
    const b = fraction - 1;
    const c = fraction - 0.5;
    out[0] = 0.5 * a * a;
    out[1] = 0.75 - b * b;
    out[2] = 0.5 * c * c;
}
