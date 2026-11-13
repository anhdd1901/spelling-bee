import { describe, expect, it, vi } from 'vitest'
import { collectPdfWords, MAX_PDF_PAGES, renderScale, type PdfDocLike } from './pdf'

function fakeDoc(pages: (string | Error)[]): PdfDocLike & { images: number[] } {
  const images: number[] = []
  return {
    numPages: pages.length,
    images,
    page: async (n) => ({
      text: async () => {
        const p = pages[n - 1]
        if (p instanceof Error) throw p
        return p
      },
      image: async () => {
        images.push(n)
        return new Blob([`page-${n}`])
      },
    }),
  }
}

describe('collectPdfWords', () => {
  it('lấy chữ có sẵn trong trang, gộp và bỏ từ trùng giữa các trang', async () => {
    const doc = fakeDoc(['apple banana kiwi lime plum', 'Banana cherry kiwi lime plum'])
    const ocr = vi.fn()
    const r = await collectPdfWords(doc, ocr)
    expect(r.words).toEqual(['apple', 'banana', 'kiwi', 'lime', 'plum', 'cherry'])
    expect(r.truncated).toBe(false)
    expect(ocr).not.toHaveBeenCalled()
  })

  it('trang không có chữ (ảnh scan) thì vẽ ra ảnh và OCR', async () => {
    const doc = fakeDoc(['apple pear plum grape kiwi', '   '])
    const ocr = vi.fn(async () => 'dog cat')
    const r = await collectPdfWords(doc, ocr)
    expect(ocr).toHaveBeenCalledTimes(1)
    expect(doc.images).toEqual([2])
    expect(r.words).toEqual(['apple', 'pear', 'plum', 'grape', 'kiwi', 'dog', 'cat'])
  })

  it(`chỉ đọc ${MAX_PDF_PAGES} trang đầu và báo truncated`, async () => {
    // Mỗi trang 5 từ khác nhau: "aa ab ac ad ae", "ba bb bc bd be", …
    const pages = [...'abcdefghijkl'.slice(0, MAX_PDF_PAGES + 2)].map((c) => [...'abcde'].map((d) => c + d).join(' '))
    const doc = fakeDoc(pages)
    const r = await collectPdfWords(doc, vi.fn())
    expect(r.truncated).toBe(true)
    expect(r.words).toHaveLength(MAX_PDF_PAGES * 5)
  })

  it('báo tiến độ theo số trang đã đọc', async () => {
    const progress: number[] = []
    await collectPdfWords(fakeDoc(Array.from({ length: 4 }, () => 'ant bee cow dog elk')), vi.fn(), { onProgress: (p) => progress.push(p) })
    expect(progress).toEqual([0.25, 0.5, 0.75, 1])
  })

  it('tiến độ OCR trong một trang được tính vào phần của trang đó', async () => {
    const progress: number[] = []
    const ocr = vi.fn(async (_b: Blob, onP?: (p: number) => void) => {
      onP?.(0.5)
      return 'dog'
    })
    await collectPdfWords(fakeDoc(['', 'ant bee cow dog elk']), ocr, { onProgress: (p) => progress.push(p) })
    expect(progress).toEqual([0.25, 0.5, 1])
  })

  it('gửi ảnh trang 1 để xem trước, kể cả khi trang 1 có chữ', async () => {
    const doc = fakeDoc(['apple pear plum grape kiwi', 'lemon lime melon peach mango'])
    const onPreview = vi.fn()
    await collectPdfWords(doc, vi.fn(), { onPreview })
    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(await (onPreview.mock.calls[0][0] as Blob).text()).toBe('page-1')
  })

  it('trang scan có vài chữ in sẵn (tiêu đề) vẫn được OCR', async () => {
    const ocr = vi.fn(async () => 'dog cat')
    const r = await collectPdfWords(fakeDoc(['Week Spelling']), ocr)
    expect(ocr).toHaveBeenCalledTimes(1)
    expect(r.words).toEqual(['week', 'spelling', 'dog', 'cat'])
  })

  it('một trang lỗi thì bỏ qua, vẫn giữ từ của các trang khác', async () => {
    const r = await collectPdfWords(fakeDoc(['apple pear plum grape kiwi', new Error('hỏng')]), vi.fn())
    expect(r.words).toEqual(['apple', 'pear', 'plum', 'grape', 'kiwi'])
  })

  it('mọi trang đều lỗi thì báo lỗi', async () => {
    await expect(collectPdfWords(fakeDoc([new Error('a'), new Error('b')]), vi.fn())).rejects.toThrow()
  })

  it('dừng khi bị hủy (đóng sheet)', async () => {
    const ctl = new AbortController()
    const doc = fakeDoc(['apple pear plum grape kiwi', 'lemon lime melon peach mango'])
    const page = doc.page
    doc.page = async (n) => {
      if (n === 2) ctl.abort()
      return page(n)
    }
    await expect(collectPdfWords(doc, vi.fn(), { signal: ctl.signal })).rejects.toThrow()
  })
})

describe('renderScale', () => {
  it('trang thường: rộng 1600px', () => {
    expect(renderScale(612, 792)).toBeCloseTo(1600 / 612)
  })
  it('trang rất dài: giới hạn số điểm ảnh để không vượt canvas của iOS', () => {
    const s = renderScale(612, 5000)
    expect(Math.ceil(612 * s) * Math.ceil(5000 * s)).toBeLessThan(8_010_000)
  })
  it('trang nhỏ: không phóng quá 3 lần', () => {
    expect(renderScale(100, 100)).toBe(3)
  })
})
