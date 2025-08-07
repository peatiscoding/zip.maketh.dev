import type { RawDistrict, RawProvince, RawSubDistrict } from '@types'
import type { ITumbonParser, IParserDataKeyGenerator } from './interface'
import * as XLSX from 'xlsx'
import { AbstractParser } from './base'

interface ExcelRow {
  CH_ID: number
  CHANGWAT_T: string
  CHANGWAT_E: string
  AM_ID: number
  AMPHOE_E: string
  TA_ID: number
  TAMBON_T: string
  TAMBON_E: string
  LAT: number
  LONG: number
  AD_LEVEL?: number
}

export class TumbonFileParser extends AbstractParser implements ITumbonParser {
  async parse(
    sourceStream: ReadableStream,
    keyGenerator: IParserDataKeyGenerator
  ): Promise<{
    provinces: Record<string, RawProvince>
    districts: Record<string, RawDistrict>
    subDistricts: Record<string, RawSubDistrict>
  }> {
    const buffer = await this.streamToBuffer(sourceStream)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Read the first worksheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      throw new Error('No worksheets found in the Excel file')
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet)

    return this.processHierarchicalData(data, keyGenerator)
  }

  private processHierarchicalData(
    data: ExcelRow[],
    keyGenerator: IParserDataKeyGenerator
  ): {
    provinces: Record<string, RawProvince>
    districts: Record<string, RawDistrict>
    subDistricts: Record<string, RawSubDistrict>
  } {
    const provinces: Record<string, RawProvince> = {}
    const districts: Record<string, RawDistrict> = {}
    const subDistricts: Record<string, RawSubDistrict> = {}

    // Track duplicate sub-districts only
    const subDistrictDuplicates = new Set<string>()

    for (const row of data) {
      // Process Province (CHANGWAT)
      const province: RawProvince = {
        code: row.CH_ID.toString(),
        title: {
          th: row.CHANGWAT_T,
          en: row.CHANGWAT_E
        }
      }
      const provinceKey = keyGenerator.province(row.CH_ID.toString(), province)
      province.code = provinceKey
      if (!provinces[provinceKey]) {
        provinces[provinceKey] = province
      }

      // Process District (AMPHOE)
      const district: RawDistrict = {
        code: row.AM_ID.toString(),
        title: {
          th: row.AMPHOE_E, // Only English name available
          en: row.AMPHOE_E
        }
      }
      const districtKey = keyGenerator.district(
        row.CH_ID.toString(),
        row.AM_ID.toString(),
        district
      )
      district.code = districtKey
      if (!districts[districtKey]) {
        districts[districtKey] = district
      }

      // Process Sub-District (TAMBON)
      const subDistrict: RawSubDistrict = {
        code: row.TA_ID.toString(),
        title: {
          th: row.TAMBON_T,
          en: row.TAMBON_E
        }
      }
      const subDistrictKey = keyGenerator.subDistrict(
        row.CH_ID.toString(),
        row.AM_ID.toString(),
        row.TA_ID.toString(),
        subDistrict
      )
      subDistrict.code = subDistrictKey
      if (!subDistricts[subDistrictKey]) {
        subDistricts[subDistrictKey] = subDistrict
      } else {
        subDistrictDuplicates.add(subDistrictKey)
      }
    }

    // Report sub-district duplicates only
    if (subDistrictDuplicates.size > 0) {
      console.log(`⚠️  Found ${subDistrictDuplicates.size} duplicate sub-district entries:`)
      console.log(
        `   Duplicated sub-district keys: ${Array.from(subDistrictDuplicates).slice(0, 10).join(', ')}${subDistrictDuplicates.size > 10 ? '...' : ''}`
      )
    }

    return {
      provinces,
      districts,
      subDistricts
    }
  }
}
