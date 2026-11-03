import { type Dec, type DecCtor, decimalWithPrecision, piFor } from "./decimal";
import type { Node } from "./parser";
import {
  DIM0,
  DIM_ANGLE,
  type Dim,
  type DisplayUnit,
  dimAdd,
  dimEq,
  dimIsZero,
  dimScale,
  dimSub,
  unitFactorAt,
} from "./units";

export interface Quantity {
  /** value in SI base units */
  v: Dec;
  dim: Dim;
  /** set when the quantity is an absolute temperature created from an offset unit */
  tempOffset?: Dec | null;
}

export type AngleMode = "rad" | "deg";

export class EvalError extends Error {}

export interface EvalContext {
  D: DecCtor;
  angle: AngleMode;
  /** set when a trigonometric function depended on the angle mode */
  usedAngleMode: boolean;
  /** explicit conversion target (`to mi`) */
  forcedUnit: DisplayUnit | null;
}

export function createContext(precision: number, angle: AngleMode): EvalContext {
  return { D: decimalWithPrecision(precision), angle, usedAngleMode: false, forcedUnit: null };
}

const TRIG_MAX_PRECISION = 1000;

function trigCtor(ctx: EvalContext): DecCtor {
  return ctx.D.precision > TRIG_MAX_PRECISION ? decimalWithPrecision(TRIG_MAX_PRECISION) : ctx.D;
}

function finite(v: Dec): Dec {
  if (!v.isFinite()) throw new EvalError("result is not finite");
  return v;
}

function linear(q: Quantity): Dec {
  return q.tempOffset ? q.v.minus(q.tempOffset) : q.v;
}

function plain(v: Dec): Quantity {
  return { v: finite(v), dim: DIM0 };
}

function toRadians(q: Quantity, ctx: EvalContext): Dec {
  if (dimEq(q.dim, DIM_ANGLE)) return q.v;
  if (!dimIsZero(q.dim)) throw new EvalError("angle expected");
  ctx.usedAngleMode = true;
  if (ctx.angle === "deg") return q.v.mul(piFor(ctx.D)).div(180);
  return q.v;
}

function fromRadians(v: Dec, ctx: EvalContext): Dec {
  ctx.usedAngleMode = true;
  return ctx.angle === "deg" ? v.mul(180).div(piFor(ctx.D)) : v;
}

function requirePlain(q: Quantity, what: string): Dec {
  if (!dimIsZero(q.dim)) throw new EvalError(`${what} expects a plain number`);
  return q.v;
}

function sameDim(a: Quantity, b: Quantity) {
  if (!dimEq(a.dim, b.dim)) throw new EvalError("dimension mismatch");
}

function nearInt(x: number): boolean {
  return Math.abs(x - Math.round(x)) < 1e-9;
}

function power(base: Quantity, exp: Quantity): Quantity {
  requirePlain(exp, "exponent");
  const e = exp.v;
  const b = linear(base);
  if (b.isNegative() && !e.isInteger()) throw new EvalError("negative base with fractional exponent");
  let dim: Dim = DIM0;
  if (!dimIsZero(base.dim)) {
    const en = e.toNumber();
    const scaled = dimScale(base.dim, en);
    if (!scaled.every(nearInt)) throw new EvalError("fractional dimension");
    dim = scaled.map(Math.round);
  }
  if (e.abs().gt(1e9) && !b.abs().eq(1)) throw new EvalError("exponent too large");
  return { v: finite(b.pow(e)), dim };
}

function factorial(x: Dec, D: DecCtor): Dec {
  if (!x.isInteger() || x.isNegative() || x.gt(3000)) throw new EvalError("factorial domain");
  let r = new D(1);
  const n = x.toNumber();
  for (let i = 2; i <= n; i++) r = r.mul(i);
  return r;
}

function callFunction(name: string, args: Quantity[], ctx: EvalContext): Quantity {
  const D = ctx.D;
  const arity = (n: number) => {
    if (args.length !== n) throw new EvalError(`${name} expects ${n} argument(s)`);
  };
  switch (name) {
    case "sin":
    case "cos":
    case "tan":
    case "sec":
    case "csc":
    case "cot": {
      arity(1);
      const x = toRadians(args[0], ctx);
      const T = trigCtor(ctx);
      const xt = new T(x);
      let r: Dec;
      switch (name) {
        case "sin": r = T.sin(xt); break;
        case "cos": r = T.cos(xt); break;
        case "tan": r = T.tan(xt); break;
        case "sec": r = new T(1).div(T.cos(xt)); break;
        case "csc": r = new T(1).div(T.sin(xt)); break;
        default: r = new T(1).div(T.tan(xt));
      }
      return plain(new D(r));
    }
    case "asin":
    case "arcsin":
    case "acos":
    case "arccos":
    case "atan":
    case "arctan": {
      arity(1);
      const x = requirePlain(args[0], name);
      const T = trigCtor(ctx);
      const xt = new T(x);
      const r = name.endsWith("sin") ? T.asin(xt) : name.endsWith("cos") ? T.acos(xt) : T.atan(xt);
      return plain(fromRadians(new D(r), ctx));
    }
    case "atan2": {
      arity(2);
      sameDim(args[0], args[1]);
      const T = trigCtor(ctx);
      const r = T.atan2(new T(args[0].v), new T(args[1].v));
      return plain(fromRadians(new D(r), ctx));
    }
    case "sinh":
    case "cosh":
    case "tanh":
    case "asinh":
    case "acosh":
    case "atanh": {
      arity(1);
      const x = requirePlain(args[0], name);
      const T = trigCtor(ctx);
      const xt = new T(x);
      const fn = T[name as "sinh"] as (v: Dec) => Dec;
      return plain(new D(fn.call(T, xt)));
    }
    case "sqrt": {
      arity(1);
      const q = args[0];
      const dim = dimScale(q.dim, 0.5);
      if (!dim.every(nearInt)) throw new EvalError("fractional dimension");
      if (linear(q).isNegative()) throw new EvalError("sqrt of negative");
      return { v: finite(linear(q).sqrt()), dim: dim.map(Math.round) };
    }
    case "cbrt": {
      arity(1);
      const q = args[0];
      const dim = dimScale(q.dim, 1 / 3);
      if (!dim.every(nearInt)) throw new EvalError("fractional dimension");
      return { v: finite(linear(q).cbrt()), dim: dim.map(Math.round) };
    }
    case "root": {
      arity(2);
      const n = requirePlain(args[1], name);
      return power(args[0], plain(new D(1).div(n)));
    }
    case "ln": {
      arity(1);
      return plain(requirePlain(args[0], name).ln());
    }
    case "log":
    case "log10":
    case "lg": {
      if (args.length === 2) return plain(D.log(requirePlain(args[0], name), requirePlain(args[1], name)));
      arity(1);
      return plain(D.log(requirePlain(args[0], name)));
    }
    case "log2": {
      arity(1);
      return plain(D.log2(requirePlain(args[0], name)));
    }
    case "exp": {
      arity(1);
      return plain(requirePlain(args[0], name).exp());
    }
    case "abs": {
      arity(1);
      return { v: linear(args[0]).abs(), dim: args[0].dim };
    }
    case "floor":
    case "ceil":
    case "trunc": {
      arity(1);
      const v = linear(args[0]);
      const r = name === "floor" ? v.floor() : name === "ceil" ? v.ceil() : v.trunc();
      return { v: r, dim: args[0].dim };
    }
    case "round": {
      if (args.length === 2) {
        const places = requirePlain(args[1], name).toNumber();
        return { v: linear(args[0]).toDecimalPlaces(places), dim: args[0].dim };
      }
      arity(1);
      return { v: linear(args[0]).round(), dim: args[0].dim };
    }
    case "sign": {
      arity(1);
      return plain(new D(linear(args[0]).isZero() ? 0 : linear(args[0]).isNegative() ? -1 : 1));
    }
    case "min":
    case "max": {
      if (!args.length) throw new EvalError("min/max expects arguments");
      let best = args[0];
      for (const a of args.slice(1)) {
        sameDim(best, a);
        const better = name === "min" ? linear(a).lt(linear(best)) : linear(a).gt(linear(best));
        if (better) best = a;
      }
      return best;
    }
    case "hypot": {
      arity(2);
      sameDim(args[0], args[1]);
      const a = linear(args[0]);
      const b = linear(args[1]);
      return { v: finite(a.mul(a).plus(b.mul(b)).sqrt()), dim: args[0].dim };
    }
    case "pow": {
      arity(2);
      return power(args[0], args[1]);
    }
    case "mod": {
      arity(2);
      sameDim(args[0], args[1]);
      if (linear(args[1]).isZero()) throw new EvalError("division by zero");
      return { v: linear(args[0]).mod(linear(args[1])), dim: args[0].dim };
    }
    case "fact":
    case "factorial": {
      arity(1);
      return plain(factorial(requirePlain(args[0], name), D));
    }
    default:
      throw new EvalError(`unknown function ${name}`);
  }
}

export function evaluate(node: Node, ctx: EvalContext): Quantity {
  const D = ctx.D;
  switch (node.kind) {
    case "num":
      return { v: new D(node.value), dim: DIM0 };
    case "quantity": {
      const f = unitFactorAt(node.unit, D);
      let v = new D(node.value).mul(f);
      let tempOffset: Dec | null = null;
      if (node.unit.offset) {
        tempOffset = new D(node.unit.offset);
        v = v.plus(tempOffset);
      }
      return { v: finite(v), dim: node.unit.dim, tempOffset };
    }
    case "unit":
      return { v: unitFactorAt(node.unit, D), dim: node.unit.dim };
    case "const": {
      switch (node.name) {
        case "pi":
        case "π":
          return plain(piFor(D));
        case "e":
          return plain(new D(1).exp());
        case "tau":
        case "τ":
          return plain(piFor(D).mul(2));
        default:
          return plain(new D(1).plus(new D(5).sqrt()).div(2));
      }
    }
    case "unary": {
      const q = evaluate(node.arg, ctx);
      if (node.op === "+") return q;
      if (q.tempOffset) return { v: linear(q).neg().plus(q.tempOffset), dim: q.dim, tempOffset: q.tempOffset };
      return { v: q.v.neg(), dim: q.dim };
    }
    case "postfix": {
      const q = evaluate(node.arg, ctx);
      if (node.op === "%") return { v: linear(q).div(100), dim: q.dim };
      return plain(factorial(requirePlain(q, "factorial"), D));
    }
    case "binary": {
      const l = evaluate(node.left, ctx);
      const r = evaluate(node.right, ctx);
      switch (node.op) {
        case "+":
        case "-": {
          sameDim(l, r);
          const lv = linear(l);
          const rv = linear(r);
          return { v: finite(node.op === "+" ? lv.plus(rv) : lv.minus(rv)), dim: l.dim };
        }
        case "*":
        case "implicit":
          return { v: finite(linear(l).mul(linear(r))), dim: dimAdd(l.dim, r.dim) };
        case "/": {
          const rv = linear(r);
          if (rv.isZero()) throw new EvalError("division by zero");
          return { v: finite(linear(l).div(rv)), dim: dimSub(l.dim, r.dim) };
        }
        case "**":
          return power(l, r);
      }
      break;
    }
    case "call": {
      const args = node.args.map((a) => evaluate(a, ctx));
      return callFunction(node.name, args, ctx);
    }
    case "convert": {
      const q = evaluate(node.expr, ctx);
      if (!dimEq(q.dim, node.target.dim)) throw new EvalError("cannot convert between these units");
      ctx.forcedUnit = node.target;
      return q;
    }
  }
  throw new EvalError("unsupported expression");
}
