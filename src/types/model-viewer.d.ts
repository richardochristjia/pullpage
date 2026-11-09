import type React from "react";

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "animation-name"?: string;
        autoplay?: boolean | string;
        "camera-orbit"?: string;
        "camera-target"?: string;
        "field-of-view"?: string;
        "disable-zoom"?: boolean | string;
        "disable-pan"?: boolean | string;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string | number;
        exposure?: string | number;
        style?: React.CSSProperties;
        [key: string]: unknown;
      };
    }
  }
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "animation-name"?: string;
        autoplay?: boolean | string;
        "camera-orbit"?: string;
        "camera-target"?: string;
        "field-of-view"?: string;
        "disable-zoom"?: boolean | string;
        "disable-pan"?: boolean | string;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string | number;
        exposure?: string | number;
        style?: React.CSSProperties;
        [key: string]: unknown;
      };
    }
  }
}
