import type { IPostcodeParser } from './interface'
import type { BoundSubDistrict, BoundZipCode } from '@types'

import * as pdfjsLib from 'pdfjs-dist'
import { AbstractParser } from './base'
import { sortBy } from 'lodash'
import { PageViewport } from 'pdfjs-dist/types/src/display/display_utils'

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
  kind: 'postcode' | 'district' | 'clause' | 'province'
}

interface PDFPage {
  pageInfo: {
    num: number
    width: number
    height: number
  }
  items: PDFTextItem[]
}

interface PostcodeMatchingRecord {
  postCode: string
  provinceName: string
  exceptionClauses: string
  subDistrict: string[]
  district: string
}

class PostcodeCollector {
  currentProvince: string = ''
  currentDistrict: string = ''
  currentClauses: string[] = []

  public out: PostcodeMatchingRecord[]

  constructor() {
    this.out = []
  }

  public collect(item: PositionedTextItem) {
    if (item.kind === 'province') {
      this.currentProvince = item.text
      this.currentClauses = []
    } else if (item.kind === 'district') {
      this.currentDistrict = item.text
      this.currentClauses = []
    } else if (item.kind === 'clause') {
      this.currentClauses.push(item.text)
    } else if (item.kind === 'postcode') {
      /// commit result
      this.out.push({
        provinceName: this.currentProvince,
        district: this.currentDistrict,
        postCode: item.text,
        exceptionClauses: this.currentClauses.join(' '),
        subDistrict: []
      })

      console.log('MATCHED >>> ', this.out[this.out.length - 1])
      this.currentClauses = []
    }
  }
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
      console.log(`📐  .. Offset: x = ${viewport.offsetX}, y = ${viewport.offsetY}`)
      console.log(`📝 Found ${textContent.items.length} text items`)

      // Process text items with their coordinates
      textItems.push(...this.normalizeTextItem(textContent.items as any, viewport, pageNum))
    }

    // order text items based on `pageNum` and `column`
    const yScaling = 3
    const sorted = sortBy(textItems, [
      'pageNum',
      'column',
      (d) => -Math.floor(d.y / yScaling), // same y Groupping based on Y
      (d) => d.x
    ])

    const collector = new PostcodeCollector()
    for (const item of sorted) {
      collector.collect(item)
    }

    console.log('COLLECTED', collector.out.length, 'records')

    // Return empty array for now since we're just detecting provinces
    return []
  }

  private normalizeTextItem(
    textItems: {
      str: string
      // PDF uses transform matrix [scaleX, skewX, skewY, scaleY, translateX, translateY]
      transform: [number, number, number, number, number, number]
      fontName: string
      hasEOL: boolean
      width: number
      height: number
    }[],
    vp: PageViewport,
    pageNum: number
  ): PositionedTextItem[] {
    const colCount = 7
    const indentOffsetX = 60
    const boundingMaxY = 2250
    const provinceFont = 'g_d0_f2'
    const colWidth = (vp.width - indentOffsetX * 2) / colCount
    const criteria = new Array<number>(colCount)
      .fill(0)
      .map((_, i) => (colCount - i - 1) * colWidth + indentOffsetX)
    const centers = criteria.map((c) => c + colWidth / 2)
    console.log('CRTERIA', criteria)
    console.log('CENTERS', centers)

    // Convert PDF text items to positioned items
    const positionedItems: PositionedTextItem[] = textItems
      .map((item) => {
        if (item.str.trim() === '') {
          return null
        }
        // PDF uses transform matrix [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const x = item.transform[4]
        const y = item.transform[5]

        if (y > boundingMaxY) {
          return null
        }

        const matchedColNum = criteria.reduce(
          (pv, offsetRequired, i) => pv || (x > offsetRequired ? i + 1 : 0),
          0
        ) // return 1~7
        if (matchedColNum <= 0) {
          return null
        }

        const colIndex = colCount - matchedColNum + 1
        // positioning
        const xOffset = criteria[matchedColNum - 1]
        const isProvince = item.fontName === provinceFont
        const kind: PositionedTextItem['kind'] = item.str.trim().match(/^\d{5}/)
          ? 'postcode'
          : Math.abs(xOffset - x) < 20 // left hugged text
            ? 'district'
            : isProvince
              ? 'province'
              : 'clause'

        return {
          text: item.str.trim(),
          x,
          y,
          width: item.width,
          height: item.height,
          pageNum,
          kind,
          column: colIndex // Will be assigned below
        }
      })
      .filter(Boolean)
      .map((a) => a!)

    // Sort my positionedItems from top-bottom, then left-to-right (column, y)
    return positionedItems
  }
}
