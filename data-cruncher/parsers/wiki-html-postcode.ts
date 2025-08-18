import type { IPostcodeParser } from './interface'
import type { BoundProvince, BoundDistrict, BoundSubDistrict, BoundZipCode } from '@types'

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

export const _helpers = {
  /**
   * Find sub-districts that should be excluded from the current postal code based on exception notes
   */
  parseExcludedSubDistricts(note: string, allSubDistricts: BoundSubDistrict[]): BoundSubDistrict[] {
    const exceptions = _helpers.parseExceptionsFromNotes(note)
    const excludedSubDistricts: BoundSubDistrict[] = []

    for (const exception of exceptions) {
      for (const subDistrictName of exception.subDistrictNames) {
        const matchingSubDistricts = allSubDistricts.filter((subDistrict) => {
          const nameTh = subDistrict.title.th.toLowerCase()
          const nameEn = subDistrict.title.en?.toLowerCase() || ''
          const searchName = subDistrictName.toLowerCase()

          return (
            nameTh === searchName ||
            nameEn === searchName ||
            nameTh.includes(searchName) ||
            (nameEn && nameEn.includes(searchName))
          )
        })

        excludedSubDistricts.push(...matchingSubDistricts)
      }
    }

    return excludedSubDistricts
  },
  /**
   * Parse exception clauses from Wikipedia notes to identify sub-districts that should use different postal codes
   * Pattern: "ยกเว้น [ตำบล/แขวง names] ใช้รหัส [postal code]"
   *
   * @param notes The notes text from Wikipedia
   * @returns Array of exceptions with sub-district names and their correct postal codes
   */
  parseExceptionsFromNotes(
    notes: string
  ): Array<{ subDistrictNames: string[]; postalCode: string }> {
    if (!notes) return []

    const exceptions: Array<{ subDistrictNames: string[]; postalCode: string }> = []

    // Pattern to match: ยกเว้น ... ใช้รหัส XXXXX
    const exceptionPattern = /ยกเว้น([^ใช้]+)ใช้รหัส\s*(\d{5})/g

    let match
    while ((match = exceptionPattern.exec(notes)) !== null) {
      const exceptionText = match[1].trim()
      const postalCode = match[2]

      // Extract sub-district names from the exception text
      const subDistrictNames: string[] = []

      // Patterns for sub-district names - more precise matching
      const namePatterns = [
        /ตำบล([^\s,และใช้เฉพาะ]+)/g, // "ตำบลXXX"
        /แขวง([^\s,และใช้เฉพาะ]+)/g // "แขวงXXX" (for Bangkok)
      ]

      for (const namePattern of namePatterns) {
        let nameMatch
        while ((nameMatch = namePattern.exec(exceptionText)) !== null) {
          subDistrictNames.push(nameMatch[1].trim())
        }
      }

      if (subDistrictNames.length > 0) {
        exceptions.push({ subDistrictNames, postalCode })
      }
    }

    return exceptions
  }
}

export class WikiHtmlPostcodeParser extends WebCachedParser implements IPostcodeParser {
  /**
   * Find sub-districts by their Thai names
   */
  private findSubDistrictsByNames(
    subDistrictNames: string[],
    allSubDistricts: BoundSubDistrict[]
  ): BoundSubDistrict[] {
    const foundSubDistricts: BoundSubDistrict[] = []

    for (const subDistrictName of subDistrictNames) {
      const matchingSubDistricts = allSubDistricts.filter((subDistrict) => {
        const nameTh = subDistrict.title.th.toLowerCase()
        const nameEn = subDistrict.title.en?.toLowerCase() || ''
        const searchName = subDistrictName.toLowerCase()

        return (
          nameTh === searchName ||
          nameEn === searchName ||
          nameTh.includes(searchName) ||
          (nameEn && nameEn.includes(searchName))
        )
      })

      foundSubDistricts.push(...matchingSubDistricts)
    }

    // Remove duplicates
    const uniqueSubDistricts = foundSubDistricts.filter(
      (subDistrict, index, arr) => arr.findIndex((s) => s.code === subDistrict.code) === index
    )

    return uniqueSubDistricts
  }

  async parse(
    _sourceStream: ReadableStream, // ignore this
    refData: {
      provinces: BoundProvince[]
      districts: BoundDistrict[]
      subDistricts: BoundSubDistrict[]
    }
  ): Promise<BoundZipCode[]> {
    console.log('🌐 Processing postal codes from Wikipedia HTML...')

    // Create province lookup map for on-the-fly validation
    const provinceLookup = new Map<string, BoundProvince>()
    for (const province of refData.provinces) {
      const key = province.title.th.toLowerCase().trim().replace('จ. ', '')
      provinceLookup.set(key, province)
    }

    // Get cached HTML or fetch new
    const html = await this.getCachedHtml(WIKI_URL, 'wikipedia-postal-codes')

    // Parse HTML content with on-the-fly validation
    const rawWikiRows = await this.parseHtmlContent(html, provinceLookup)

    console.log(`📊 Extracted ${rawWikiRows.length} postal code records from Wikipedia`)

    // Remove the arbitrary minimum threshold since we have a structured approach
    if (rawWikiRows.length === 0) {
      throw new Error('No Wikipedia postal code data found')
    }

    // Convert to BoundZipCode array with exception handling
    const zipCodeMap = new Map<string, BoundZipCode>()

    for (const row of rawWikiRows) {
      const rowProvinceTh = row.provinceNameTh.toLowerCase().trim()
      const rowProvinceEn = row.provinceNameEn.toLowerCase().trim()

      const rowDistrictTh = row.districtName.toLowerCase().trim()
      // Find all sub-districts that match this province
      let matchingSubDistricts = refData.subDistricts.filter((subDistrict) => {
        const provinceTh = subDistrict.distrct.province.title.th.toLowerCase().trim()
        const provinceEn = subDistrict.distrct.province.title.en.toLowerCase().trim()

        return (
          (provinceTh === rowProvinceTh ||
            provinceTh.includes(rowProvinceTh) ||
            rowProvinceTh.includes(provinceTh) ||
            (rowProvinceEn &&
              (provinceEn === rowProvinceEn ||
                provinceEn.includes(rowProvinceEn) ||
                rowProvinceEn.includes(provinceEn)))) &&
          rowDistrictTh === subDistrict.distrct.title.th
        )
      })

      console.log(`MATCHED: ${rowProvinceTh}/${rowDistrictTh} ${matchingSubDistricts.length}`)

      // Remove excluded sub-districts based on exception notes
      const excludedSubDistricts = _helpers.parseExcludedSubDistricts(
        row.notes,
        matchingSubDistricts
      )
      if (excludedSubDistricts.length > 0) {
        const excludedCodes = new Set(excludedSubDistricts.map((s) => s.code))
        matchingSubDistricts = matchingSubDistricts.filter((s) => !excludedCodes.has(s.code))
      }

      if (matchingSubDistricts.length > 0) {
        // Limit to reasonable number of sub-districts per postal code
        const limitedSubDistricts = matchingSubDistricts.slice(0, 50)

        // Get or create zip code record
        let zipCode = zipCodeMap.get(row.postalCode)
        if (!zipCode) {
          zipCode = {
            code: row.postalCode,
            subDistricts: []
          }
          zipCodeMap.set(row.postalCode, zipCode)
        }

        // Add sub-districts that aren't already included
        for (const subDistrict of limitedSubDistricts) {
          if (!zipCode.subDistricts.some((existing) => existing.code === subDistrict.code)) {
            zipCode.subDistricts.push(subDistrict)
          }
        }

        const provinceName = limitedSubDistricts[0]?.distrct.province.title.th || 'Unknown'
        const excludedCount = excludedSubDistricts.length
        console.log(
          `📮 ${row.postalCode} -> ${zipCode.subDistricts.length} sub-districts in ${provinceName}${excludedCount > 0 ? ` (excluded ${excludedCount})` : ''}`
        )
      }

      // Process exceptions: add excluded sub-districts to their correct postal codes
      if (row.notes) {
        const exceptions = _helpers.parseExceptionsFromNotes(row.notes)
        for (const exception of exceptions) {
          const exceptionSubDistricts = this.findSubDistrictsByNames(
            exception.subDistrictNames,
            refData.subDistricts
          )

          if (exceptionSubDistricts.length > 0) {
            // Get or create zip code record for exception postal code
            let exceptionZipCode = zipCodeMap.get(exception.postalCode)
            if (!exceptionZipCode) {
              exceptionZipCode = {
                code: exception.postalCode,
                subDistricts: []
              }
              zipCodeMap.set(exception.postalCode, exceptionZipCode)
            }

            // Add exception sub-districts
            for (const subDistrict of exceptionSubDistricts) {
              if (
                !exceptionZipCode.subDistricts.some(
                  (existing) => existing.code === subDistrict.code
                )
              ) {
                exceptionZipCode.subDistricts.push(subDistrict)
              }
            }

            console.log(
              `📮 ${exception.postalCode} -> added ${exceptionSubDistricts.length} exception sub-districts from ${row.postalCode}`
            )
          }
        }
      }
    }

    const zipCodes = Array.from(zipCodeMap.values())

    console.log(`✅ Created ${zipCodes.length} postal code mappings from Wikipedia data`)

    return zipCodes
  }

  protected async parseHtmlContent(
    html: string,
    provinceLookup: Map<string, BoundProvince>
  ): Promise<WikiPostcodeRecord[]> {
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

      // Validate province on-the-fly using lookup map
      const lookupKey = provinceNameTh.toLowerCase().trim()
      const foundProvince = provinceLookup.get(lookupKey)
      if (!foundProvince) {
        throw new Error(
          `Province validation failed: Wikipedia province "${provinceNameTh}" does not match any Tumbon province: ${[...provinceLookup.keys()].join(', ')}`
        )
      }

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
                provinceNameTh: foundProvince.title.th,
                provinceNameEn: foundProvince.title.en,
                districtName: districtText,
                postalCode: postcode,
                notes: noteText
              })
            })
          }
        })
      }
    })

    return postcodeRecords
  }
}
