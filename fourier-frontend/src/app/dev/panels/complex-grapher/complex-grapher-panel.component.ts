'use strict';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

// ── GLSL complex math library ────────────────────────────────────────────────

const COMPLEX_LIB = `
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

void _sfg(vec2 z, out vec2 fv, out vec2 gv){
  vec2 zz=cmul(z,z);
  vec2 iz2=cdiv(vec2(-1.0,0.0),zz);
  vec2 tf=vec2(1.0,0.0),sf=vec2(1.0,0.0);
  vec2 tg=vec2(1.0,0.0),sg=vec2(1.0,0.0);
  for(int k=1;k<=8;k++){
    float fk=float(k);
    tf=cmul(tf,iz2*(2.0*fk*(2.0*fk-1.0)));   sf+=tf;
    tg=cmul(tg,iz2*((2.0*fk+1.0)*(2.0*fk))); sg+=tg;
  }
  fv=cdiv(sf,z);
  gv=cdiv(sg,zz);
}

vec2 csi(vec2 z){
  if(dot(z,z)<64.0){
    vec2 zz=cmul(z,z),u=z,s=vec2(0.0);
    float sg=1.0;
    for(int i=0;i<50;i++){
      float k=float(i);
      s+=sg*cdiv(u,vec2(2.0*k+1.0,0.0));
      u=cmul(u,cdiv(zz,vec2((2.0*k+2.0)*(2.0*k+3.0),0.0)));
      sg=-sg;
    }
    return s;
  }
  vec2 fv,gv; _sfg(z,fv,gv);
  return vec2(PI*0.5,0.0)-cmul(fv,ccos(z))-cmul(gv,csin(z));
}
vec2 cssi(vec2 z){ return csi(z)-vec2(PI*0.5,0.0); }
vec2 cci(vec2 z){
  if(dot(z,z)<64.0){
    const float EG=0.5772156649015329;
    vec2 zz=cmul(z,z),w=cdiv(zz,vec2(2.0,0.0)),s=vec2(0.0);
    float sg=-1.0;
    for(int i=0;i<50;i++){
      float n=float(i)+1.0;
      s+=sg*cdiv(w,vec2(2.0*n,0.0));
      w=cmul(w,cdiv(zz,vec2((2.0*n+1.0)*(2.0*n+2.0),0.0)));
      sg=-sg;
    }
    return vec2(EG,0.0)+clog(z)+s;
  }
  vec2 fv,gv; _sfg(z,fv,gv);
  return cmul(fv,csin(z))-cmul(gv,ccos(z));
}
vec2 ccin(vec2 z){
  vec2 zz=cmul(z,z);
  vec2 w=cdiv(zz,vec2(2.0,0.0));
  vec2 s=vec2(0.0);
  float sg=1.0;
  for(int i=0;i<50;i++){
    float n=float(i)+1.0;
    s+=sg*cdiv(w,vec2(2.0*n,0.0));
    w=cmul(w,cdiv(zz,vec2((2.0*n+1.0)*(2.0*n+2.0),0.0)));
    sg=-sg;
  }
  return s;
}
vec2 cerf(vec2 z){
  float r2=dot(z,z);
  if(r2<9.0){
    vec2 zz=cmul(z,z),t=z,s=vec2(0.0);
    float sg=1.0,fac=1.0;
    for(int n=0;n<30;n++){
      float k=float(n);
      s+=sg*cdiv(t,vec2(fac*(2.0*k+1.0),0.0));
      t=cmul(t,zz); fac*=k+1.0; sg=-sg;
    }
    return s*1.1283791670955126;
  }else{
    vec2 zz=cmul(z,z);
    vec2 tk=vec2(1.0,0.0),s=vec2(1.0,0.0);
    for(int k=1;k<=12;k++){
      float fk=float(k);
      tk=cmul(tk,cdiv(vec2(-(2.0*fk-1.0),0.0),cmul(vec2(2.0,0.0),zz)));
      s+=tk;
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

vec3 hsv2rgb(float h,float s,float v){
  float hh=mod(h,1.0)*6.0;
  float i=floor(hh),f=hh-i;
  float p=v*(1.0-s),q=v*(1.0-f*s),t=v*(1.0-(1.0-f)*s);
  return i<1.0?vec3(v,t,p):i<2.0?vec3(q,v,p):i<3.0?vec3(p,v,t):
         i<4.0?vec3(p,q,v):i<5.0?vec3(t,p,v):vec3(v,p,q);
}
`;

const VERT_2D_SRC = `attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }`;

const FRAG_2D_TMPL = `
precision highp float;
${COMPLEX_LIB}
uniform vec2  u_center;
uniform float u_scale;
uniform vec2  u_res;
uniform int   u_scheme;
uniform int   u_modlines;
vec2 f_user(vec2 z){ return USER_CODE; }
void main(){
  float aspect=u_res.x/u_res.y;
  float re=u_center.x+(gl_FragCoord.x/u_res.x-0.5)*u_scale*aspect;
  float im=u_center.y+(gl_FragCoord.y/u_res.y-0.5)*u_scale;
  vec2  w=f_user(vec2(re,im));
  float aW=length(w);
  float arg=atan(w.y,w.x);
  float h=mod(arg/(2.0*PI)+1.0,1.0);
  vec3 color;
  if(u_scheme==2){
    float v=atan(aW*1.2)/(PI*0.5); color=vec3(v);
  } else if(u_scheme==1){
    color=hsv2rgb(h,1.0,0.88);
  } else {
    float logA=log2(max(aW,1.0e-12));
    float mf=logA-floor(logA);
    float iso=0.5+0.5*cos(2.0*PI*mf);
    float v=atan(aW*1.5)/(PI*0.5);
    if(u_modlines!=0) v*=0.70+0.30*iso;
    color=hsv2rgb(h,0.96,min(1.0,v));
  }
  gl_FragColor=vec4(color,1.0);
}`;

const VERT_3D_TMPL = `
precision highp float;
${COMPLEX_LIB}
attribute vec2 a_grid;
uniform float u_rotX, u_rotY;
uniform float u_zoom, u_range;
uniform float u_hScale, u_zClip;
uniform vec2  u_res;
varying float v_arg;
varying float v_abs;
varying vec2  v_coord;
vec2 f_user(vec2 z){ return USER_CODE; }
void main(){
  vec2 z=a_grid;
  vec2 w=f_user(z);
  float absW=min(length(w),1e6);
  float h=min(absW*u_hScale, u_zClip);
  float wx=z.x, wy=h, wz=z.y;
  float cy=cos(u_rotY),sy=sin(u_rotY);
  float x1=wx*cy-wz*sy, z1=wx*sy+wz*cy, y1=wy;
  float cx=cos(u_rotX),sx=sin(u_rotX);
  float y2=y1*cx+z1*sx, z2=-y1*sx+z1*cx, x2=x1;
  float d=u_range*2.8;
  float ps=d/max(d+z2,0.01);
  float ppu=u_zoom*min(u_res.x,u_res.y)*0.42/u_range;
  gl_Position=vec4(
    x2*ps*ppu/(u_res.x*0.5),
    y2*ps*ppu/(u_res.y*0.5),
    clamp(z2/(u_range*4.0),-1.0,1.0),
    1.0);
  v_arg=atan(w.y,w.x);
  v_abs=absW;
  v_coord=z;
}`;

const FRAG_3D_SRC = `
precision highp float;
const float PI=3.141592653589793;
varying float v_arg;
varying float v_abs;
varying vec2  v_coord;
uniform float u_gridStep;
uniform int   u_showGrid;
vec3 hsv2rgb(float h,float s,float v){
  float hh=mod(h,1.0)*6.0;
  float i=floor(hh),f=hh-i;
  float p=v*(1.0-s),q=v*(1.0-f*s),t=v*(1.0-(1.0-f)*s);
  return i<1.0?vec3(v,t,p):i<2.0?vec3(q,v,p):i<3.0?vec3(p,v,t):
         i<4.0?vec3(p,q,v):i<5.0?vec3(t,p,v):vec3(v,p,q);
}
void main(){
  float h=mod(v_arg/(2.0*PI)+1.0,1.0);
  vec3 color=hsv2rgb(h,0.92,0.88);
  if(u_showGrid!=0){
    vec2 c=v_coord/u_gridStep;
    vec2 df=min(fract(c),1.0-fract(c));
    float lw=0.034;
    float onLine=max(step(df.x,lw),step(df.y,lw));
    color=mix(color,color*0.25,onLine*0.60);
  }
  gl_FragColor=vec4(color,1.0);
}`;

// ── AST → GLSL transpiler (uses mathjs loaded globally) ──────────────────────

const FN_MAP: Record<string, string | ((a: string) => string)> = {
  sin:'csin',cos:'ccos',tan:'ctan',
  sinh:'csinh',cosh:'ccosh',tanh:'ctanh',
  asin:'casin',acos:'cacos',atan:'catan',
  arcsin:'casin',arccos:'cacos',arctan:'catan',
  exp:'cexp',log:'clog',ln:'clog',
  sqrt:'csqrt',gamma:'cgamma',
  abs:'cabs_f',arg:'carg_f',conj:'cconj',
  Si:'csi',si:'cssi',Ci:'cci',ci:'cci',Cin:'ccin',cin:'ccin',
  erf:'cerf',Erf:'cerf',erfc:'cerfc',Erfc:'cerfc',erfi:'cerfi',Erfi:'cerfi',
  re: (a: string) => `vec2((${a}).x,0.0)`,
  im: (a: string) => `vec2((${a}).y,0.0)`,
  sign: (a: string) => `(length(${a})<1e-20?vec2(0.0):cdiv(${a},vec2(length(${a}),0.0)))`,
};

const SYMS: Record<string, string> = {
  z:'z', i:'vec2(0.0,1.0)',
  pi:'vec2(PI,0.0)',PI:'vec2(PI,0.0)',
  e:'vec2(E,0.0)',E:'vec2(E,0.0)',
  Infinity:'vec2(1e30,0.0)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeToGLSL(n: any): string {
  switch(n.type){
    case 'ConstantNode':
      return `vec2(${Number(n.value).toPrecision(10)},0.0)`;
    case 'SymbolNode':
      if(SYMS[n.name]) return SYMS[n.name];
      throw new Error(`Variable desconocida: "${n.name}"`);
    case 'ParenthesisNode':
      return `(${nodeToGLSL(n.content)})`;
    case 'OperatorNode':{
      const a = n.args.map(nodeToGLSL);
      switch(n.op){
        case '+': return a.length===1?a[0]:`(${a[0]}+${a[1]})`;
        case '-': return a.length===1?`(-(${a[0]}))`:`(${a[0]}-${a[1]})`;
        case '*': return `cmul(${a[0]},${a[1]})`;
        case '/': return `cdiv(${a[0]},${a[1]})`;
        case '^':case '**': return `cpow(${a[0]},${a[1]})`;
      }
      throw new Error(`Operador no soportado: ${n.op}`);
    }
    case 'FunctionNode':{
      const nm = n.name;
      const args = n.args.map(nodeToGLSL);
      const m = FN_MAP[nm];
      if(!m) throw new Error(`Función GPU no soportada: ${nm}`);
      return typeof m==='function' ? m(args[0]) : `${m}(${args.join(',')})`;
    }
    default:
      throw new Error(`Nodo desconocido: ${n.type}`);
  }
}

function exprToGLSL(expr: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return nodeToGLSL((window as any).math.parse(expr));
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ComplexState {
  mode: '2d' | '3d';
  fnStr: string;
  scale2d: number; cx2d: number; cy2d: number;
  showModLines: boolean; showAxes2d: boolean; showGrid2d: boolean;
  colorScheme: 'classic' | 'phase' | 'magnitude';
  rotX: number; rotY: number; zoom3d: number; range3d: number;
  resolution: number; heightScale: number; zClip: number;
  wireframe: boolean; showGrid3d: boolean;
  dirty: boolean;
}

@Component({
  selector: 'app-complex-grapher-panel',
  imports: [FormsModule],
  templateUrl: './complex-grapher-panel.component.html',
})
export class ComplexGrapherPanelComponent implements AfterViewInit, OnDestroy {

  readonly wglCanvasRef  = viewChild<ElementRef<HTMLCanvasElement>>('canvasWgl');
  readonly overlay2dRef  = viewChild<ElementRef<HTMLCanvasElement>>('canvas2d');
  readonly overlay3dRef  = viewChild<ElementRef<HTMLCanvasElement>>('canvas3d');
  readonly containerRef  = viewChild<ElementRef<HTMLDivElement>>('canvasArea');

  // UI signals
  readonly mode          = signal<'2d' | '3d'>('2d');
  readonly fnStr         = signal('gamma(z)');
  readonly fnError       = signal('');
  readonly colorScheme   = signal<'classic' | 'phase' | 'magnitude'>('classic');
  readonly showModLines  = signal(true);
  readonly showAxes2d    = signal(true);
  readonly showGrid2d    = signal(true);
  readonly range3d       = signal(4);
  readonly resolution    = signal(80);
  readonly heightScale   = signal(1.0);
  readonly zClip         = signal(5.0);
  readonly showGrid3d    = signal(true);
  readonly wireframe     = signal(false);

  // coordinate display
  readonly coordRe = signal('0.0000');
  readonly coordIm = signal('+0.0000');
  readonly coordFz = signal('—');

  readonly examples = [
    { label: 'Γ(z)',         fn: 'gamma(z)' },
    { label: '1/z',          fn: '1/z' },
    { label: 'z²',           fn: 'z^2' },
    { label: 'sin(z)',       fn: 'sin(z)' },
    { label: 'exp(z)',       fn: 'exp(z)' },
    { label: 'tan(z)',       fn: 'tan(z)' },
    { label: '1/(z²+1)',     fn: '1/(z^2+1)' },
    { label: '√z',           fn: 'sqrt(z)' },
    { label: '(z³−1)/(z³+1)', fn: '(z^3-1)/(z^3+1)' },
    { label: 'log(z)',       fn: 'log(z)' },
    { label: 'sin(1/z)',     fn: 'sin(1/z)' },
    { label: 'z^z',          fn: 'z^z' },
    { label: 'Si(z)',        fn: 'Si(z)' },
    { label: 'si(z)',        fn: 'si(z)' },
    { label: 'Ci(z)',        fn: 'Ci(z)' },
    { label: 'Cin(z)',       fn: 'Cin(z)' },
    { label: 'erf(z)',       fn: 'erf(z)' },
    { label: 'erfc(z)',      fn: 'erfc(z)' },
    { label: 'erfi(z)',      fn: 'erfi(z)' },
  ];

  // WebGL state
  private gl!: WebGLRenderingContext;
  private prog2D: WebGLProgram | null = null;
  private prog3D: WebGLProgram | null = null;
  private u2D: Record<string, WebGLUniformLocation | null> = {};
  private u3D: Record<string, WebGLUniformLocation | null> = {};
  private vbo2D!: WebGLBuffer;
  private vbo3D: WebGLBuffer | null = null;
  private ibo3D: WebGLBuffer | null = null;
  private ibo3DLines: WebGLBuffer | null = null;
  private iCount = 0;
  private iCountLines = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mathFn: ((re: number, im: number) => {re:number;im:number;abs:number;arg:number}) | null = null;

  // 2D view state
  private scale2d = 80;
  private cx2d = 0;
  private cy2d = 0;
  private drag2d = false;
  private m2d = { x: 0, y: 0 };

  // 3D view state
  private rotX = -0.50;
  private rotY =  0.40;
  private zoom3d = 1.0;
  private dirty = false;
  private rafId = 0;

  private resizeObs!: ResizeObserver;

  ngAfterViewInit(): void {
    this.loadMathJs().then(() => this.initWebGL());
  }

  private loadMathJs(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).math) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mathjs@12.4.3/lib/browser/math.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar mathjs'));
      document.head.appendChild(s);
    });
  }

  private initWebGL(): void {
    const canvasWGL = this.wglCanvasRef()!.nativeElement;
    this.gl = (canvasWGL.getContext('webgl') ??
               canvasWGL.getContext('experimental-webgl')) as WebGLRenderingContext;
    if (!this.gl) { this.fnError.set('WebGL no soportado en este navegador'); return; }

    const gl = this.gl;
    this.vbo2D = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo2D);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

    this.initEvents();
    this.resizeCanvases();

    this.resizeObs = new ResizeObserver(() => this.resizeCanvases());
    this.resizeObs.observe(this.containerRef()!.nativeElement);

    this.buildSurface();
    this.setFunction(this.fnStr());
    this.rafId = requestAnimationFrame(() => this.renderLoop());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    const gl = this.gl;
    if (!gl) return;
    if (this.prog2D) gl.deleteProgram(this.prog2D);
    if (this.prog3D) gl.deleteProgram(this.prog3D);
  }

  // ── Public actions ──────────────────────────────────────────────────────────

  plot(): void {
    if (this.setFunction(this.fnStr())) this.scheduleRender();
  }

  loadExample(fn: string): void {
    this.fnStr.set(fn);
    if (this.setFunction(fn)) this.scheduleRender();
  }

  setMode(m: '2d' | '3d'): void {
    this.mode.set(m);
    this.scheduleRender();
  }

  toggleWireframe(): void {
    this.wireframe.update(v => !v);
    this.scheduleRender();
  }

  resetView3D(): void {
    this.rotX = -0.50; this.rotY = 0.40; this.zoom3d = 1.0;
    this.scheduleRender();
  }

  onRange3dChange(v: number): void {
    this.range3d.set(v);
    this.buildSurface();
    this.scheduleRender();
  }

  onResolutionChange(v: number): void {
    this.resolution.set(v);
    this.buildSurface();
    this.scheduleRender();
  }

  onSettingChange(): void { this.scheduleRender(); }

  // ── WebGL helpers ────────────────────────────────────────────────────────────

  private glShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  }

  private glProgram(vSrc: string, fSrc: string): WebGLProgram {
    const gl = this.gl;
    const v = this.glShader(gl.VERTEX_SHADER, vSrc);
    const f = this.glShader(gl.FRAGMENT_SHADER, fSrc);
    const p = gl.createProgram()!;
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    return p;
  }

  private locs(p: WebGLProgram, names: string[]): Record<string, WebGLUniformLocation | null> {
    const o: Record<string, WebGLUniformLocation | null> = {};
    names.forEach(n => { o[n] = this.gl.getUniformLocation(p, `u_${n}`); });
    return o;
  }

  private build2D(glsl: string): void {
    const gl = this.gl;
    const p = this.glProgram(VERT_2D_SRC, FRAG_2D_TMPL.replace('USER_CODE', glsl));
    if (this.prog2D) gl.deleteProgram(this.prog2D);
    this.prog2D = p;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo2D);
    const pos = gl.getAttribLocation(p, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    this.u2D = this.locs(p, ['center','scale','res','scheme','modlines']);
  }

  private build3D(glsl: string): void {
    const p = this.glProgram(
      VERT_3D_TMPL.replace('USER_CODE', glsl),
      FRAG_3D_SRC);
    if (this.prog3D) this.gl.deleteProgram(this.prog3D);
    this.prog3D = p;
    this.u3D = this.locs(p, ['rotX','rotY','zoom','range','hScale','zClip','res','gridStep','showGrid']);
  }

  private buildSurface(): void {
    const gl = this.gl;
    if (!gl) return;
    const N = this.resolution(), R = this.range3d(), step = 2*R/(N-1);
    const verts = new Float32Array(N*N*2);
    let vi = 0;
    for(let i=0;i<N;i++) for(let j=0;j<N;j++){
      verts[vi++] = -R+i*step; verts[vi++] = -R+j*step;
    }
    const ids = new Uint16Array((N-1)*(N-1)*6);
    let ii = 0;
    for(let i=0;i<N-1;i++) for(let j=0;j<N-1;j++){
      const a=i*N+j, b=(i+1)*N+j, c=i*N+(j+1), d=(i+1)*N+(j+1);
      ids[ii++]=a;ids[ii++]=b;ids[ii++]=c;
      ids[ii++]=b;ids[ii++]=d;ids[ii++]=c;
    }
    const lineIds = new Uint16Array(N*(N-1)*4);
    let li = 0;
    for(let i=0;i<N;i++) for(let j=0;j<N-1;j++){
      lineIds[li++]=i*N+j; lineIds[li++]=i*N+j+1;
    }
    for(let j=0;j<N;j++) for(let i=0;i<N-1;i++){
      lineIds[li++]=i*N+j; lineIds[li++]=(i+1)*N+j;
    }
    if(!this.vbo3D) this.vbo3D = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo3D!);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    if(!this.ibo3D) this.ibo3D = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3D!);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ids, gl.STATIC_DRAW);
    if(!this.ibo3DLines) this.ibo3DLines = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3DLines!);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIds, gl.STATIC_DRAW);
    this.iCount = ids.length;
    this.iCountLines = lineIds.length;
  }

  // ── Function compilation ─────────────────────────────────────────────────────

  private setFunction(expr: string): boolean {
    expr = expr.trim();
    let glsl: string;
    try { glsl = exprToGLSL(expr); }
    catch(e: unknown) { this.fnError.set((e as Error).message); return false; }
    try { this.build2D(glsl); this.build3D(glsl); }
    catch { this.fnError.set('Error de compilación GPU'); return false; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const math = (window as any).math;
      const c = math.compile(expr);
      this.mathFn = (re, im) => {
        let w = c.evaluate({ z: math.complex(re, im) });
        if (typeof w === 'number') w = math.complex(w, 0);
        return { re: w.re, im: w.im, abs: math.abs(w), arg: math.arg(w) };
      };
    } catch { this.mathFn = null; }
    this.fnError.set('');
    return true;
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  private scheduleRender(): void { this.dirty = true; }

  private renderLoop(): void {
    if (this.dirty) {
      this.dirty = false;
      if (this.mode() === '2d') this.render2D();
      else this.render3D();
    }
    this.rafId = requestAnimationFrame(() => this.renderLoop());
  }

  private render2D(): void {
    const gl = this.gl;
    if (!gl || !this.prog2D) return;
    const canvas = this.wglCanvasRef()!.nativeElement;
    const W = canvas.width, H = canvas.height;
    const si = { classic:0, phase:1, magnitude:2 }[this.colorScheme()] ?? 0;

    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog2D);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo2D);
    const pos = gl.getAttribLocation(this.prog2D, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.u2D['center'], this.cx2d, this.cy2d);
    gl.uniform1f(this.u2D['scale'], H / this.scale2d);
    gl.uniform2f(this.u2D['res'], W, H);
    gl.uniform1i(this.u2D['scheme'], si);
    gl.uniform1i(this.u2D['modlines'], this.showModLines() ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const c2 = this.overlay2dRef()!.nativeElement;
    const ctx = c2.getContext('2d')!;
    ctx.clearRect(0, 0, c2.width, c2.height);
    if (this.showGrid2d()) this.drawGrid2D(ctx, c2.width, c2.height);
    if (this.showAxes2d()) this.drawAxes2D(ctx, c2.width, c2.height);
    this.drawLegend2D(ctx, c2.width, c2.height);
  }

  private render3D(): void {
    const gl = this.gl;
    if (!gl || !this.prog3D || !this.vbo3D) return;
    const canvas = this.wglCanvasRef()!.nativeElement;
    const W = canvas.width, H = canvas.height;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.051, 0.067, 0.090, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog3D);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo3D);
    const gLoc = gl.getAttribLocation(this.prog3D, 'a_grid');
    gl.enableVertexAttribArray(gLoc);
    gl.vertexAttribPointer(gLoc, 2, gl.FLOAT, false, 0, 0);

    const R = this.range3d();
    gl.uniform1f(this.u3D['rotX'], this.rotX);
    gl.uniform1f(this.u3D['rotY'], this.rotY);
    gl.uniform1f(this.u3D['zoom'], this.zoom3d);
    gl.uniform1f(this.u3D['range'], R);
    gl.uniform1f(this.u3D['hScale'], this.heightScale());
    gl.uniform1f(this.u3D['zClip'], this.zClip());
    gl.uniform2f(this.u3D['res'], W, H);
    gl.uniform1f(this.u3D['gridStep'], this.niceStep3D(R));
    gl.uniform1i(this.u3D['showGrid'], this.showGrid3d() ? 1 : 0);

    if (this.wireframe()) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3DLines!);
      gl.drawElements(gl.LINES, this.iCountLines, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3D!);
      gl.drawElements(gl.TRIANGLES, this.iCount, gl.UNSIGNED_SHORT, 0);
    }

    const c3 = this.overlay3dRef()!.nativeElement;
    const ctx = c3.getContext('2d')!;
    ctx.clearRect(0, 0, c3.width, c3.height);
    this.drawAxes3D(ctx, c3.width, c3.height);
    this.drawLegend3D(ctx, c3.width, c3.height);
  }

  // ── Canvas overlays ──────────────────────────────────────────────────────────

  private drawGrid2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const sc = this.scale2d;
    const toSX = (re: number) => W/2 + (re - this.cx2d) * sc;
    const toSY = (im: number) => H/2 - (im - this.cy2d) * sc;
    const step = this.niceStep(sc);
    const reMin = this.cx2d - W/(2*sc), reMax = this.cx2d + W/(2*sc);
    const imMin = this.cy2d - H/(2*sc), imMax = this.cy2d + H/(2*sc);

    ctx.save();
    const sub = step/5;
    if(sub*sc > 6){
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 0.5;
      for(let v=Math.ceil(reMin/sub)*sub; v<=reMax; v+=sub){
        const sx=toSX(v); ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,H); ctx.stroke();
      }
      for(let v=Math.ceil(imMin/sub)*sub; v<=imMax; v+=sub){
        const sy=toSY(v); ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(W,sy); ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.11)'; ctx.lineWidth = 0.6;
    for(let v=Math.ceil(reMin/step)*step; v<=reMax; v+=step){
      const sx=toSX(v); ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,H); ctx.stroke();
    }
    for(let v=Math.ceil(imMin/step)*step; v<=imMax; v+=step){
      const sy=toSY(v); ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(W,sy); ctx.stroke();
    }
    ctx.restore();
  }

  private drawAxes2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const sc = this.scale2d;
    const toSX = (re: number) => W/2 + (re - this.cx2d) * sc;
    const toSY = (im: number) => H/2 - (im - this.cy2d) * sc;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.40)'; ctx.lineWidth = 1;
    const axY = toSY(0), axX = toSX(0);
    if(axY>=0&&axY<=H){ ctx.beginPath(); ctx.moveTo(0,axY); ctx.lineTo(W,axY); ctx.stroke(); }
    if(axX>=0&&axX<=W){ ctx.beginPath(); ctx.moveTo(axX,0); ctx.lineTo(axX,H); ctx.stroke(); }

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '11px monospace';
    const step = this.niceStep(sc);
    const reMin = this.cx2d - W/(2*sc), reMax = this.cx2d + W/(2*sc);
    const imMin = this.cy2d - H/(2*sc), imMax = this.cy2d + H/(2*sc);
    const labelY = Math.min(Math.max(axY+14, 14), H-4);
    ctx.textAlign = 'center';
    for(let v=Math.ceil(reMin/step)*step; v<=reMax+step*.01; v+=step){
      if(Math.abs(v)<step*.01) continue;
      const sx=toSX(v); if(sx<5||sx>W-5) continue;
      ctx.fillText(this.fmtN(v), sx, labelY);
    }
    const labelX = Math.min(Math.max(axX-4, 4), W-40);
    ctx.textAlign = 'right';
    for(let v=Math.ceil(imMin/step)*step; v<=imMax+step*.01; v+=step){
      if(Math.abs(v)<step*.01) continue;
      const sy=toSY(v); if(sy<5||sy>H-5) continue;
      ctx.fillText(this.fmtN(v)+'i', labelX, sy+4);
    }
    ctx.restore();
  }

  private drawLegend2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const R=28, cx=W-46, cy=H-46;
    ctx.save(); ctx.globalAlpha=0.85;
    for(let a=0;a<360;a++){
      const argW=(a/360)*2*Math.PI-Math.PI;
      const [r,g,b]=this.phaseColorJS(argW,1.5,'classic',false);
      const a1=(a/360)*2*Math.PI;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,a1,a1+Math.PI/180+.02);
      ctx.closePath(); ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fill();
    }
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,2*Math.PI); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.75)';
    ctx.font='9px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('0',cx+R+7,cy); ctx.fillText('π',cx-R-7,cy);
    ctx.fillText('π/2',cx,cy-R-8); ctx.fillText('-π/2',cx,cy+R+8);
    ctx.restore();
  }

  private proj3D(wx: number, wy: number, wz: number, W: number, H: number): {x:number;y:number} {
    const R = this.range3d();
    const cy=Math.cos(this.rotY), sy=Math.sin(this.rotY);
    const x1=wx*cy-wz*sy, z1=wx*sy+wz*cy, y1=wy;
    const cx=Math.cos(this.rotX), sx=Math.sin(this.rotX);
    const y2=y1*cx+z1*sx, z2=-y1*sx+z1*cx, x2=x1;
    const d=R*2.8, ps=d/Math.max(d+z2, .01);
    const ppu=this.zoom3d*Math.min(W,H)*.42/R;
    return { x: W/2+x2*ps*ppu, y: H/2-y2*ps*ppu };
  }

  private drawAxes3D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const R = this.range3d();
    const axes = [
      {from:[0,0,0] as [number,number,number],to:[R*1.15,0,0] as [number,number,number],col:'#f87171',lbl:'Re'},
      {from:[0,0,0] as [number,number,number],to:[0,0,R*1.15] as [number,number,number],col:'#4ade80',lbl:'Im'},
      {from:[0,0,0] as [number,number,number],to:[0,R*1.15,0] as [number,number,number],col:'#60a5fa',lbl:'|f|'},
    ];
    ctx.save();
    for(const ax of axes){
      const s=this.proj3D(...ax.from, W, H), e=this.proj3D(...ax.to, W, H);
      ctx.strokeStyle=ax.col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(e.x,e.y); ctx.stroke();
      ctx.fillStyle=ax.col; ctx.font='bold 12px monospace';
      ctx.fillText(ax.lbl, e.x+6, e.y+4);
    }
    const tickStep=this.niceStep3D(R);
    ctx.font='10px monospace'; ctx.textAlign='center';
    for(let v=tickStep;v<=R;v+=tickStep){
      const p=this.proj3D(v,0,0,W,H);
      ctx.beginPath(); ctx.arc(p.x,p.y,2,0,2*Math.PI);
      ctx.fillStyle='rgba(241,135,135,0.6)'; ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fillText(this.fmtN(v),p.x,p.y-6);
      const q=this.proj3D(0,0,v,W,H);
      ctx.beginPath(); ctx.arc(q.x,q.y,2,0,2*Math.PI);
      ctx.fillStyle='rgba(74,222,128,0.6)'; ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fillText(this.fmtN(v),q.x,q.y-6);
    }
    ctx.restore();
  }

  private drawLegend3D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const bh=160, bw=14, bx=W-52, by=Math.round(H/2-bh/2);
    ctx.save();
    for(let py=0;py<bh;py++){
      const argV=Math.PI*(1-2*py/bh);
      const h=((argV/(2*Math.PI))+1)%1;
      const [r,g,b]=this.hsvToRgb(h, 0.92, 0.88);
      ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(bx,by+py,bw,1);
    }
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1;
    ctx.strokeRect(bx,by,bw,bh);
    const ticks: [number,string][] = [[0,'π'],[0.25,'π/2'],[0.5,'0'],[0.75,'−π/2'],[1,'−π']];
    ctx.font='10px monospace'; ctx.textAlign='left';
    for(const [t,lbl] of ticks){
      const ty=by+t*bh;
      ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=0.75;
      ctx.beginPath(); ctx.moveTo(bx,ty); ctx.lineTo(bx-3,ty); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.70)'; ctx.fillText(lbl,bx+bw+4,ty+3.5);
    }
    ctx.font='9px monospace'; ctx.fillStyle='rgba(255,255,255,0.45)';
    ctx.textAlign='center'; ctx.fillText('arg',bx+bw/2,by-6);
    ctx.restore();
  }

  // ── Math helpers ──────────────────────────────────────────────────────────────

  private hsvToRgb(h: number, s: number, v: number): [number,number,number] {
    h=((h%1)+1)%1;
    const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
    const [r,g,b]=([[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]] as [number,number,number][])[i%6];
    return [r*255|0, g*255|0, b*255|0];
  }

  private phaseColorJS(argW: number, absW: number, scheme: string, showMod: boolean): [number,number,number] {
    const h=((argW/(2*Math.PI))+1)%1;
    if(scheme==='magnitude'){ const g=Math.atan(absW*1.2)/(Math.PI*.5)*255|0; return [g,g,g]; }
    if(scheme==='phase') return this.hsvToRgb(h, 1, .88);
    const logA=Math.log2(Math.max(absW, 1e-12));
    const iso=.5+.5*Math.cos(2*Math.PI*(logA-Math.floor(logA)));
    let v=Math.atan(absW*1.5)/(Math.PI*.5);
    if(showMod) v*=.70+.30*iso;
    return this.hsvToRgb(h, .96, Math.min(1,v));
  }

  private niceStep(sc: number): number {
    const raw=80/sc, mag=Math.pow(10,Math.floor(Math.log10(raw))), f=raw/mag;
    return f<2?mag:f<5?2*mag:5*mag;
  }

  private niceStep3D(range: number): number {
    return range<=1.5?.25:range<=2.5?.5:range<=5?1:range<=10?2:5;
  }

  private fmtN(n: number): string {
    if(Math.abs(n)>=1000) return n.toExponential(1);
    if(Math.abs(n)>=100)  return Math.round(n)+'';
    if(Math.abs(n)>=1)    return +n.toFixed(1)+'';
    return +n.toPrecision(2)+'';
  }

  private resizeCanvases(): void {
    const area = this.containerRef()?.nativeElement;
    if (!area) return;
    const W = area.clientWidth, H = area.clientHeight;
    for(const ref of [this.wglCanvasRef(), this.overlay2dRef(), this.overlay3dRef()]){
      if(ref){ ref.nativeElement.width = W; ref.nativeElement.height = H; }
    }
    this.scheduleRender();
  }

  private updateCoords(re: number, im: number): void {
    this.coordRe.set(re.toFixed(4));
    this.coordIm.set((im>=0?'+':'')+im.toFixed(4));
    if(!this.mathFn){ this.coordFz.set('—'); return; }
    try {
      const w = this.mathFn(re, im);
      const fc = (v: number) => (v>=0?'+':'')+v.toFixed(3);
      this.coordFz.set(isFinite(w.abs) ? `${w.re.toFixed(3)}${fc(w.im)}i` : '∞');
    } catch { this.coordFz.set('∞'); }
  }

  // ── Event wiring ──────────────────────────────────────────────────────────────

  private initEvents(): void {
    const c2 = this.overlay2dRef()!.nativeElement;
    const c3 = this.overlay3dRef()!.nativeElement;

    // 2D mouse
    c2.addEventListener('mousedown', e => {
      this.drag2d = true; this.m2d = { x: e.clientX, y: e.clientY };
      c2.style.cursor = 'grabbing';
    });
    c2.addEventListener('mousemove', e => {
      if(this.drag2d){
        this.cx2d -= (e.clientX - this.m2d.x) / this.scale2d;
        this.cy2d += (e.clientY - this.m2d.y) / this.scale2d;
        this.m2d = { x: e.clientX, y: e.clientY };
        this.scheduleRender();
      }
      const rect = c2.getBoundingClientRect();
      const re = this.cx2d + (e.clientX - rect.left - c2.width/2) / this.scale2d;
      const im = this.cy2d + (c2.height/2 - (e.clientY - rect.top)) / this.scale2d;
      this.updateCoords(re, im);
    });
    const end2d = () => { this.drag2d = false; c2.style.cursor = 'crosshair'; };
    c2.addEventListener('mouseup', end2d);
    c2.addEventListener('mouseleave', end2d);
    c2.addEventListener('wheel', e => {
      e.preventDefault();
      const f = e.deltaY > 0 ? .83 : 1.20;
      const rect = c2.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const re0 = this.cx2d + (px - c2.width/2) / this.scale2d;
      const im0 = this.cy2d + (c2.height/2 - py) / this.scale2d;
      this.scale2d *= f;
      this.cx2d = re0 - (px - c2.width/2) / this.scale2d;
      this.cy2d = im0 - (c2.height/2 - py) / this.scale2d;
      this.scheduleRender();
    }, { passive: false });

    // 3D mouse
    let drag3d = false, m3d = { x: 0, y: 0 };
    c3.addEventListener('mousedown', e => { drag3d=true; m3d={x:e.clientX,y:e.clientY}; });
    c3.addEventListener('mousemove', e => {
      if(drag3d){
        this.rotY += (e.clientX - m3d.x) * .009;
        this.rotX += (e.clientY - m3d.y) * .009;
        m3d = { x: e.clientX, y: e.clientY };
        this.scheduleRender();
      }
    });
    const end3d = () => { drag3d = false; };
    c3.addEventListener('mouseup', end3d);
    c3.addEventListener('mouseleave', end3d);
    c3.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoom3d *= e.deltaY > 0 ? .90 : 1.11;
      this.zoom3d = Math.max(.1, Math.min(8, this.zoom3d));
      this.scheduleRender();
    }, { passive: false });
  }
}
