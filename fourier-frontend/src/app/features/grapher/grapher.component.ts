import { Component, signal } from '@angular/core';
import { NavComponent } from '../../shared/components/nav/nav.component';
import {
  GrapherExpressionComponent,
  GraphExpression,
  GRAPH_PALETTE,
} from './grapher-expression.component';

let _idCounter = 0;
function newExpr(colorIdx = 0): GraphExpression {
  return {
    id: `expr-${++_idCounter}`,
    latex: '',
    maxima: '',
    color: GRAPH_PALETTE[colorIdx % GRAPH_PALETTE.length],
    visible: true,
    lineWidth: 2,
  };
}

@Component({
  selector: 'app-grapher',
  templateUrl: './grapher.component.html',
  imports: [NavComponent, GrapherExpressionComponent],
})
export class GrapherComponent {
  readonly expressions = signal<GraphExpression[]>([newExpr(0)]);

  addExpression(): void {
    this.expressions.update((list) => [...list, newExpr(list.length)]);
  }

  updateExpression(updated: GraphExpression): void {
    this.expressions.update((list) =>
      list.map((e) => (e.id === updated.id ? updated : e)),
    );
  }

  removeExpression(id: string): void {
    this.expressions.update((list) => list.filter((e) => e.id !== id));
  }
}
