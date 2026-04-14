import { Component, ElementRef, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { MathquillService, KeyBtn } from '../../../core/services/math/mathquill.service';

type TabId = '123' | 'trig' | 'fx' | 'abc' | 'extra';

interface Tab {
  id: TabId;
  label: string;
}

const NUM_ROWS: KeyBtn[][] = [
  [
    { label: '7', typedText: '7' },
    { label: '8', typedText: '8' },
    { label: '9', typedText: '9' },
    { label: '/', typedText: '/' },
    { label: '(', typedText: '(' },
    { label: ')', typedText: ')' },
  ],
  [
    { label: '4', typedText: '4' },
    { label: '5', typedText: '5' },
    { label: '6', typedText: '6' },
    { label: '×', typedText: '*' },
    { label: 'xⁿ', cmd: '^' },
    { label: '√·', cmd: '\\sqrt' },
  ],
  [
    { label: '1', typedText: '1' },
    { label: '2', typedText: '2' },
    { label: '3', typedText: '3' },
    { label: '−', write: '-' },
    { label: '+', typedText: '+' },
    { label: '.', typedText: '.' },
  ],
  [
    { label: '0', typedText: '0' },
    { label: 'π', typedText: 'pi' },
    { label: 'eˣ' },
    { label: '|·|' },
    { label: '⌫', keystroke: 'Backspace' },
  ],
];

const TRIG_ROWS: KeyBtn[][] = [
  [
    { label: 'sin', typedText: 'sin(' },
    { label: 'cos', typedText: 'cos(' },
    { label: 'tan', typedText: 'tan(' },
    { label: 'cot', typedText: 'cot(' },
  ],
  [
    { label: 'asin', typedText: 'asin(' },
    { label: 'acos', typedText: 'acos(' },
    { label: 'atan', typedText: 'atan(' },
  ],
  [
    { label: 'sinh', typedText: 'sinh(' },
    { label: 'cosh', typedText: 'cosh(' },
    { label: 'tanh', typedText: 'tanh(' },
  ],
  [
    { label: 'sec', typedText: 'sec(' },
    { label: 'csc', typedText: 'csc(' },
  ],
];

const FX_ROWS: KeyBtn[][] = [
  [
    { label: 'log', typedText: 'log(' },
    { label: 'ln', typedText: 'ln(' },
    { label: 'exp' },
    { label: '|·|' },
  ],
  [
    { label: '√·', cmd: '\\sqrt' },
    { label: 'xⁿ', cmd: '^' },
    { label: 'eˣ' },
    { label: 'π', typedText: 'pi' },
  ],
  [
    { label: 'n!', typedText: 'factorial(' },
    { label: 'Γ(·)' },
    { label: '(', typedText: '(' },
    { label: ')', typedText: ')' },
  ],
  [
    { label: '\\', typedText: '\\' },
    { label: '⌫', keystroke: 'Backspace' },
  ],
];

const LETTERS_ROWS: KeyBtn[][] = [
  [
    { label: 'a', typedText: 'a' },
    { label: 'b', typedText: 'b' },
    { label: 'c', typedText: 'c' },
    { label: 'k', typedText: 'k' },
    { label: 'n', typedText: 'n' },
    { label: 'm', typedText: 'm' },
  ],
  [
    { label: 'T', typedText: 'T' },
    { label: 'L', typedText: 'L' },
    { label: 'A', typedText: 'A' },
    { label: 'B', typedText: 'B' },
    { label: 'N', typedText: 'N' },
    { label: 'K', typedText: 'K' },
  ],
  [
    { label: 'α', write: '\\alpha' },
    { label: 'β', write: '\\beta' },
    { label: 'γ', write: '\\gamma' },
    { label: 'λ', write: '\\lambda' },
    { label: 'ω', write: '\\omega' },
    { label: 'τ', write: '\\tau' },
  ],
  [
    { label: 'φ', write: '\\phi' },
    { label: 'θ', write: '\\theta' },
    { label: 'σ', write: '\\sigma' },
    { label: 'ε', write: '\\epsilon' },
    { label: 'μ', write: '\\mu' },
  ],
];

@Component({
  selector: 'app-mobile-math-keyboard',
  templateUrl: './mobile-math-keyboard.component.html',
})
export class MobileMathKeyboardComponent implements OnInit, OnDestroy {
  readonly mqs = inject(MathquillService);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  /** Context-specific extra buttons (e.g. δ, u, sgn for transforms). */
  readonly extraGroup = input<KeyBtn[]>([]);

  readonly activeTab = signal<TabId>('123');

  readonly visibleTabs = computed<Tab[]>(() => {
    const tabs: Tab[] = [
      { id: '123', label: '123' },
      { id: 'abc', label: 'abc' },
      { id: 'trig', label: 'Trig' },
      { id: 'fx', label: 'f(x)' },
    ];
    if (this.extraGroup().length) tabs.push({ id: 'extra', label: '···' });
    return tabs;
  });

  readonly activeRows = computed<KeyBtn[][]>(() => {
    switch (this.activeTab()) {
      case 'abc':   return LETTERS_ROWS;
      case 'trig':  return TRIG_ROWS;
      case 'fx':    return FX_ROWS;
      case 'extra': return [this.extraGroup()];
      default:      return NUM_ROWS;
    }
  });

  // ── Close on outside tap ───────────────────────────────────────────────────

  private readonly _outsideHandler = (e: PointerEvent) => {
    if (!this.mqs.activeFieldName()) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Tap inside the keyboard panel → keep open
    if (this.elRef.nativeElement.contains(target)) return;
    // Tap inside any MathQuill field → keep open (user is interacting with input)
    if (target.closest('.mq-editable-field')) return;
    this.mqs.clearActiveField();
  };

  ngOnInit(): void {
    document.addEventListener('pointerdown', this._outsideHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this._outsideHandler);
  }

  stopDefault(e: MouseEvent): void {
    e.preventDefault();
  }
}
