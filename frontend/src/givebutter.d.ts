import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// <givebutter-widget id="..."> is a custom element defined by Givebutter's
// script (index.html). Declared here so TSX accepts it.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'givebutter-widget': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
