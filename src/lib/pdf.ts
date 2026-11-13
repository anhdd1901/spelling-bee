import { extractWords } from './words'
import { openOcr, type OcrFn } from './ocr'

/** Đọc tối đa ngần này trang đầu (OCR mất vài giây mỗi trang). */
export const MAX_PDF_PAGES = 10

export interface PdfPageLike {
  /** Chữ có sẵn trong trang (rỗng nếu trang chỉ là ảnh scan). */
  text(): Promise<string>
  /** Vẽ trang ra ảnh PNG. */
  image(): Promise<Blob>
}

export interface PdfDocLike {
  numPages: number
  page(n: number): Promise<PdfPageLike>
}

export interface PdfWordsResult {
  words: string[]
  /** PDF dài hơn MAX_PDF_PAGES trang, phần sau bị bỏ qua. */
  truncated: boolean
}

interface CollectOptions {
  onProgress?: (p: number) => void
  /** Nhận ảnh trang 1 để xem trước. */
  onPreview?: (image: Blob) => void
  /** Hủy giữa chừng (đóng sheet): dừng trước trang kế tiếp. */
  signal?: AbortSignal
}

/**
 * Trang có ít hơn ngần này từ trong lớp chữ thì vẫn OCR: trang scan thường kèm vài chữ in sẵn
 * (tiêu đề, số trang) mà chữ thật nằm trong ảnh.
 */
const MIN_TEXT_WORDS = 5

/**
 * Gom từ trong các trang đầu của PDF: trang có chữ thì lấy chữ trực tiếp,
 * trang không có hoặc có rất ít chữ (ảnh scan) thì vẽ ra ảnh rồi OCR.
 * Trang lỗi thì bỏ qua; chỉ báo lỗi khi không đọc được trang nào.
 */
export async function collectPdfWords(doc: PdfDocLike, ocr: OcrFn, opts: CollectOptions = {}): Promise<PdfWordsResult> {
  const total = Math.min(doc.numPages, MAX_PDF_PAGES)
  const texts: string[] = []
  let lastError: unknown
  for (let n = 1; n <= total; n++) {
    opts.signal?.throwIfAborted()
    try {
      const page = await doc.page(n)
      let image: Blob | undefined
      if (n === 1 && opts.onPreview) {
        image = await page.image()
        opts.onPreview(image)
      }
      const text = await page.text()
      texts.push(text)
      if (extractWords(text, { minLength: 2 }).length < MIN_TEXT_WORDS) {
        image ??= await page.image()
        texts.push(await ocr(image, (p) => opts.onProgress?.((n - 1 + p) / total)))
      }
    } catch (e) {
      lastError = e
    }
    opts.onProgress?.(n / total)
  }
  opts.signal?.throwIfAborted()
  if (total > 0 && !texts.length) throw lastError
  return { words: extractWords(texts.join('\n'), { minLength: 2 }), truncated: doc.numPages > total }
}

/** Độ rộng ảnh khi vẽ trang để OCR / xem trước. */
const RENDER_WIDTH = 1600
/** Giới hạn số điểm ảnh của canvas (Safari iOS hỏng khi vượt ~16,7 triệu). */
const MAX_PIXELS = 8_000_000

/** Tỉ lệ vẽ trang (kích thước tính bằng point): rộng ~1600px, không quá 3 lần, không vượt MAX_PIXELS. */
export function renderScale(width: number, height: number): number {
  return Math.min(3, RENDER_WIDTH / width, Math.sqrt(MAX_PIXELS / (width * height)))
}

async function openPdf(file: Blob) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let pdf
  try {
    pdf = await task.promise
  } catch (e) {
    await task.destroy()
    throw e
  }
  const doc: PdfDocLike = {
    numPages: pdf.numPages,
    page: async (n) => {
      const page = await pdf.getPage(n)
      return {
        text: async () => {
          const content = await page.getTextContent()
          return content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join('')
        },
        image: async () => {
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: renderScale(base.width, base.height) })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          // intent 'print': vẽ liền một mạch, không chờ requestAnimationFrame (tab nền vẫn chạy tiếp).
          await page.render({ canvas, viewport, background: '#ffffff', intent: 'print' }).promise
          return new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas trống'))), 'image/png'),
          )
        },
      }
    },
  }
  return { doc, close: () => task.destroy() }
}

/** Đọc từ trong file PDF (pdf.js nạp lười). Worker OCR chỉ mở khi gặp trang scan. */
export async function wordsFromPdf(file: Blob, opts: CollectOptions = {}): Promise<PdfWordsResult> {
  const { doc, close } = await openPdf(file)
  let ocr: Awaited<ReturnType<typeof openOcr>> | undefined
  try {
    return await collectPdfWords(
      doc,
      async (image, onP) => {
        ocr ??= await openOcr()
        return ocr.recognize(image, onP)
      },
      opts,
    )
  } finally {
    // Lỗi khi dọn dẹp không được che kết quả hay lỗi thật.
    await ocr?.close().catch(() => {})
    await close().catch(() => {})
  }
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}
