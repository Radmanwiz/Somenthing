import type {
  CuratedFontFamily,
  PersistedCuratedFamily,
  PersistedLibrary,
} from "@/types/font-curator"

const STORAGE_KEY = "font-curator-web:v2"
const DEFAULT_SAMPLE_TEXT = "Something"

export function loadPersistedLibrary(): PersistedLibrary {
  if (typeof window === "undefined") {
    return emptyLibrary()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return emptyLibrary()
    }

    const parsed = JSON.parse(raw) as Partial<PersistedLibrary>
    return {
      version: 2,
      globalSampleText:
        parsed.globalSampleText?.trim() || DEFAULT_SAMPLE_TEXT,
      knownTags: uniqueSorted(parsed.knownTags ?? []),
      curatedFamilies: (parsed.curatedFamilies ?? []).map((family) => ({
        familyName: family.familyName ?? "",
        previewMemberPostscriptName: family.previewMemberPostscriptName ?? "",
        sampleOverride: family.sampleOverride ?? "",
        tags: uniqueSorted(family.tags ?? []),
        variationValues: family.variationValues ?? {},
      })),
    }
  } catch {
    return emptyLibrary()
  }
}

export function savePersistedLibrary(library: PersistedLibrary) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
}

export function toPersistedFamily(
  family: CuratedFontFamily
): PersistedCuratedFamily {
  const previewMember =
    family.members.find((member) => member.id === family.previewMemberId) ??
    family.members[0]

  return {
    familyName: family.familyName,
    previewMemberPostscriptName: previewMember?.postscriptName ?? "",
    sampleOverride: family.sampleOverride,
    tags: uniqueSorted(family.tags),
    variationValues: family.variationValues,
  }
}

function emptyLibrary(): PersistedLibrary {
  return {
    version: 2,
    globalSampleText: DEFAULT_SAMPLE_TEXT,
    knownTags: [],
    curatedFamilies: [],
  }
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  )
}
