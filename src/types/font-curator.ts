export interface AvailableFontHandle {
  id: string
  familyName: string
  fullName: string
  postscriptName: string
  styleName: string
  searchableText: string
  handle: LocalFontData
}

export interface AvailableFontFamily {
  id: string
  familyName: string
  searchableText: string
  members: AvailableFontHandle[]
}

export interface VariableAxis {
  tag: string
  name: string
  min: number
  max: number
  defaultValue: number
}

export interface GlyphEntry {
  id: string
  codePoint: number
  character: string
  label: string
}

export interface LoadedFontMember {
  id: string
  postscriptName: string
  fullName: string
  styleName: string
  cssFamily: string
  searchableText: string
  isVariable: boolean
  axes: VariableAxis[]
  glyphs: GlyphEntry[]
  fontFace: FontFace
}

export interface CuratedFontFamily {
  id: string
  familyName: string
  members: LoadedFontMember[]
  previewMemberId: string
  sampleOverride: string
  tags: string[]
  variationValues: Record<string, number>
}

export interface PersistedCuratedFamily {
  familyName: string
  previewMemberPostscriptName: string
  sampleOverride: string
  tags: string[]
  variationValues: Record<string, number>
}

export interface PersistedLibrary {
  version: number
  globalSampleText: string
  knownTags: string[]
  curatedFamilies: PersistedCuratedFamily[]
}
