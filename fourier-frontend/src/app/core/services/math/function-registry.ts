/**
 * Single source of truth for all mathematical functions supported by the app.
 *
 * Every layer that needs to know about functions — LaTeX parsing, Maxima→JS
 * compilation, MathQuill operator recognition — derives its data from this
 * registry instead of maintaining its own hardcoded list.
 *
 * Adding a new function means adding ONE entry here. Nothing else needs to
 * change unless the function requires a custom JS implementation (add to the
 * _helpers string in MathUtilsService then).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FunctionCategory =
  | 'trig'
  | 'inverse-trig'
  | 'hyperbolic'
  | 'inverse-hyperbolic'
  | 'exp-log'
  | 'rounding'
  | 'combinatorial'
  | 'error'
  | 'exponential-integral'
  | 'signal'
  | 'misc';

/**
 * How a function is translated to JavaScript.
 *
 * - `'Math'`   — maps to the corresponding Math static method: Math.<method>(arg)
 * - `'helper'` — maps to a custom helper defined in MathUtilsService._helpers
 * - `'inline'` — the call is replaced with an inline JS expression;
 *                use `$arg` as the placeholder for the argument string
 * - `'stub'`   — no simple JS equivalent; handled separately (signal functions)
 *                or replaced with NaN for unknown functions
 */
export type JsTranslation =
  | { kind: 'Math'; method: string }
  | { kind: 'helper'; name: string }
  | { kind: 'inline'; js: string }
  | { kind: 'stub' };

export interface FunctionDef {
  /** Canonical Maxima name used as the internal identifier. */
  maxima: string;
  /**
   * All LaTeX/plain-text names the parser accepts for this function.
   * Includes primary names, locale aliases (sen, tg…) and arc* variants.
   */
  latexNames: string[];
  /** How this function is translated to JavaScript for client-side evaluation. */
  js: JsTranslation;
  category: FunctionCategory;
  /**
   * When true, this function is translated client-side (never sent to tex2max).
   * Applies to functions tex2max doesn't know: erf, erfc, and expintegral_*.
   */
  clientSideOnly?: boolean;
  /**
   * Subset of latexNames to register in MathQuill's autoOperatorNames.
   * If omitted, NONE of this function's names go into autoOperatorNames.
   *
   * Rules for inclusion:
   * - Must be a name the user actually types freely (not a parser-only alias)
   * - Must be ≥2 characters (single letters like 'u' conflict with variables)
   * - Must not start with a digit or uppercase that conflicts with variables
   * - Aliases only needed for parsing (arc*, atg, senh…) stay in latexNames only
   */
  autoOperatorNames?: string[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const FUNCTION_REGISTRY: FunctionDef[] = [
  // ── Trigonometric ──────────────────────────────────────────────────────────
  { maxima: 'sin', latexNames: ['sin', 'sen'],     js: { kind: 'Math', method: 'sin'  }, category: 'trig', autoOperatorNames: ['sin', 'sen'] },
  { maxima: 'cos', latexNames: ['cos'],            js: { kind: 'Math', method: 'cos'  }, category: 'trig', autoOperatorNames: ['cos'] },
  { maxima: 'tan', latexNames: ['tan', 'tg'],      js: { kind: 'Math', method: 'tan'  }, category: 'trig', autoOperatorNames: ['tan', 'tg'] },
  { maxima: 'cot', latexNames: ['cot', 'ctg'],     js: { kind: 'helper', name: '_cot' }, category: 'trig', autoOperatorNames: ['cot', 'ctg'] },
  { maxima: 'sec', latexNames: ['sec'],            js: { kind: 'helper', name: '_sec' }, category: 'trig', autoOperatorNames: ['sec'] },
  { maxima: 'csc', latexNames: ['csc'],            js: { kind: 'helper', name: '_csc' }, category: 'trig', autoOperatorNames: ['csc'] },

  // ── Inverse trigonometric ──────────────────────────────────────────────────
  // latexNames has all aliases the parser accepts.
  // autoOperatorNames only has names the user types directly in MathQuill.
  { maxima: 'asin',  latexNames: ['asin', 'arcsin', 'asen', 'arcsen'],  js: { kind: 'Math', method: 'asin'  }, category: 'inverse-trig', autoOperatorNames: ['asin', 'arcsin', 'asen', 'arcsen'] },
  { maxima: 'acos',  latexNames: ['acos', 'arccos'],                     js: { kind: 'Math', method: 'acos'  }, category: 'inverse-trig', autoOperatorNames: ['acos', 'arccos'] },
  { maxima: 'atan',  latexNames: ['atan', 'arctan', 'atg', 'arctg'],    js: { kind: 'Math', method: 'atan'  }, category: 'inverse-trig', autoOperatorNames: ['atan', 'arctan', 'atg', 'arctg'] },
  { maxima: 'acot',  latexNames: ['acot', 'arccot', 'actg', 'arcctg'], js: { kind: 'helper', name: '_acot' }, category: 'inverse-trig', autoOperatorNames: ['acot', 'arccot', 'actg', 'arcctg'] },
  { maxima: 'asec',  latexNames: ['asec', 'arcsec'],                     js: { kind: 'helper', name: '_asec' }, category: 'inverse-trig', autoOperatorNames: ['asec', 'arcsec'] },
  { maxima: 'acsc',  latexNames: ['acsc', 'arccsc'],                     js: { kind: 'helper', name: '_acsc' }, category: 'inverse-trig', autoOperatorNames: ['acsc', 'arccsc'] },
  // atan2: used internally, not typed by users.
  { maxima: 'atan2', latexNames: ['atan2'],                              js: { kind: 'Math', method: 'atan2' }, category: 'inverse-trig' },

  // ── Hyperbolic ─────────────────────────────────────────────────────────────
  { maxima: 'sinh', latexNames: ['sinh', 'senh'],  js: { kind: 'Math', method: 'sinh'  }, category: 'hyperbolic', autoOperatorNames: ['sinh', 'senh'] },
  { maxima: 'cosh', latexNames: ['cosh'],          js: { kind: 'Math', method: 'cosh'  }, category: 'hyperbolic', autoOperatorNames: ['cosh'] },
  { maxima: 'tanh', latexNames: ['tanh', 'tgh'],   js: { kind: 'Math', method: 'tanh'  }, category: 'hyperbolic', autoOperatorNames: ['tanh', 'tgh'] },
  { maxima: 'coth', latexNames: ['coth', 'ctgh'],  js: { kind: 'helper', name: '_coth' }, category: 'hyperbolic', autoOperatorNames: ['coth', 'ctgh'] },
  { maxima: 'sech', latexNames: ['sech'],          js: { kind: 'helper', name: '_sech' }, category: 'hyperbolic', autoOperatorNames: ['sech'] },
  { maxima: 'csch', latexNames: ['csch'],          js: { kind: 'helper', name: '_csch' }, category: 'hyperbolic', autoOperatorNames: ['csch'] },

  // ── Inverse hyperbolic ─────────────────────────────────────────────────────
  { maxima: 'asinh', latexNames: ['asinh', 'arcsinh', 'asenh', 'arcsenh'], js: { kind: 'Math', method: 'asinh' }, category: 'inverse-hyperbolic', autoOperatorNames: ['asinh', 'arcsinh', 'asenh', 'arcsenh'] },
  { maxima: 'acosh', latexNames: ['acosh', 'arccosh'],                      js: { kind: 'Math', method: 'acosh' }, category: 'inverse-hyperbolic', autoOperatorNames: ['acosh', 'arccosh'] },
  { maxima: 'atanh', latexNames: ['atanh', 'arctanh', 'atgh', 'arctgh'],   js: { kind: 'Math', method: 'atanh' }, category: 'inverse-hyperbolic', autoOperatorNames: ['atanh', 'arctanh', 'atgh', 'arctgh'] },
  { maxima: 'acoth', latexNames: ['acoth', 'arccoth', 'actgh', 'arcctgh'], js: { kind: 'inline', js: '(Math.log(($arg+1)/($arg-1))/2)' },                             category: 'inverse-hyperbolic', autoOperatorNames: ['acoth', 'arccoth', 'actgh', 'arcctgh'] },
  { maxima: 'asech', latexNames: ['asech', 'arcsech'],                      js: { kind: 'inline', js: '(Math.log((1+Math.sqrt(1-($arg)*($arg)))/($arg)))' },           category: 'inverse-hyperbolic', autoOperatorNames: ['asech', 'arcsech'] },
  { maxima: 'acsch', latexNames: ['acsch', 'arccsch'],                      js: { kind: 'inline', js: '(Math.log(1/($arg)+Math.sqrt(1/(($arg)*($arg))+1)))' },         category: 'inverse-hyperbolic', autoOperatorNames: ['acsch', 'arccsch'] },

  // ── Exponential / Logarithmic ──────────────────────────────────────────────
  { maxima: 'exp',   latexNames: ['exp'],       js: { kind: 'Math', method: 'exp'   }, category: 'exp-log', autoOperatorNames: ['exp'] },
  { maxima: 'log',   latexNames: ['log', 'ln'], js: { kind: 'Math', method: 'log'   }, category: 'exp-log', autoOperatorNames: ['log', 'ln'] },
  // log2/log10: parsed as bare words; not typed freely in MathQuill.
  { maxima: 'log2',  latexNames: ['log2'],      js: { kind: 'Math', method: 'log2'  }, category: 'exp-log' },
  { maxima: 'log10', latexNames: ['log10'],     js: { kind: 'Math', method: 'log10' }, category: 'exp-log' },
  // sqrt enters via autoCommands ('sqrt'), not autoOperatorNames.
  { maxima: 'sqrt',  latexNames: ['sqrt'],      js: { kind: 'Math', method: 'sqrt'  }, category: 'exp-log' },

  // ── Misc ───────────────────────────────────────────────────────────────────
  // abs is typed as |x| or via keyboard; max/min/floor/etc. are not freely typed.
  { maxima: 'abs',  latexNames: ['abs'],         js: { kind: 'Math', method: 'abs'  }, category: 'misc', autoOperatorNames: ['abs'] },
  { maxima: 'max',  latexNames: ['max'],         js: { kind: 'Math', method: 'max'  }, category: 'misc' },
  { maxima: 'min',  latexNames: ['min'],         js: { kind: 'Math', method: 'min'  }, category: 'misc' },
  { maxima: 'sign', latexNames: ['sign', 'sgn'], js: { kind: 'Math', method: 'sign' }, category: 'misc', autoOperatorNames: ['sgn'] },

  // ── Rounding ───────────────────────────────────────────────────────────────
  { maxima: 'floor',    latexNames: ['floor'],    js: { kind: 'Math', method: 'floor' }, category: 'rounding' },
  { maxima: 'ceiling',  latexNames: ['ceiling'],  js: { kind: 'Math', method: 'ceil'  }, category: 'rounding' },
  { maxima: 'round',    latexNames: ['round'],    js: { kind: 'Math', method: 'round' }, category: 'rounding' },
  { maxima: 'truncate', latexNames: ['truncate'], js: { kind: 'Math', method: 'trunc' }, category: 'rounding' },

  // ── Combinatorial / Gamma family ───────────────────────────────────────────
  // gamma_incomplete_* and beta are too long to type freely — no autoOperatorNames.
  // They are inserted via the function keyboard only.
  { maxima: 'gamma',                        latexNames: ['gamma', 'Gamma'],                                 js: { kind: 'helper', name: '_gamma'                        }, category: 'combinatorial', autoOperatorNames: ['gamma'] },
  // Incomplete gamma & beta: typed as GammaU/GammaL/GammaQ/Beta (no underscores — MathQuill treats _ as subscript)
  // clientSideOnly: tex2max can't handle multi-argument functions with commas
  { maxima: 'gamma_incomplete',             latexNames: ['GammaU', 'GammaInc'],                            js: { kind: 'helper', name: '_gamma_incomplete'             }, category: 'combinatorial', clientSideOnly: true, autoOperatorNames: ['GammaU', 'GammaInc'] },
  { maxima: 'gamma_incomplete_lower',       latexNames: ['GammaL', 'GammaIncLower'],                       js: { kind: 'helper', name: '_gamma_incomplete_lower'       }, category: 'combinatorial', clientSideOnly: true, autoOperatorNames: ['GammaL', 'GammaIncLower'] },
  { maxima: 'gamma_incomplete_regularized', latexNames: ['GammaQ', 'GammaReg', 'GammaIncReg'],             js: { kind: 'helper', name: '_gamma_incomplete_regularized' }, category: 'combinatorial', clientSideOnly: true, autoOperatorNames: ['GammaQ', 'GammaReg'] },
  { maxima: 'beta',                         latexNames: ['Beta'],                                           js: { kind: 'helper', name: '_beta'                         }, category: 'combinatorial', clientSideOnly: true, autoOperatorNames: ['Beta'] },
  { maxima: 'factorial', latexNames: ['factorial'], js: { kind: 'helper', name: '_factorial' }, category: 'combinatorial', autoOperatorNames: ['factorial'] },

  // ── Complex-domain functions (clientSideOnly — the GLSL compiler handles them) ─
  { maxima: 'arg',   latexNames: ['arg'],  js: { kind: 'stub' }, category: 'misc', clientSideOnly: true, autoOperatorNames: ['arg'] },
  { maxima: 're',    latexNames: ['re'],   js: { kind: 'stub' }, category: 'misc', clientSideOnly: true, autoOperatorNames: ['re'] },
  { maxima: 'im',    latexNames: ['im'],   js: { kind: 'stub' }, category: 'misc', clientSideOnly: true, autoOperatorNames: ['im'] },
  { maxima: 'conj',  latexNames: ['conj'], js: { kind: 'stub' }, category: 'misc', clientSideOnly: true, autoOperatorNames: ['conj'] },
  { maxima: 'zeta',  latexNames: ['zeta'], js: { kind: 'stub' }, category: 'misc', clientSideOnly: true, autoOperatorNames: ['zeta'] },

  // ── Error functions ────────────────────────────────────────────────────────
  { maxima: 'erf',  latexNames: ['erf'],  js: { kind: 'helper', name: '_erf'  }, category: 'error', clientSideOnly: true, autoOperatorNames: ['erf'] },
  { maxima: 'erfc', latexNames: ['erfc'], js: { kind: 'helper', name: '_erfc' }, category: 'error', clientSideOnly: true, autoOperatorNames: ['erfc'] },
  { maxima: 'erfi', latexNames: ['erfi'], js: { kind: 'stub'                  }, category: 'error', clientSideOnly: true, autoOperatorNames: ['erfi'] },

  // ── Exponential integral functions ─────────────────────────────────────────
  // E1 and li conflict with variable names — omitted from autoOperatorNames.
  { maxima: 'expintegral_si',  latexNames: ['Si'],  js: { kind: 'helper', name: '_Si'  }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['Si'] },
  { maxima: 'si',              latexNames: ['si'],  js: { kind: 'stub'                 }, category: 'exponential-integral', clientSideOnly: true },
  { maxima: 'expintegral_ci',  latexNames: ['Ci'],  js: { kind: 'helper', name: '_Ci'  }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['Ci'] },
  { maxima: 'Cin',             latexNames: ['Cin'], js: { kind: 'stub'                 }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['Cin'] },
  { maxima: 'expintegral_shi', latexNames: ['Shi'], js: { kind: 'helper', name: '_Shi' }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['Shi'] },
  { maxima: 'expintegral_chi', latexNames: ['Chi'], js: { kind: 'helper', name: '_Chi' }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['Chi'] },
  { maxima: 'expintegral_ei',  latexNames: ['Ei'],  js: { kind: 'helper', name: '_Ei'  }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['Ei'] },
  { maxima: 'expintegral_e1',  latexNames: ['E1'],  js: { kind: 'helper', name: '_E1'  }, category: 'exponential-integral', clientSideOnly: true },
  { maxima: 'expintegral_li',  latexNames: ['li'],  js: { kind: 'helper', name: '_li'  }, category: 'exponential-integral', clientSideOnly: true },
  { maxima: 'fresnelC', latexNames: ['fresnelC', 'FresnelC'], js: { kind: 'helper', name: '_fresnelC' }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['fresnelC', 'FresnelC'] },
  { maxima: 'fresnelS', latexNames: ['fresnelS', 'FresnelS'], js: { kind: 'helper', name: '_fresnelS' }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['fresnelS', 'FresnelS'] },
  { maxima: 'fresnelK', latexNames: ['fresnelK', 'FresnelK'], js: { kind: 'helper', name: '_fresnelK' }, category: 'exponential-integral', clientSideOnly: true, autoOperatorNames: ['fresnelK', 'FresnelK'] },

  // ── Signal / distribution functions ───────────────────────────────────────
  // 'u' is a single letter — excluded from autoOperatorNames to allow variable use.
  { maxima: 'delta', latexNames: ['delta'], js: { kind: 'stub' }, category: 'signal', autoOperatorNames: ['delta'] },
  { maxima: 'u',     latexNames: ['u'],     js: { kind: 'stub' }, category: 'signal' },
  { maxima: 'rect',  latexNames: ['rect'],  js: { kind: 'stub' }, category: 'signal', autoOperatorNames: ['rect'] },
  { maxima: 'tri',   latexNames: ['tri'],   js: { kind: 'stub' }, category: 'signal', autoOperatorNames: ['tri'] },
  { maxima: 'sinc',  latexNames: ['sinc'],  js: { kind: 'stub' }, category: 'signal', autoOperatorNames: ['sinc'] },
];

// ── Derived maps (computed once at module load) ────────────────────────────────

/**
 * All latexNames that should be intercepted client-side (never sent to tex2max).
 * Derived from entries with clientSideOnly: true.
 */
export const CLIENT_SIDE_LATEX_NAMES: ReadonlySet<string> = new Set(
  FUNCTION_REGISTRY.filter((f) => f.clientSideOnly).flatMap((f) => f.latexNames),
);

/**
 * Map from every latexName to its canonical Maxima name.
 * Used by the LaTeX parser to normalize function names.
 */
export const LATEX_TO_MAXIMA: ReadonlyMap<string, string> = new Map(
  FUNCTION_REGISTRY.flatMap((f) => f.latexNames.map((n) => [n, f.maxima])),
);

/**
 * Space-separated string for MathQuill's autoOperatorNames.
 * Built from each entry's explicit autoOperatorNames list — only names the user
 * actually types freely. Longer names first so MathQuill matches 'arcsin' before 'sin'.
 */
export const AUTO_OPERATOR_NAMES: string = FUNCTION_REGISTRY
  .flatMap((f) => f.autoOperatorNames ?? [])
  .sort((a, b) => b.length - a.length || a.localeCompare(b))
  .join(' ');

/**
 * Ordered list of registry entries for the Maxima→JS replacement pipeline.
 * Sorted by maxima name length descending so longer names match before shorter
 * prefixes (e.g. 'asinh' before 'sinh', 'atanh' before 'tanh').
 * Entries with kind:'stub' are excluded — they are handled by _replaceNestedFn.
 */
export const REGISTRY_FOR_JS: ReadonlyArray<FunctionDef> = FUNCTION_REGISTRY
  .filter((f) => f.js.kind !== 'stub')
  .sort((a, b) => b.maxima.length - a.maxima.length || a.maxima.localeCompare(b.maxima));
