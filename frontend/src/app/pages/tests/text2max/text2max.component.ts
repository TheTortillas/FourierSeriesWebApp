import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import TeX2Max from 'tex2max';

@Component({
  selector: 'app-text2max',
  standalone: true,
  imports: [ FormsModule],
  templateUrl: './text2max.component.html',
  styleUrl: './text2max.component.scss'
})
export class Text2maxComponent {
  latexInput: string = '';
  maximaOutput: string = ''; 

  constructor() {}
    // const converter = new TeX2Max({
    //   onlySingleVariables: false,
    //   handleEquation: true,
    //   addTimesSign: true,
    //   disallowDecimalPoints: false,
    //   disallowllowDecimalCommas: false,
    //   onlyGreekName: false,
    //   onlyGreekSymbol: false,
    //   debugging: false
    // });

    //const latexInput = "\\frac{\\left ( x^{e} \\right )\\left ( x+y \\right )^{90}}{2^{25 \\cdot x  \\cdot 2\\pi2}}";
    //this.maximaOutput = converter.toMaxima(latexInput);


    convertToMaxima() {
      const converter = new TeX2Max({
        onlySingleVariables: false,
        handleEquation: true,
        addTimesSign: true,
        disallowDecimalPoints: false,
        disallowllowDecimalCommas: false,
        onlyGreekName: false,
        onlyGreekSymbol: false,
        debugging: false
      });
    this.maximaOutput = converter.toMaxima(this.latexInput);
  }
}

// Creamos el archivo tex2max.d.ts en la carpeta src de nuestro proyecto Angular y copiamos el contenido de la clase TeX2Max y la interfaz TeX2MaxOptions.

