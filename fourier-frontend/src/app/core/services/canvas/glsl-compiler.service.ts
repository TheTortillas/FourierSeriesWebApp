import { Injectable } from '@angular/core';

// ── GLSL complex math library (included verbatim in every shader) ─────────────

export const COMPLEX_LIB = `
const float PI = 3.141592653589793;
const float E  = 2.718281828459045;

float _sh(float x){ return (exp(x)-exp(-x))*0.5; }
float _ch(float x){ return (exp(x)+exp(-x))*0.5; }

vec2 cmul(vec2 a,vec2 b){ return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x); }
vec2 cdiv(vec2 a,vec2 b){
  float d=max(b.x*b.x+b.y*b.y,1e-30);
  return vec2((a.x*b.x+a.y*b.y)/d,(a.y*b.x-a.x*b.y)/d);
}
vec2 cexp(vec2 z){ return exp(z.x)*vec2(cos(z.y),sin(z.y)); }
vec2 clog(vec2 z){ return vec2(log(max(length(z),1e-30)),atan(z.y,z.x)); }
vec2 cpow(vec2 z,vec2 w){
  if(abs(z.x)<1e-15&&abs(z.y)<1e-15) return vec2(0.0);
  return cexp(cmul(w,clog(z)));
}
vec2 csqrt(vec2 z){
  float r=length(z);
  float s=z.y<0.0?-1.0:1.0;
  return vec2(sqrt((r+z.x)*0.5),s*sqrt(max((r-z.x)*0.5,0.0)));
}
vec2 csin(vec2 z){ return vec2(sin(z.x)*_ch(z.y),cos(z.x)*_sh(z.y)); }
vec2 ccos(vec2 z){ return vec2(cos(z.x)*_ch(z.y),-sin(z.x)*_sh(z.y)); }
vec2 ctan(vec2 z){ return cdiv(csin(z),ccos(z)); }
vec2 csinh(vec2 z){ return vec2(_sh(z.x)*cos(z.y),_ch(z.x)*sin(z.y)); }
vec2 ccosh(vec2 z){ return vec2(_ch(z.x)*cos(z.y),_sh(z.x)*sin(z.y)); }
vec2 ctanh(vec2 z){ return cdiv(csinh(z),ccosh(z)); }
vec2 casin(vec2 z){
  vec2 v=clog(vec2(-z.y,z.x)+csqrt(vec2(1.0,0.0)-cmul(z,z)));
  return vec2(v.y,-v.x);
}
vec2 cacos(vec2 z){
  vec2 iw=csqrt(vec2(1.0,0.0)-cmul(z,z));
  vec2 v=clog(z+vec2(-iw.y,iw.x));
  return vec2(v.y,-v.x);
}
vec2 catan(vec2 z){
  vec2 iz=vec2(-z.y,z.x);
  vec2 d=clog(vec2(1.0,0.0)-iz)-clog(vec2(1.0,0.0)+iz);
  return vec2(-d.y*0.5,d.x*0.5);
}
vec2 cabs_f(vec2 z){ return vec2(length(z),0.0); }
vec2 carg_f(vec2 z){ return vec2(atan(z.y,z.x),0.0); }
vec2 cconj(vec2 z) { return vec2(z.x,-z.y); }

// Asymptotic auxiliary functions for Si/Ci (A&S 5.2.8), optimal truncation.
// Accurate for |z| > 14; for smaller |z| the Taylor below is used instead.
// tf[k] = tf[k-1] * (-1/z^2) * 2k(2k-1),  tg[k] = tg[k-1] * (-1/z^2) * (2k+1)(2k)
void _sfg(vec2 z, out vec2 fv, out vec2 gv){
  vec2 zz=cmul(z,z);
  vec2 iz2=cdiv(vec2(-1.0,0.0),zz);
  vec2 tf=vec2(1.0,0.0),sf=vec2(1.0,0.0);
  vec2 tg=vec2(1.0,0.0),sg=vec2(1.0,0.0);
  for(int k=1;k<=12;k++){
    float fk=float(k);
    vec2 ntf=cmul(tf,iz2*(2.0*fk*(2.0*fk-1.0)));
    vec2 ntg=cmul(tg,iz2*((2.0*fk+1.0)*(2.0*fk)));
    // Stop when terms grow (optimal asymptotic truncation)
    if(dot(ntf,ntf)>=dot(tf,tf)) break;
    tf=ntf; tg=ntg; sf+=tf; sg+=tg;
  }
  fv=cdiv(sf,z);
  gv=cdiv(sg,zz);
}

// Si(z) = integral_0^z sin(t)/t dt  [entire function, Si(-z) = -Si(z)]
// Taylor for |z|<=14; asymptotic (A&S 5.2.6) for |z|>14.
// For Re(z)<0 we fold: Si(z) = -Si(-z), reducing to Re>0 half-plane and
// avoiding float32 cancellation in the alternating Taylor on the negative axis.
vec2 csi(vec2 z){
  float negRe=step(z.x,0.0);          // 1.0 if Re(z)<=0
  vec2 zp=z*(1.0-2.0*negRe);          // zp = z if Re>=0, -z if Re<0
  vec2 result;
  if(dot(zp,zp)<196.0){
    vec2 zz=cmul(zp,zp),u=zp,s=vec2(0.0);
    float sg=1.0;
    for(int i=0;i<80;i++){
      float k=float(i);
      s+=sg*cdiv(u,vec2(2.0*k+1.0,0.0));
      u=cmul(u,cdiv(zz,vec2((2.0*k+2.0)*(2.0*k+3.0),0.0)));
      sg=-sg;
    }
    result=s;
  } else {
    vec2 fv,gv; _sfg(zp,fv,gv);
    // Asymptotic constant is +π/2 for Re(z)>0 (A&S 5.2.6); we always use Re(zp)>=0 here.
    result=vec2(PI*0.5,0.0)-cmul(fv,ccos(zp))-cmul(gv,csin(zp));
  }
  return result*(1.0-2.0*negRe);      // negate back if original Re(z)<0
}
vec2 cssi(vec2 z){ return csi(z)-vec2(PI*0.5,0.0); }

// Ci(z) = gamma + ln z + integral_0^z (cos t - 1)/t dt
// Taylor for |z|<=14; asymptotic (A&S 5.2.6) for |z|>14.
// Asymptotic is valid only for |arg z| < π. For Re(z)<0 in the large branch,
// fold via Ci(-z) = Ci(z) ∓ iπ  (−iπ if Im z ≥ 0, +iπ if Im z < 0).
// Branch cut of Ci is on (−∞, 0); Taylor handles it via clog's principal branch.
vec2 cci(vec2 z){
  if(dot(z,z)<196.0){
    const float EG=0.5772156649015329;
    vec2 zz=cmul(z,z),w=cdiv(zz,vec2(2.0,0.0)),s=vec2(0.0);
    float sg=-1.0;
    for(int i=0;i<80;i++){
      float n=float(i)+1.0;
      s+=sg*cdiv(w,vec2(2.0*n,0.0));
      w=cmul(w,cdiv(zz,vec2((2.0*n+1.0)*(2.0*n+2.0),0.0)));
      sg=-sg;
    }
    return vec2(EG,0.0)+clog(z)+s;
  }
  // Large |z|: asymptotic only valid for Re(z)>0; fold negative side.
  if(z.x<0.0){
    // Ci(-z) = Ci(z) - iπ·sign(Im z), so Ci(z) = Ci(-z) + iπ·sign(Im z)
    float sgn=z.y>=0.0?1.0:-1.0;
    vec2 zn=vec2(-z.x,-z.y);
    vec2 fv,gv; _sfg(zn,fv,gv);
    vec2 cin=cmul(fv,csin(zn))-cmul(gv,ccos(zn));
    return cin+vec2(0.0,PI*sgn);
  }
  vec2 fv,gv; _sfg(z,fv,gv);
  return cmul(fv,csin(z))-cmul(gv,ccos(z));
}

vec2 ccin(vec2 z){
  vec2 zz=cmul(z,z);
  vec2 w=cdiv(zz,vec2(2.0,0.0));
  vec2 s=vec2(0.0);
  float sg=1.0;
  for(int i=0;i<80;i++){
    float n=float(i)+1.0;
    s+=sg*cdiv(w,vec2(2.0*n,0.0));
    w=cmul(w,cdiv(zz,vec2((2.0*n+1.0)*(2.0*n+2.0),0.0)));
    sg=-sg;
  }
  return s;
}

vec2 cerf(vec2 z){
  float r2=dot(z,z);
  if(r2<16.0){
    // Taylor: erf(z) = (2/√π)·z·Σ_{n=0}^∞ (-1)^n z^{2n} / (n!(2n+1))
    vec2 zz=cmul(z,z),t=z,s=vec2(0.0);
    float sg=1.0,fac=1.0;
    for(int n=0;n<40;n++){
      float k=float(n);
      s+=sg*cdiv(t,vec2(fac*(2.0*k+1.0),0.0));
      t=cmul(t,zz); fac*=k+1.0; sg=-sg;
    }
    return s*1.1283791670955126;
  }else{
    // Asymptotic erfc(z) ~ exp(-z²)/√π · (1/z) Σ (-(2k-1)!!)/(2z²)^k
    // Optimal truncation: stop when |tk| starts growing.
    vec2 zz=cmul(z,z);
    vec2 tk=vec2(1.0,0.0),s=vec2(1.0,0.0);
    for(int k=1;k<=20;k++){
      float fk=float(k);
      vec2 ntk=cmul(tk,cdiv(vec2(-(2.0*fk-1.0),0.0),cmul(vec2(2.0,0.0),zz)));
      if(dot(ntk,ntk)>=dot(tk,tk)) break;
      tk=ntk; s+=tk;
    }
    vec2 erfc_z=cdiv(cmul(cexp(-zz),s),z*1.7724538509055159);
    return vec2(1.0,0.0)-erfc_z;
  }
}
vec2 cerfc(vec2 z){ return vec2(1.0,0.0)-cerf(z); }
vec2 cerfi(vec2 z){
  vec2 w=cerf(vec2(-z.y,z.x));
  return vec2(w.y,-w.x);
}

vec2 _gcore(vec2 z){
  z.x-=1.0;
  vec2 x=vec2(0.99999999999980993,0.0);
  x+=cdiv(vec2( 676.5203681218851,   0.0),vec2(z.x+1.0,z.y));
  x+=cdiv(vec2(-1259.1392167224028,  0.0),vec2(z.x+2.0,z.y));
  x+=cdiv(vec2( 771.32342877765313,  0.0),vec2(z.x+3.0,z.y));
  x+=cdiv(vec2(-176.61502916214059,  0.0),vec2(z.x+4.0,z.y));
  x+=cdiv(vec2(  12.507343278686905, 0.0),vec2(z.x+5.0,z.y));
  x+=cdiv(vec2(  -0.13857109526572,  0.0),vec2(z.x+6.0,z.y));
  x+=cdiv(vec2(   9.98436957802e-6,  0.0),vec2(z.x+7.0,z.y));
  x+=cdiv(vec2(   1.50563273515e-7,  0.0),vec2(z.x+8.0,z.y));
  vec2 t=vec2(z.x+7.5,z.y);
  return cmul(vec2(2.5066282746310002,0.0),
         cmul(cpow(t,vec2(z.x+0.5,z.y)),cmul(cexp(-t),x)));
}
vec2 cgamma(vec2 z){
  if(z.x<0.5){
    vec2 sp=csin(vec2(PI*z.x,PI*z.y));
    return cdiv(vec2(PI,0.0),cmul(sp,_gcore(vec2(1.0-z.x,-z.y))));
  }
  return _gcore(z);
}

// Shi(z) = -i · Si(iz)   [A&S 5.2.21]
vec2 cshi(vec2 z){
  vec2 iz=vec2(-z.y,z.x);
  vec2 siiz=csi(iz);
  return vec2(siiz.y,-siiz.x); // multiply by -i: (a+bi)*(-i) = (b,-a)
}

// Chi(z) = Ci(iz) - iπ/2   [A&S 5.2.22, valid for Re(z)>0]
vec2 cchi(vec2 z){
  vec2 iz=vec2(-z.y,z.x);
  return cci(iz)-vec2(0.0,PI*0.5);
}

// beta(a,b) = Γ(a)·Γ(b) / Γ(a+b)
vec2 cbeta(vec2 a,vec2 b){
  return cdiv(cmul(cgamma(a),cgamma(b)),cgamma(a+b));
}

// factorial(z) = Γ(z+1)
vec2 cfactorial(vec2 z){ return cgamma(z+vec2(1.0,0.0)); }

// Fresnel K(z) = ∫₀ᶻ exp(-iξ²) dξ  via erf:
// K(z) = (√π/2) · erf( (1-i)/√2 · z )   [Apéndice E, relación con cerf]
vec2 cfresnelK(vec2 z){
  // (1-i)/sqrt(2) = vec2(1/sqrt(2), -1/sqrt(2))
  float s=0.7071067811865476; // 1/√2
  vec2 w=cmul(vec2(s,-s),z);
  // (√π/2) ≈ 0.8862269254527580
  return cmul(vec2(0.8862269254527580,0.0),cerf(w));
}

// FresnelC(z) = Re(K(z)), FresnelS(z) = Im(K(z))
vec2 cfresnelC(vec2 z){ return vec2(cfresnelK(z).x,0.0); }
vec2 cfresnelS(vec2 z){ return vec2(cfresnelK(z).y,0.0); }

// ζ(z) — Riemann Zeta via Borwein (1991), n=30 Chebyshev-accelerated Euler sum.
// Formula: ζ(z) = -1/(d_n*(1-2^(1-z))) * Σ_{k=0}^{n-1} (-1)^k*(d_k-d_n)/(k+1)^z
// n=30 chosen so |error| < 1e-4 at all nontrivial zeros up to Im(z)~35.
// (n=12 gives |error|~0.1–0.5 at zeros; n=30 gives <1e-5 in float64, <1e-3 in float32.)
vec2 _zetaCore(vec2 z){
  float e[30];
  e[0]=-1.00000000; e[1]=-1.00000000; e[2]=-1.00000000; e[3]=-1.00000000;
  e[4]=-1.00000000; e[5]=-1.00000000; e[6]=-1.00000000; e[7]=-1.00000000;
  e[8]=-0.99999997; e[9]=-0.99999970; e[10]=-0.99999736; e[11]=-0.99998114;
  e[12]=-0.99988958; e[13]=-0.99946361; e[14]=-0.99781607; e[15]=-0.99248333;
  e[16]=-0.97796885; e[17]=-0.94464503; e[18]=-0.88000740; e[19]=-0.77408628;
  e[20]=-0.62769786; e[21]=-0.45767647; e[22]=-0.29268742; e[23]=-0.16005854;
  e[24]=-0.07281508; e[25]=-0.02666506; e[26]=-0.00752290; e[27]=-0.00153011;
  e[28]=-0.00019924; e[29]=-0.00001245;
  vec2 sum=vec2(0.0);
  for(int k=0;k<30;k++){
    float sgn=mod(float(k),2.0)==0.0?1.0:-1.0;
    vec2 kpow=cexp(cmul(z,clog(vec2(float(k)+1.0,0.0))));
    sum+=cmul(vec2(sgn*e[k],0.0),cdiv(vec2(1.0,0.0),kpow));
  }
  // divide by -(1 - 2^(1-z))
  vec2 two1z=cexp(cmul(vec2(1.0,0.0)-z,clog(vec2(2.0,0.0))));
  return cdiv(cmul(vec2(-1.0,0.0),sum), vec2(1.0,0.0)-two1z);
}

vec2 czeta(vec2 z){
  // Only true pole of ζ is at z=1 (simple). Guard only there.
  // Do NOT guard on |1-2^(1-z)|: that denominator has infinitely many zeros
  // at z=1+2πki/ln2 (≈1±9.06i, ±18.13i,...) where numerator also vanishes
  // (removable singularity) — clamping those creates false spikes in the plot.
  if(abs(z.x-1.0)<0.02 && abs(z.y)<0.02) return vec2(1e6,0.0);
  if(z.x>=0.5) return _zetaCore(z);
  // Reflection formula: ζ(z) = 2^z π^(z-1) sin(πz/2) Γ(1-z) ζ(1-z)
  vec2 w=vec2(1.0-z.x,-z.y);
  vec2 two_z =cexp(cmul(z,             clog(vec2(2.0,0.0))));
  vec2 pi_z1 =cexp(cmul(z-vec2(1.0,0.0),clog(vec2(PI,0.0))));
  vec2 sinpz2=csin(cmul(vec2(PI*0.5,0.0),z));
  return cmul(cmul(cmul(cmul(two_z,pi_z1),sinpz2),cgamma(w)),_zetaCore(w));
}

// E₁(z) — exponential integral. Series for |z|≤12, asymptotic for |z|>12.
// E₁(z) = -γ - ln(z) - Σ_{n=1}^∞ (-z)^n/(n·n!)  (|z| small)
// E₁(z) ~ e^{-z}/z · Σ_{n=0}^N (-1)^n n!/z^n      (|z| large)
vec2 cE1(vec2 z){
  float r=length(z);
  if(r<1e-6) return vec2(1e6,0.0);
  if(r<12.0){
    // Series: -γ - ln(z) - Σ_{n=1}^24 (-z)^n/(n·n!)
    vec2 ln_z=clog(z);
    vec2 sum=vec2(0.0);
    vec2 zpow=vec2(-z.x,-z.y); // (-z)^1 at n=1
    float nfact=1.0;
    for(int n=1;n<=24;n++){
      nfact*=float(n);
      sum+=cdiv(zpow,vec2(float(n)*nfact,0.0));
      zpow=cmul(zpow,-z);
    }
    return -vec2(0.5772156649,0.0)-ln_z-sum;
  } else {
    // Asymptotic: e^{-z}/z * Σ_{n=0}^14 (-1)^n n!/z^n
    vec2 invz=cdiv(vec2(1.0,0.0),z);
    vec2 term=vec2(1.0,0.0);
    vec2 sum=vec2(1.0,0.0);
    for(int n=1;n<=14;n++){
      term=cmul(term,cmul(vec2(-float(n),0.0),invz));
      sum+=term;
    }
    return cmul(cexp(-z),cmul(invz,sum));
  }
}

// Ei(z) = -E₁(-z) - iπ for Im(z)>0; -E₁(-z) + iπ for Im(z)<0; principal value for real z>0
vec2 cEi(vec2 z){
  vec2 negz=vec2(-z.x,-z.y);
  vec2 e1=cE1(negz);
  float branch=(z.y>0.0)?-PI:(z.y<0.0)?PI:0.0;
  return vec2(-e1.x,-e1.y+branch);
}

vec3 hsv2rgb(float h,float s,float v){
  float hh=mod(h,1.0)*6.0;
  float i=floor(hh),f=hh-i;
  float p=v*(1.0-s),q=v*(1.0-f*s),t=v*(1.0-(1.0-f)*s);
  return i<1.0?vec3(v,t,p):i<2.0?vec3(q,v,p):i<3.0?vec3(p,v,t):
         i<4.0?vec3(p,q,v):i<5.0?vec3(t,p,v):vec3(v,p,q);
}
`;

// ── AST → GLSL function map ───────────────────────────────────────────────────

type GlslFn = string | ((arg: string) => string);

// Keys are Maxima canonical names (what the LaTeX→Maxima parser outputs).
// Dead aliases (arcsin, ln, Si, Erf, Beta, Zeta, FresnelC, shi, ci…) removed.
const FN_MAP: Record<string, GlslFn> = {
  // ── Basic ─────────────────────────────────────────────────────────────────
  sin: 'csin', cos: 'ccos', tan: 'ctan',
  sinh: 'csinh', cosh: 'ccosh', tanh: 'ctanh',
  asin: 'casin', acos: 'cacos', atan: 'catan',
  exp: 'cexp', log: 'clog',
  sqrt: 'csqrt', gamma: 'cgamma',
  abs: 'cabs_f', arg: 'carg_f', conj: 'cconj',
  // ── Inline lambdas ────────────────────────────────────────────────────────
  re:   (a) => `vec2((${a}).x,0.0)`,
  im:   (a) => `vec2((${a}).y,0.0)`,
  sign: (a) => `(length(${a})<1e-20?vec2(0.0):cdiv(${a},vec2(length(${a}),0.0)))`,
  // ── Error / Fresnel / special ─────────────────────────────────────────────
  erf: 'cerf', erfc: 'cerfc', erfi: 'cerfi',
  fresnelC: 'cfresnelC', fresnelS: 'cfresnelS', fresnelK: 'cfresnelK',
  beta: 'cbeta', factorial: 'cfactorial', zeta: 'czeta',
  // ── Exponential integrals (Maxima canonical names) ────────────────────────
  expintegral_si: 'csi',   si: 'cssi',        // Si(z)→expintegral_si, si(z)→si
  expintegral_ci: 'cci',   Cin: 'ccin',       // Ci(z)→expintegral_ci, Cin→Cin
  expintegral_shi: 'cshi',                    // Shi(z)→expintegral_shi
  expintegral_chi: 'cchi',                    // Chi(z)→expintegral_chi
  expintegral_ei: 'cEi',                      // Ei(z)→expintegral_ei
  expintegral_e1: 'cE1',                      // E1(z)→expintegral_e1
};

const SYMS: Record<string, string> = {
  z: 'z',
  i: 'vec2(0.0,1.0)',
  pi: 'vec2(PI,0.0)', PI: 'vec2(PI,0.0)',
  e:  'vec2(E,0.0)',  E:  'vec2(E,0.0)',
  Infinity: 'vec2(1e30,0.0)',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComplexMathFn = (re: number, im: number, params: Record<string, number>) => {
  re: number; im: number; abs: number; arg: number;
};

/** Result of compiling an expression: GLSL body + detected free parameters. */
export interface CompileResult {
  /** GLSL vec2 expression to substitute into USER_CODE */
  glsl: string;
  /**
   * GLSL uniform declarations for free real parameters, ready to prepend to the shader.
   * E.g. "uniform float p_a;\nuniform float p_b;\n"
   */
  paramUniforms: string;
  /** Names of detected free real parameters, in detection order. */
  params: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MathNode = any;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GlslCompilerService {

  private mathJsReady: Promise<void> | null = null;

  /** Ensures mathjs is loaded (lazy, CDN). Safe to call multiple times. */
  ensureMathJs(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).math) return Promise.resolve();
    if (this.mathJsReady) return this.mathJsReady;
    this.mathJsReady = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mathjs@12.4.3/lib/browser/math.min.js';
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar mathjs'));
      document.head.appendChild(s);
    });
    return this.mathJsReady;
  }

  /**
   * Compiles a mathematical expression into a CompileResult.
   *
   * Free real parameters: any single-letter symbol that is not z, i, e, pi, E, PI.
   * They compile to `vec2(p_NAME, 0.0)` and require `uniform float p_NAME;` in the shader.
   *
   * Throws on unsupported syntax or function names.
   */
  compile(expr: string, options?: { varAlias?: string }): CompileResult {
    let normalized = this.normalizeConstants(expr);
    // Rename the frequency variable (e.g. 's' in Laplace) to 'z'
    if (options?.varAlias && options.varAlias !== 'z') {
      normalized = normalized.replace(new RegExp(`\\b${options.varAlias}\\b`, 'g'), 'z');
    }
    const detectedParams = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glsl = this.nodeToGLSL((window as any).math.parse(normalized), detectedParams);
    const params = [...detectedParams];
    const paramUniforms = params.map(p => `uniform float p_${p};`).join('\n') + (params.length ? '\n' : '');
    return { glsl, paramUniforms, params };
  }

  /**
   * Compiles the expression for JS evaluation (hover coordinate display).
   * Params are injected as complex numbers with Im=0.
   * Returns null if the expression cannot be evaluated.
   */
  compileMathFn(expr: string, params: string[], options?: { varAlias?: string }): ComplexMathFn | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const math = (window as any).math;
      let normalized = this.normalizeConstants(expr);
      if (options?.varAlias && options.varAlias !== 'z') {
        normalized = normalized.replace(new RegExp(`\\b${options.varAlias}\\b`, 'g'), 'z');
      }
      const c = math.compile(normalized);
      return (re: number, im: number, pv: Record<string, number>) => {
        const scope: Record<string, unknown> = { z: math.complex(re, im) };
        for (const p of params) scope[p] = math.complex(pv[p] ?? 0, 0);
        let w = c.evaluate(scope);
        if (typeof w === 'number') w = math.complex(w, 0);
        return { re: w.re, im: w.im, abs: math.abs(w), arg: math.arg(w) };
      };
    } catch {
      return null;
    }
  }

  // ── Private: constant normalisation ──────────────────────────────────────

  /**
   * Converts Maxima-style constants to numeric literals before mathjs parses the
   * expression. Mirrors the same substitutions in MathUtilsService.maximaToJs().
   */
  private normalizeConstants(expr: string): string {
    return expr
      .replace(/%pi\b/g, '(3.141592653589793)')
      .replace(/%e\b/g,  '(2.718281828459045)')
      .replace(/%i\b/g,  'i');
  }

  // ── Private: AST walker ───────────────────────────────────────────────────

  private nodeToGLSL(n: MathNode, params: Set<string>): string {
    switch (n.type) {
      case 'ConstantNode':
        return `vec2(${Number(n.value).toPrecision(10)},0.0)`;

      case 'SymbolNode': {
        if (SYMS[n.name]) return SYMS[n.name];
        // Single-letter unknown symbol → free real parameter
        if (/^[a-zA-Z]$/.test(n.name)) {
          params.add(n.name);
          return `vec2(p_${n.name},0.0)`;
        }
        throw new Error(`Variable desconocida: "${n.name}"`);
      }

      case 'ParenthesisNode':
        return `(${this.nodeToGLSL(n.content, params)})`;

      case 'OperatorNode': {
        const args = (n.args as MathNode[]).map(a => this.nodeToGLSL(a, params));
        switch (n.op) {
          case '+': return args.length === 1 ? args[0] : `(${args[0]}+${args[1]})`;
          case '-': return args.length === 1 ? `(-(${args[0]}))` : `(${args[0]}-${args[1]})`;
          case '*': return `cmul(${args[0]},${args[1]})`;
          case '/': return `cdiv(${args[0]},${args[1]})`;
          case '^':
          case '**': return `cpow(${args[0]},${args[1]})`;
        }
        throw new Error(`Operador no soportado: ${n.op}`);
      }

      case 'FunctionNode': {
        const name: string = n.name;
        const args = (n.args as MathNode[]).map(a => this.nodeToGLSL(a, params));
        const mapping = FN_MAP[name];
        if (!mapping) throw new Error(`Función GPU no soportada: ${name}`);
        return typeof mapping === 'function'
          ? mapping(args[0])
          : `${mapping}(${args.join(',')})`;
      }

      default:
        throw new Error(`Nodo AST desconocido: ${n.type}`);
    }
  }
}
