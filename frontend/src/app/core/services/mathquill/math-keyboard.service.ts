import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MathKeyboardService {
  // Operadores y funciones básicas
  mathButtonsBasic = [
    { latex: '\\pi', display: '\\pi', tooltip: 'Constante Pi (π)' },
    { latex: 'e', display: 'e', tooltip: 'Constante de Euler (e)' },
    {
      latex: '\\left (  \\right )',
      display: '\\left ( \\square \\right )',
      tooltip: 'Paréntesis',
    },
    { latex: '{}^2', display: '\\square^2', tooltip: 'Cuadrado' },
    { latex: '{}^{}', display: '{\\square}^{\\square}', tooltip: 'Potencia' },
    { latex: '\\cdot', display: '*', tooltip: 'Multiplicación' },
    { latex: '+', display: '+', tooltip: 'Suma' },
    { latex: '-', display: '-', tooltip: 'Resta' },
    {
      latex: '\\frac{ }{ }',
      display: '\\frac{\\square}{\\square}',
      tooltip: 'Fracción',
    },
    {
      latex: '\\sqrt{ }',
      display: '\\sqrt{\\square}',
      tooltip: 'Raíz Cuadrada',
    },
    {
      latex: '\\log{ }',
      display: '\\log{\\square}',
      tooltip: 'Logaritmo natural',
    },
    {
      latex: '\\exp{ }',
      display: '\\exp{\\left(\\square\\right)}',
      tooltip: 'Función Exponencial',
    },
  ];

  // Funciones trigonométricas soportadas por Maxima
  mathButtonsTrig = [
    {
      latex: '\\sin\\left( \\right )',
      display: '\\sin\\left(\\square\\right)',
      tooltip: 'Seno',
    },
    {
      latex: '\\cos\\left( \\right )',
      display: '\\cos\\left(\\square\\right)',
      tooltip: 'Coseno',
    },
    {
      latex: '\\tan\\left( \\right )',
      display: '\\tan\\left(\\square\\right)',
      tooltip: 'Tangente',
    },
    {
      latex: '\\cot\\left( \\right )',
      display: '\\cot\\left(\\square\\right)',
      tooltip: 'Cotangente',
    },
    {
      latex: '\\sec\\left( \\right )',
      display: '\\sec\\left(\\square\\right)',
      tooltip: 'Secante',
    },
    {
      latex: '\\csc\\left( \\right )',
      display: '\\csc\\left(\\square\\right)',
      tooltip: 'Cosecante',
    },
    {
      latex: '\\arcsin\\left( \\right )',
      display: '\\arcsin\\left(\\square\\right)',
      tooltip: 'Arcoseno (inversa del seno)',
    },
    {
      latex: '\\arccos\\left( \\right )',
      display: '\\arccos\\left(\\square\\right)',
      tooltip: 'Arcocoseno (inversa del coseno)',
    },
    {
      latex: '\\arctan\\left( \\right )',
      display: '\\arctan\\left(\\square\\right)',
      tooltip: 'Arcotangente (inversa de la tangente)',
    },
    {
      latex: '\\sinh\\left( \\right )',
      display: '\\sinh\\left(\\square\\right)',
      tooltip: 'Seno hiperbólico',
    },
    {
      latex: '\\cosh\\left( \\right )',
      display: '\\cosh\\left(\\square\\right)',
      tooltip: 'Coseno hiperbólico',
    },
    {
      latex: '\\tanh\\left( \\right )',
      display: '\\tanh\\left(\\square\\right)',
      tooltip: 'Tangente hiperbólica',
    },
  ];

  // Array completo para compatibilidad con código existente
  get mathButtons() {
    return [...this.mathButtonsBasic, ...this.mathButtonsTrig];
  }
}
