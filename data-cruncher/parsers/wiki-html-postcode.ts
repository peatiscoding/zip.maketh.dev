import type { IPostcodeParser } from './interface'
import type { BoundSubDistrict, BoundZipCode } from '@types'

import { WebCachedParser } from './base'
import * as cheerio from 'cheerio'

interface WikiPostcodeRecord {
  provinceNameTh: string
  provinceNameEn: string
  districtName: string
  postalCode: string
  notes?: string
}

const WIKI_URL =
  'https://th.wikipedia.org/wiki/%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A3%E0%B8%AB%E0%B8%B1%E0%B8%AA%E0%B9%84%E0%B8%9B%E0%B8%A3%E0%B8%A9%E0%B8%93%E0%B8%B5%E0%B8%A2%E0%B9%8C%E0%B9%84%E0%B8%97%E0%B8%A2'

export class WikiHtmlPostcodeParser extends WebCachedParser implements IPostcodeParser {
  async parse(
    _sourceStream: ReadableStream, // ignore this
    referenceSubDistrict: BoundSubDistrict[]
  ): Promise<BoundZipCode[]> {
    console.log('🌐 Processing postal codes from Wikipedia HTML...')

    // Get cached HTML or fetch new
    const html = await this.getCachedHtml(WIKI_URL, 'wikipedia-postal-codes')

    // Parse HTML content
    const postcodeRecords = await this.parseHtmlContent(html)

    console.log(`📊 Extracted ${postcodeRecords.length} postal code records from Wikipedia`)

    // Remove the arbitrary minimum threshold since we have a structured approach
    if (postcodeRecords.length === 0) {
      throw new Error('No Wikipedia postal code data found')
    }

    // Convert to BoundZipCode array
    const zipCodes: BoundZipCode[] = []
    const processedZipCodes = new Set<string>()

    for (const record of postcodeRecords) {
      if (processedZipCodes.has(record.postalCode)) continue

      // Find all sub-districts that match this province
      const matchingSubDistricts = referenceSubDistrict.filter((subDistrict) => {
        const provinceTh = subDistrict.distrct.province.title.th.toLowerCase().trim()
        const provinceEn = subDistrict.distrct.province.title.en.toLowerCase().trim()

        const recordProvinceTh = record.provinceNameTh.toLowerCase().trim()
        const recordProvinceEn = record.provinceNameEn.toLowerCase().trim()

        return (
          provinceTh === recordProvinceTh ||
          provinceTh.includes(recordProvinceTh) ||
          recordProvinceTh.includes(provinceTh) ||
          (recordProvinceEn &&
            (provinceEn === recordProvinceEn ||
              provinceEn.includes(recordProvinceEn) ||
              recordProvinceEn.includes(provinceEn)))
        )
      })

      if (matchingSubDistricts.length > 0) {
        // Limit to reasonable number of sub-districts per postal code
        const limitedSubDistricts = matchingSubDistricts.slice(0, 20)

        const zipCode: BoundZipCode = {
          code: record.postalCode,
          subDistricts: limitedSubDistricts
        }

        zipCodes.push(zipCode)
        processedZipCodes.add(record.postalCode)

        const provinceName = limitedSubDistricts[0]?.distrct.province.title.th || 'Unknown'
        console.log(
          `📮 ${record.postalCode} -> ${limitedSubDistricts.length} sub-districts in ${provinceName}`
        )
      }
    }

    console.log(`✅ Created ${zipCodes.length} postal code mappings from Wikipedia data`)

    return zipCodes
  }

  protected async parseHtmlContent(html: string): Promise<WikiPostcodeRecord[]> {
    // Parse HTML with Cheerio
    const $ = cheerio.load(html)

    const postcodeRecords: WikiPostcodeRecord[] = []

    console.log(`🔍 Processing Wikipedia HTML structure...`)

    // Find all h2 elements that have province IDs
    $('h2[id]').each((_, h2Element) => {
      const $h2 = $(h2Element)
      const provinceId = $h2.attr('id')

      if (!provinceId) return

      // Get province name from h2 text content - try multiple approaches
      let provinceText = $h2.find('.mw-headline').text().trim()
      if (!provinceText) {
        provinceText = $h2.text().trim()
      }

      if (!provinceText) {
        return
      }

      // Extract province names (Thai and English if available)
      const provinceMatch = provinceText.match(/^([^\s(]+)(?:\s*\(([^)]+)\))?/)
      const provinceNameTh = provinceMatch ? provinceMatch[1] : provinceText
      const provinceNameEn = provinceMatch ? provinceMatch[2] || '' : ''

      // Go up one level to the div containing this h2
      const $parentDiv = $h2.parent()

      // Find the next element after this div which should be the table
      const $nextElement = $parentDiv.next()

      if ($nextElement.is('table')) {
        // This is the postal code table for this province
        const $table = $nextElement
        const $rows = $table.find('tr')

        // Skip header row and process data rows
        $rows.each((rowIndex, row) => {
          if (rowIndex === 0) return // Skip header row

          const $row = $(row)
          const $cells = $row.find('td')

          if ($cells.length < 2) return // Need at least district and postcode columns

          // Column structure: เขต (district), รหัสไปรษณีย์ (postcode), หมายเหตุ (note)
          const districtText = $cells.eq(0).text().trim()
          const postcodeText = $cells.eq(1).text().trim()
          const noteText = $cells.length > 2 ? $cells.eq(2).text().trim() : ''

          // Extract postal codes from the postcode column
          const postalCodeMatches = postcodeText.match(/\d{5}/g)

          if (postalCodeMatches && districtText) {
            postalCodeMatches.forEach((postcode) => {
              postcodeRecords.push({
                provinceNameTh,
                provinceNameEn,
                districtName: districtText,
                postalCode: postcode,
                notes: noteText
              })

              // Removed excessive logging
            })
          }
        })
      }
    })

    return postcodeRecords
  }
}
