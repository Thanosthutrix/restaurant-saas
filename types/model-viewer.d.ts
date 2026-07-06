import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          ar?: boolean;
          "ar-modes"?: string;
          "camera-controls"?: boolean;
          "touch-action"?: string;
          "shadow-intensity"?: string;
          "shadow-softness"?: string;
          exposure?: string;
          "tone-mapping"?: string;
          "environment-image"?: string;
          "ar-scale"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
