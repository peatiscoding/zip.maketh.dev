export interface EnTh {
  en: string
  th: string
}

export interface RawProvince {
  code: string
  title: EnTh
}

export interface RawDistrict {
  code: string
  title: EnTh
}

export interface RawSubDistrict {
  code: string
  title: EnTh
}

export interface RawZipCode {
  code: string
}

// When JavaScript interface has been bound to each other creat a complete searchable items.

export interface BoundProvince extends RawProvince {
  districts: BoundDistrict[]
}

export interface BoundDistrict extends RawDistrict {
  subDistricts: BoundSubDistrict[]
}

export interface BoundSubDistrict extends RawSubDistrict {
  zipCodes: BoundZipCode[]
}

export interface BoundZipCode extends RawZipCode {
  subDistricts: BoundSubDistrict[]
}
