import type { RawSubDistrict, RawZipCode, RawProvince, RawDistrict } from '@types'

interface IParserTarget {
  ditPath: string
  files: {
    tumbon: string
    postcodes: string
  }
}

export interface IParserDataKeyGenerator {
  province: (provinceId: string, record: RawProvince) => string
  district: (proinceId: string, districtId: string, record: RawDistrict) => string
  subDistrict: (
    provinceId: string,
    districtId: string,
    subDistrictId: string,
    record: RawSubDistrict
  ) => string
}

export interface IParser {
  /**
   * Start parsing and look for the files
   */
  parse(target: IParserTarget): Promise<void>
}

export interface ITumbonParser {
  /**
   * parse the buffer content
   */
  parse(
    sourceStream: ReadableStream,
    keyGenerator: IParserDataKeyGenerator
  ): Promise<{
    provinces: Record<string, RawProvince>
    districts: Record<string, RawDistrict>
    subDistricts: Record<string, RawSubDistrict>
  }>
}

export interface IPostcodeParser {
  /**
   * parse the zip code
   */
  parse(
    sourceStream: ReadableStream,
    referenceData: {
      provinces: BoundProvince[]
      districts: BoundDistrict[]
      subDistricts: BoundSubDistrict[]
    }
  ): Promise<BoundZipCode[]>
}
