/**
 * Type declarations for model-viewer web component.
 * @see https://modelviewer.dev/
 */

declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        alt?: string
        'auto-rotate'?: boolean
        'camera-controls'?: boolean
        'touch-action'?: string
        poster?: string
        ar?: boolean
        'ar-modes'?: string
        'ar-scale'?: string
        'environment-image'?: string
        exposure?: string
        'shadow-intensity'?: string
        'shadow-softness'?: string
      },
      HTMLElement
    >
  }
}
