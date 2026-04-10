/**
 * Extract all text from a PDF file.
 * Lazy-loads pdfjs-dist only when called (keeps initial bundle small).
 * @param {File} file - PDF File object from file input
 * @returns {Promise<string>} extracted text content
 */
export async function extractPdfText(file) {
  const pdfjsLib = await import('pdfjs-dist')

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    pages.push(`--- Page ${i} ---\n${text}`)
  }

  return pages.join('\n\n')
}
