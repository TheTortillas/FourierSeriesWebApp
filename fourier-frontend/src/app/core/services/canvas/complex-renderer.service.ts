import { Injectable, OnDestroy } from '@angular/core';
import { COMPLEX_LIB } from './glsl-compiler.service';
import { ColorScheme, ComplexViewport2D, ComplexViewport3D } from './canvas.types';

// ── Vertex shader for 2D fullscreen quad ─────────────────────────────────────

const VERT_2D = `attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }`;

// ── Fragment shader template for 2D domain coloring ──────────────────────────

const FRAG_2D_TMPL = `
precision highp float;
${COMPLEX_LIB}
uniform vec2  u_center;
uniform float u_scale;
uniform vec2  u_res;
uniform int   u_scheme;
uniform int   u_modlines;
PARAM_UNIFORMS
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

// ── Vertex shader for 3D surface ──────────────────────────────────────────────

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
PARAM_UNIFORMS
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

// ── Fragment shader for 3D surface ────────────────────────────────────────────

const FRAG_3D = `
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
    float onLine=max(step(df.x,0.018),step(df.y,0.018));
    color=mix(color,color*0.22,onLine*0.70);
  }
  gl_FragColor=vec4(color,1.0);
}`;

// ── Uniform location bag ──────────────────────────────────────────────────────

type UniformMap = Record<string, WebGLUniformLocation | null>;

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Manages the WebGL context and shader programs for ComplexPlotComponent.
 *
 * NOT providedIn: 'root' — must be provided at component level so each
 * ComplexPlotComponent instance gets its own WebGL context and buffers.
 */
@Injectable()
export class ComplexRendererService implements OnDestroy {

  private gl!: WebGLRenderingContext;
  private prog2D: WebGLProgram | null = null;
  private prog3D: WebGLProgram | null = null;
  private u2D: UniformMap = {};
  private u3D: UniformMap = {};
  private paramNames: string[] = [];
  private vbo2D!: WebGLBuffer;
  private vbo3D: WebGLBuffer | null = null;
  private ibo3D: WebGLBuffer | null = null;
  private ibo3DLines: WebGLBuffer | null = null;
  private iCount = 0;
  private iCountLines = 0;

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Attaches the service to a WebGL canvas.
   * Returns false if WebGL is unavailable.
   */
  init(canvas: HTMLCanvasElement): boolean {
    const opts = { preserveDrawingBuffer: true };
    const ctx = canvas.getContext('webgl', opts) ?? canvas.getContext('experimental-webgl', opts);
    if (!ctx) return false;
    this.gl = ctx as WebGLRenderingContext;

    const gl = this.gl;
    this.vbo2D = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo2D);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    return true;
  }

  // ── Shader compilation ─────────────────────────────────────────────────────

  /**
   * Compiles both 2D and 3D shader programs for the given GLSL expression.
   * paramUniforms: zero or more "uniform float p_X;\n" declarations.
   * params: ordered list of free parameter names.
   * Throws on shader compile/link error.
   */
  setFunction(glsl: string, paramUniforms: string, params: string[]): void {
    this.paramNames = params;
    this.build2D(glsl, paramUniforms);
    this.build3D(glsl, paramUniforms);
  }

  /**
   * Uploads free real parameter values as float uniforms to both programs.
   * Must be called before each render call when params are present.
   */
  setParams(values: Record<string, number>): void {
    const gl = this.gl;
    for (const name of this.paramNames) {
      const v = values[name] ?? 0;
      if (this.prog2D) {
        const loc2 = gl.getUniformLocation(this.prog2D, `p_${name}`);
        if (loc2 !== null) gl.uniform1f(loc2, v);
      }
      if (this.prog3D) {
        const loc3 = gl.getUniformLocation(this.prog3D, `p_${name}`);
        if (loc3 !== null) gl.uniform1f(loc3, v);
      }
    }
  }

  // ── Surface mesh ───────────────────────────────────────────────────────────

  buildSurface(resolution: number, range: number): void {
    const gl = this.gl;
    if (!gl) return;
    const N = resolution, R = range, step = 2 * R / (N - 1);

    const verts = new Float32Array(N * N * 2);
    let vi = 0;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        verts[vi++] = -R + i * step;
        verts[vi++] = -R + j * step;
      }

    const ids = new Uint16Array((N - 1) * (N - 1) * 6);
    let ii = 0;
    for (let i = 0; i < N - 1; i++)
      for (let j = 0; j < N - 1; j++) {
        const a = i * N + j, b = (i + 1) * N + j, c = i * N + (j + 1), d = (i + 1) * N + (j + 1);
        ids[ii++] = a; ids[ii++] = b; ids[ii++] = c;
        ids[ii++] = b; ids[ii++] = d; ids[ii++] = c;
      }

    const lineIds = new Uint16Array(N * (N - 1) * 4);
    let li = 0;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N - 1; j++) { lineIds[li++] = i * N + j; lineIds[li++] = i * N + j + 1; }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N - 1; i++) { lineIds[li++] = i * N + j; lineIds[li++] = (i + 1) * N + j; }

    if (!this.vbo3D) this.vbo3D = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo3D!);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    if (!this.ibo3D) this.ibo3D = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3D!);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ids, gl.STATIC_DRAW);

    if (!this.ibo3DLines) this.ibo3DLines = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3DLines!);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIds, gl.STATIC_DRAW);

    this.iCount = ids.length;
    this.iCountLines = lineIds.length;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render2D(
    canvas: HTMLCanvasElement,
    vp: ComplexViewport2D,
    scheme: ColorScheme,
    modLines: boolean,
  ): void {
    const gl = this.gl;
    if (!gl || !this.prog2D) return;
    const W = canvas.width, H = canvas.height;
    const si = ({ classic: 0, phase: 1, magnitude: 2 } as const)[scheme];

    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog2D);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo2D);
    const pos = gl.getAttribLocation(this.prog2D, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.u2D['center'], vp.centerRe, vp.centerIm);
    gl.uniform1f(this.u2D['scale'],  H / vp.scale);
    gl.uniform2f(this.u2D['res'],    W, H);
    gl.uniform1i(this.u2D['scheme'], si);
    gl.uniform1i(this.u2D['modlines'], modLines ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  render3D(canvas: HTMLCanvasElement, vp: ComplexViewport3D): void {
    const gl = this.gl;
    if (!gl || !this.prog3D || !this.vbo3D) return;
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

    gl.uniform1f(this.u3D['rotX'],    vp.rotX);
    gl.uniform1f(this.u3D['rotY'],    vp.rotY);
    gl.uniform1f(this.u3D['zoom'],    vp.zoom);
    gl.uniform1f(this.u3D['range'],   vp.range);
    gl.uniform1f(this.u3D['hScale'],  vp.heightScale);
    gl.uniform1f(this.u3D['zClip'],   vp.zClip);
    gl.uniform2f(this.u3D['res'],     W, H);
    gl.uniform1f(this.u3D['gridStep'], this.niceStep3D(vp.range));
    gl.uniform1i(this.u3D['showGrid'], vp.showGrid ? 1 : 0);

    if (vp.wireframe) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3DLines!);
      gl.drawElements(gl.LINES, this.iCountLines, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo3D!);
      gl.drawElements(gl.TRIANGLES, this.iCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.prog2D) gl.deleteProgram(this.prog2D);
    if (this.prog3D) gl.deleteProgram(this.prog3D);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private build2D(glsl: string, paramUniforms: string): void {
    const gl = this.gl;
    const frag = FRAG_2D_TMPL
      .replace('PARAM_UNIFORMS', paramUniforms)
      .replace('USER_CODE', glsl);
    const p = this.glProgram(VERT_2D, frag);
    if (this.prog2D) gl.deleteProgram(this.prog2D);
    this.prog2D = p;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo2D);
    const pos = gl.getAttribLocation(p, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    this.u2D = this.uniformMap(p, ['center', 'scale', 'res', 'scheme', 'modlines']);
  }

  private build3D(glsl: string, paramUniforms: string): void {
    const vert = VERT_3D_TMPL
      .replace('PARAM_UNIFORMS', paramUniforms)
      .replace('USER_CODE', glsl);
    const p = this.glProgram(vert, FRAG_3D);
    if (this.prog3D) this.gl.deleteProgram(this.prog3D);
    this.prog3D = p;
    this.u3D = this.uniformMap(p, ['rotX', 'rotY', 'zoom', 'range', 'hScale', 'zClip', 'res', 'gridStep', 'showGrid']);
  }

  private glShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error');
    return s;
  }

  private glProgram(vSrc: string, fSrc: string): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.glShader(gl.VERTEX_SHADER, vSrc));
    gl.attachShader(p, this.glShader(gl.FRAGMENT_SHADER, fSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? 'program link error');
    return p;
  }

  private uniformMap(p: WebGLProgram, names: string[]): UniformMap {
    const map: UniformMap = {};
    names.forEach(n => { map[n] = this.gl.getUniformLocation(p, `u_${n}`); });
    return map;
  }

  private niceStep3D(range: number): number {
    return range <= 1.5 ? 0.25 : range <= 2.5 ? 0.5 : range <= 5 ? 1 : range <= 10 ? 2 : 5;
  }
}
