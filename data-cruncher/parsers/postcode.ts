import type { IPostcodeParser } from './interface'
import type { BoundSubDistrict, BoundZipCode } from '@types'
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'

import * as pdfjsLib from 'pdfjs-dist'
import { AbstractParser } from './base'
import { sortBy } from 'lodash'

interface PDFTextItem {
  str: string
  dir: string
  width: number
  height: number
  transform: number[]
  hasEOL?: boolean
}

interface PositionedTextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
  pageNum: number
  column: number
}

interface PDFPage {
  pageInfo: {
    num: number
    width: number
    height: number
  }
  items: PDFTextItem[]
}

export class PostcodePDFParser extends AbstractParser implements IPostcodeParser {
  async parse(
    sourceStream: ReadableStream,
    referenceSubDistrict: BoundSubDistrict[]
  ): Promise<BoundZipCode[]> {
    const buffer = await this.streamToBuffer(sourceStream)

    // Load PDF document (convert Buffer to Uint8Array)
    const uint8Array = new Uint8Array(buffer)
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
    const pdfDocument = await loadingTask.promise

    console.log(`📄 PDF contains ${pdfDocument.numPages} pages`)
    console.log('🔍 Analyzing PDF layout and detecting provinces...')

    const textItems: PositionedTextItem[] = []

    // Extract text from all pages with coordinate information
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      console.log(`📄 Processing page ${pageNum}...`)
      const page = await pdfDocument.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.0 })
      const textContent = await page.getTextContent()

      console.log(`📐 Page dimensions: ${viewport.width}x${viewport.height}`)
      console.log(`📝 Found ${textContent.items.length} text items`)

      // Process text items with their coordinates
      textItems.push(...this.normalizeTextItem(textContent.items as any, viewport, pageNum))
    }

    // order text items based on `pageNum` and `column`
    const sorted = sortBy(textItems, ['pageNum', 'column'])

    console.log('SORTED', sorted)

    // Return empty array for now since we're just detecting provinces
    return []
  }

  private normalizeTextItem(
    textItems: {
      str: string
      // PDF uses transform matrix [scaleX, skewX, skewY, scaleY, translateX, translateY]
      transform: [number, number, number, number, number, number]
      width: number
      height: number
    }[],
    viewport: { width: number; height: number },
    pageNum: number
  ): PositionedTextItem[] {
    const colCount = 7
    console.log('VIEW PORT WIDTH', viewport.width)
    const criteria = new Array<number>(colCount)
      .fill(0)
      .map((_, i, a) => (colCount - i) * (viewport.width / colCount))

    console.log('QU', criteria) // FIXME: Need Compesate for content's padding
    // Convert PDF text items to positioned items
    const positionedItems: PositionedTextItem[] = textItems
      .filter((a) => a.str.trim() !== '')
      .map((item) => {
        // PDF uses transform matrix [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const x = item.transform[4]
        const y = item.transform[5]
        const colIndex = criteria.reduce(
          (pv, offsetRequired, i) => pv || (x > offsetRequired ? i + 1 : 0),
          0
        ) // return 1~7
        // positioning

        return {
          text: item.str.trim(),
          x,
          y,
          width: item.width,
          height: item.height,
          pageNum,
          column: colIndex // Will be assigned below
        }
      })

    // Sort my positionedItems from top-bottom, then left-to-right (column, y)
    return positionedItems
  }
}
