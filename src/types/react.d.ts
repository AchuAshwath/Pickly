// src/types/react.d.ts
import 'react';

declare module 'react' {
  // Augment the existing InputHTMLAttributes interface
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // Add the non-standard attributes
    // Use 'string' as type since they are attributes without explicit boolean values in HTML
    directory?: string;
    webkitdirectory?: string;
  }
}