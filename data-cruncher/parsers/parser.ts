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
import { BoundDistrict, BoundProvince, BoundSubDistrict } from '@types'

// Create default key generator
const keyScheme: IParserDataKeyGenerator = {
  province: (provinceId, _record) => provinceId,
  district: (provinceId, districtId, _record) => [provinceId, districtId].join('-'),
  subDistrict: (provinceId, districtId, subDistrictId, _record) =>
    [provinceId, districtId, subDistrictId].join('-')
}
const revertKeyScheme = {
  toProvinceKey: (anyKey: string) => anyKey.split('-')[0],
  toDistrictKey: (districtOrSubDistrictKey: string) => {
    const parts = districtOrSubDistrictKey.split('-')
    return `${parts[0]}-${parts[1]}`
  }
}

export class Parser implements IParser {
  public constructor(
    protected tumbon: ITumbonParser,
    protected postcode?: IPostcodeParser
  ) {}

  static create(): Parser {
    const tumbonParser = new TumbonFileParser()
    return new Parser(tumbonParser)
  }

  async parse(target: IParserTarget): Promise<void> {
    const boundedSubDistricts = await this.parseTumbon(target)
    // Parse postcode data
    const tumbonPath = join(target.ditPath, target.files.postcodes)
    const tumbonBuffer = await readFile(tumbonPath)
    const tumbonStream = new ReadableStream({
      start(controller) {
        controller.enqueue(tumbonBuffer)
        controller.close()
      }
    })
    // this.postcode?.parse(target ,boundedSubDistricts)
  }

  private async parseTumbon(target: IParserTarget): Promise<BoundSubDistrict[]> {
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

    // TODO: Parse postcode file when IPostcodeParser is implemented
    if (this.postcode) {
      console.log('📄 Processing postalcode.pdf...')
      // Implementation will be added when postcode parser is ready
    } else {
      console.log('⚠️  Postcode parser not implemented yet')
    }

    console.log('🔗 Data parsing completed!')

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
    return Object.values(subDistricts)
  }
}
