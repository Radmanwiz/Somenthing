import type {
  AvailableFontFamily,
  AvailableFontHandle,
  CuratedFontFamily,
  GlyphEntry,
  LoadedFontMember,
  PersistedCuratedFamily,
  VariableAxis,
} from "@/types/font-curator"

export const DEFAULT_SAMPLE_TEXT = "Something"

export function groupLocalFonts(fonts: LocalFontData[]): AvailableFontFamily[] {
  const grouped = new Map<string, AvailableFontHandle[]>()

  for (const font of fonts) {
    const familyName = font.family.trim() || font.fullName.trim()
    const handle: AvailableFontHandle = {
      id: `${familyName}::${font.postscriptName}`,
      familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      styleName: font.style || "Regular",
      searchableText: normalize(
        `${familyName} ${font.fullName} ${font.postscriptName} ${font.style}`
      ),
      handle: font,
    }

    const members = grouped.get(familyName) ?? []
    members.push(handle)
    grouped.set(familyName, members)
  }

  return [...grouped.entries()]
    .map(([familyName, members]) => ({
      id: familyName,
      familyName,
      searchableText: normalize(
        `${familyName} ${members
          .flatMap((member) => [
            member.fullName,
            member.postscriptName,
            member.styleName,
          ])
          .join(" ")}`
      ),
      members: members.sort(compareAvailableMembers),
    }))
    .sort((left, right) => left.familyName.localeCompare(right.familyName))
}

export function findBestFamily(
  query: string,
  families: AvailableFontFamily[]
): AvailableFontFamily | undefined {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) {
    return undefined
  }

  return (
    families.find((family) => normalize(family.familyName) === normalizedQuery) ??
    families.find((family) =>
      family.members.some(
        (member) =>
          normalize(member.postscriptName) === normalizedQuery ||
          normalize(member.fullName) === normalizedQuery ||
          normalize(member.styleName) === normalizedQuery
      )
    ) ??
    families.find((family) => family.searchableText.includes(normalizedQuery))
  )
}

export async function loadCuratedFamily(
  source: AvailableFontFamily,
  persisted?: PersistedCuratedFamily
): Promise<CuratedFontFamily> {
  const members = await Promise.all(
    source.members.map((member) => loadFontMember(member, source.familyName))
  )

  const previewMember =
    members.find(
      (member) => member.postscriptName === persisted?.previewMemberPostscriptName
    ) ??
    members.find((member) => member.isVariable) ??
    members[0]

  const defaultVariationValues = Object.fromEntries(
    (previewMember?.axes ?? []).map((axis) => [axis.tag, axis.defaultValue])
  )

  return {
    id: source.familyName,
    familyName: source.familyName,
    members,
    previewMemberId: previewMember?.id ?? "",
    sampleOverride: persisted?.sampleOverride ?? "",
    tags: uniqueSorted(persisted?.tags ?? []),
    variationValues: {
      ...defaultVariationValues,
      ...(persisted?.variationValues ?? {}),
    },
  }
}

export function buildVariationSettings(
  member: LoadedFontMember | undefined,
  variationValues: Record<string, number>
) {
  if (!member?.axes.length) {
    return undefined
  }

  return member.axes
    .map((axis) => `"${axis.tag}" ${variationValues[axis.tag] ?? axis.defaultValue}`)
    .join(", ")
}

export function resolveSampleText(
  family: CuratedFontFamily,
  globalSampleText: string
) {
  return family.sampleOverride.trim() || globalSampleText
}

function compareAvailableMembers(
  left: AvailableFontHandle,
  right: AvailableFontHandle
) {
  const leftScore = styleRanking(left.styleName, left.postscriptName)
  const rightScore = styleRanking(right.styleName, right.postscriptName)
  if (leftScore === rightScore) {
    return left.styleName.localeCompare(right.styleName)
  }

  return leftScore - rightScore
}

async function loadFontMember(
  source: AvailableFontHandle,
  familyName: string
): Promise<LoadedFontMember> {
  const blob = await source.handle.blob()
  const buffer = await blob.arrayBuffer()
  const { parse } = await import("opentype.js")
  const parsed = parse(buffer.slice(0))
  const cssFamily = `fc-${slugify(familyName)}-${slugify(source.postscriptName)}`
  const fontFace = new FontFace(cssFamily, buffer)
  await fontFace.load()
  document.fonts.add(fontFace)

  const fullName =
    localizedName(parsed.names.fullName) ||
    source.fullName ||
    source.postscriptName
  const styleName =
    localizedName(parsed.names.fontSubfamily) ||
    source.styleName ||
    "Regular"

  const axes = extractAxes(parsed.tables.fvar?.axes ?? [])

  return {
    id: source.postscriptName,
    postscriptName: source.postscriptName,
    fullName,
    styleName,
    cssFamily,
    searchableText: normalize(
      `${familyName} ${source.fullName} ${source.postscriptName} ${styleName}`
    ),
    isVariable: axes.length > 0,
    axes,
    glyphs: extractGlyphs(parsed),
    fontFace,
  }
}

function extractAxes(rawAxes: Array<Record<string, unknown>>): VariableAxis[] {
  return rawAxes
    .map((axis) => ({
      tag: String(axis.tag ?? "AXIS"),
      name: axisDisplayName(axis),
      min: Number(axis.minValue ?? 0),
      max: Number(axis.maxValue ?? 100),
      defaultValue: Number(axis.defaultValue ?? 0),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function axisDisplayName(axis: Record<string, unknown>) {
  const localized =
    typeof axis.name === "object" && axis.name
      ? localizedName(axis.name as Record<string, string>)
      : undefined

  return localized ?? String(axis.name ?? axis.tag ?? "Axis")
}

function extractGlyphs(parsedFont: { glyphs: { length: number; get(index: number): { unicodes: number[] } } }): GlyphEntry[] {
  const codePoints = new Set<number>()

  for (let index = 0; index < parsedFont.glyphs.length; index += 1) {
    const glyph = parsedFont.glyphs.get(index)
    for (const codePoint of glyph.unicodes ?? []) {
      if (isRenderableCodePoint(codePoint)) {
        codePoints.add(codePoint)
      }
    }
  }

  return [...codePoints]
    .sort((left, right) => left - right)
    .map((codePoint) => ({
      id: `${codePoint}`,
      codePoint,
      character: String.fromCodePoint(codePoint),
      label: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
    }))
}

function isRenderableCodePoint(codePoint: number) {
  const character = String.fromCodePoint(codePoint)
  if (!character.trim()) {
    return false
  }

  return !/[\p{C}\p{Zl}\p{Zp}]/u.test(character)
}

function localizedName(
  value: Record<string, string> | undefined
): string | undefined {
  if (!value) {
    return undefined
  }

  return (
    value.en ??
    value["en-US"] ??
    value.enUS ??
    Object.values(value)[0]
  )
}

function styleRanking(styleName: string, postscriptName: string) {
  const normalizedStyle = `${styleName} ${postscriptName}`.toLowerCase()
  if (normalizedStyle.includes("regular")) return 0
  if (normalizedStyle.includes("roman")) return 1
  if (normalizedStyle.includes("book")) return 2
  if (normalizedStyle.includes("medium")) return 3
  if (normalizedStyle.includes("variable")) return 4
  return 5
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  )
}
