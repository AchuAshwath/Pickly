// Minimal ambient typings for the 'exifr' package
declare module 'exifr' {
  const exifr: {
    parse: (input: Blob | ArrayBuffer | File) => Promise<Record<string, unknown>>
  }
  export default exifr
}
