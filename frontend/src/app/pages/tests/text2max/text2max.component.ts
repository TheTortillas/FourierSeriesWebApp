import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import TeX2Max from 'tex2max';

@Component({
  selector: 'app-text2max',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './text2max.component.html',
  styleUrl: './text2max.component.scss',
})
export class Text2maxComponent {
  latexInput: string = '';
  maximaOutput: string = '';

  constructor() {}

  convertToMaxima() {
    const converter = new TeX2Max({
      onlySingleVariables: false,
      handleEquation: true,
      addTimesSign: true,
      disallowDecimalPoints: false,
      disallowllowDecimalCommas: false,
      onlyGreekName: false,
      onlyGreekSymbol: false,
      debugging: false,
    });

    // Get the initial conversion
    let result = converter.toMaxima(this.latexInput);

    // Post-process the result to replace mathematical constants with Maxima format
    result = this.replaceMathConstants(result);

    this.maximaOutput = result;
  }

  private replaceMathConstants(input: string): string {
    // Replace common mathematical constants with their Maxima equivalents
    const replacements: { [key: string]: string } = {
      '\\pi': '%pi',
      pi: '%pi',
      '\\e': '%e',
      e: '%e', // Be careful with this one as it might incorrectly replace variables
    };

    let result = input;

    // First handle the LaTeX escapes directly from the input
    Object.entries(replacements).forEach(([latex, maxima]) => {
      const regex = new RegExp(latex.replace(/\\/g, '\\\\'), 'g');
      if (this.latexInput.includes(latex)) {
        result = result.replace(regex, maxima);
      }
    });

    return result;
  }
}
