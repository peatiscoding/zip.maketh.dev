import type { BoundDistrict, BoundProvince, BoundSubDistrict, BoundZipCode } from '@types'
import type {
  IParser,
  IParserTarget,
  IPostcodeParser,
  ITumbonParser,
  IParserDataKeyGenerator
} from './interface'

import { mapValues } from 'lodash'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { TumbonFileParser } from './tumbon'
import { WikiHtmlPostcodeParser } from './wiki-html-postcode'

const ID_SEP = '-'

// Create default key generator
const keyScheme: IParserDataKeyGenerator = {
  province: (provinceId, _record) => provinceId,
  district: (provinceId, districtId, _record) => [provinceId, districtId].join(ID_SEP),
  subDistrict: (provinceId, districtId, subDistrictId, _record) =>
    [provinceId, districtId, subDistrictId].join(ID_SEP)
}
const revertKeyScheme = {
  toProvinceKey: (anyKey: string) => anyKey.split(ID_SEP)[0],
  toDistrictKey: (districtOrSubDistrictKey: string) => {
    const parts = districtOrSubDistrictKey.split(ID_SEP)
    return `${parts[0]}-${parts[1]}`
  }
}

export class Parser implements IParser {
  public constructor(
    protected tumbon: ITumbonParser,
    protected postcode: IPostcodeParser
  ) {}

  static create(): Parser {
    const tumbonParser = new TumbonFileParser()
    const postcodeParser = new WikiHtmlPostcodeParser()
    return new Parser(tumbonParser, postcodeParser)
  }

  async parse(target: IParserTarget): Promise<void> {
    const { boundedSubDistricts, boundedDistricts, boundedProvinces } =
      await this.parseTumbon(target)
    await this.parsePostCodes(target, {
      provinces: boundedProvinces,
      districts: boundedDistricts,
      subDistricts: boundedSubDistricts
    })
  }

  private async parsePostCodes(
    target: IParserTarget,
    referenceData: {
      provinces: BoundProvince[]
      districts: BoundDistrict[]
      subDistricts: BoundSubDistrict[]
    }
  ): Promise<void> {
    const emptyStream = new ReadableStream({
      start(controller) {
        controller.close()
      }
    })

    let zipCodes: BoundZipCode[] = []

    zipCodes = await this.postcode.parse(emptyStream, referenceData)

    // Bind zip codes to sub-districts
    for (const zipCode of zipCodes) {
      for (const subDistrict of zipCode.subDistricts) {
        subDistrict.zipCodes.push(zipCode)
      }
    }

    console.log(`✅ Processed ${zipCodes.length} postal codes`)
  }

  private async parseTumbon(target: IParserTarget): Promise<{
    boundedSubDistricts: BoundSubDistrict[]
    boundedDistricts: BoundDistrict[]
    boundedProvinces: BoundProvince[]
  }> {
    console.log('🔄 Starting data parsing...')

    // Parse Tumbon file
    console.log('📊 Processing tumbon.xlsx...')
    const tumbonPath = join(target.ditPath, target.files.tumbon)
    const tumbonBuffer = await readFile(tumbonPath)
    const tumbonStream = new ReadableStream({
      start(controller) {
        controller.enqueue(tumbonBuffer)
        controller.close()
      }
    })

    const tumbonData = await this.tumbon.parse(tumbonStream, keyScheme)

    console.log(`✅ Parsed ${Object.keys(tumbonData.provinces).length} provinces`)
    console.log(`✅ Parsed ${Object.keys(tumbonData.districts).length} districts`)
    console.log(`✅ Parsed ${Object.keys(tumbonData.subDistricts).length} sub-districts`)

    console.log('🔗 Tumbon parsing completed!')

    // prepare 'bounded' buffer
    const provinces: Record<string, BoundProvince> = mapValues(
      tumbonData.provinces,
      (o): BoundProvince => ({
        ...o,
        districts: []
      })
    )
    const districts: Record<string, BoundDistrict> = mapValues(
      tumbonData.districts,
      (o): BoundDistrict => {
        const targetKey = revertKeyScheme.toProvinceKey(o.code)
        const r: BoundDistrict = {
          ...o,
          province: provinces[targetKey],
          subDistricts: []
        }
        provinces[targetKey].districts.push(r)
        return r
      }
    )
    const subDistricts: Record<string, BoundSubDistrict> = mapValues(
      tumbonData.subDistricts,
      (o): BoundSubDistrict => {
        const targetKey = revertKeyScheme.toDistrictKey(o.code)
        const r: BoundSubDistrict = {
          ...o,
          distrct: districts[targetKey],
          zipCodes: []
        }

        districts[targetKey].subDistricts.push(r)
        return r
      }
    )
    return {
      boundedSubDistricts: Object.values(subDistricts),
      boundedDistricts: Object.values(districts),
      boundedProvinces: Object.values(provinces)
    }
  }
}
