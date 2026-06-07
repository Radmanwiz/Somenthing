import {
  Suspense,
  lazy,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderPlusIcon,
  Grid3X3Icon,
  HeartIcon,
  LaptopMinimalCheckIcon,
  ListIcon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import {
  buildVariationSettings,
  DEFAULT_SAMPLE_TEXT,
  findBestFamily,
  groupLocalFonts,
  loadCuratedFamily,
  resolveSampleText,
} from "@/lib/font-curator"
import {
  loadPersistedLibrary,
  savePersistedLibrary,
  toPersistedFamily,
} from "@/lib/persistence"
import type {
  AvailableFontFamily,
  CuratedFontFamily,
  LoadedFontMember,
  PersistedCuratedFamily,
} from "@/types/font-curator"

const ImportFamilyDialog = lazy(() =>
  import("@/components/import-family-dialog").then((module) => ({
    default: module.ImportFamilyDialog,
  }))
)
const GlyphBrowserDialog = lazy(() =>
  import("@/components/glyph-browser-dialog").then((module) => ({
    default: module.GlyphBrowserDialog,
  }))
)

type ConnectionState = "idle" | "unsupported" | "connecting" | "connected" | "error"
type LibraryViewMode = "list" | "compact"
type SortMode = "name-asc" | "styles-desc"

const persistedLibrary = loadPersistedLibrary()

const DEMO_AVAILABLE_COUNT = 1243
const DEMO_TAGS = [
  ["Sans Serif", 586],
  ["Serif", 278],
  ["Display", 155],
  ["Monospace", 98],
  ["Variable", 465],
  ["Editorial", 132],
  ["UI", 210],
  ["Script", 67],
] as const
const DEMO_FAMILIES = [
  { name: "Manrope", styles: 12, variable: true, face: "font-demo-sans", favorite: true },
  { name: "Inter", styles: 18, variable: true, face: "font-demo-sans", favorite: false },
  { name: "Source Serif 4", styles: 12, variable: false, face: "font-demo-serif", favorite: false },
  { name: "Azeret Mono", styles: 7, variable: true, face: "font-demo-mono", favorite: false },
  { name: "Bricolage Grotesque", styles: 12, variable: false, face: "font-demo-grotesk", favorite: false },
  { name: "Clash Display", styles: 6, variable: false, face: "font-demo-display", favorite: false },
  { name: "Instrument Serif", styles: 14, variable: false, face: "font-demo-editorial", favorite: false },
] as const
const DEMO_MEMBERS = [
  ["Thin", "100", "Roman"],
  ["ExtraLight", "200", "Roman"],
  ["Light", "300", "Roman"],
  ["Regular", "400", "Roman"],
  ["Medium", "500", "Roman"],
  ["SemiBold", "600", "Roman"],
] as const

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    typeof window !== "undefined" && window.queryLocalFonts
      ? "idle"
      : "unsupported"
  )
  const [availableFamilies, setAvailableFamilies] = useState<AvailableFontFamily[]>([])
  const [curatedFamilies, setCuratedFamilies] = useState<CuratedFontFamily[]>([])
  const [knownTags, setKnownTags] = useState<string[]>(persistedLibrary.knownTags)
  const [globalSampleText, setGlobalSampleText] = useState(
    persistedLibrary.globalSampleText || DEFAULT_SAMPLE_TEXT
  )
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [librarySearch, setLibrarySearch] = useState("")
  const [sidebarSearch, setSidebarSearch] = useState("")
  const [connectError, setConnectError] = useState("")
  const [tagDraft, setTagDraft] = useState("")
  const [importQuery, setImportQuery] = useState("")
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [glyphDialogFamilyId, setGlyphDialogFamilyId] = useState<string | null>(null)
  const [didHydrateRuntimeFamilies, setDidHydrateRuntimeFamilies] = useState(false)
  const [viewMode, setViewMode] = useState<LibraryViewMode>("list")
  const [sortMode, setSortMode] = useState<SortMode>("name-asc")
  const [isPending, startTransition] = useTransition()

  const deferredSearch = useDeferredValue(librarySearch)
  const deferredSidebarSearch = useDeferredValue(sidebarSearch)

  const familySearchIndex = useMemo(() => {
    const nextIndex = new Map<string, string>()

    for (const family of curatedFamilies) {
      nextIndex.set(
        family.id,
        normalize(
          `${family.familyName} ${family.tags.join(" ")} ${family.members
            .map((member) => member.searchableText)
            .join(" ")} ${family.members.some((member) => member.isVariable) ? "variable" : ""}`
        )
      )
    }

    return nextIndex
  }, [curatedFamilies])

  const filteredFamilies = useMemo(() => {
    const normalizedSearch = normalize(deferredSearch)

    return curatedFamilies
      .filter((family) => {
        const matchesFilter =
          selectedFilter === "all" ||
          (selectedFilter === "__variable__" &&
            family.members.some((member) => member.isVariable)) ||
          family.tags.includes(selectedFilter)

        if (!matchesFilter) {
          return false
        }

        return normalizedSearch
          ? familySearchIndex.get(family.id)?.includes(normalizedSearch) ?? false
          : true
      })
      .sort((left, right) => {
        if (sortMode === "styles-desc") {
          if (right.members.length === left.members.length) {
            return left.familyName.localeCompare(right.familyName)
          }

          return right.members.length - left.members.length
        }

        return left.familyName.localeCompare(right.familyName)
      })
  }, [curatedFamilies, deferredSearch, familySearchIndex, selectedFilter, sortMode])

  const availableImportCandidates = useMemo(() => {
    const importedFamilyNames = new Set(curatedFamilies.map((family) => family.familyName))
    const normalizedImportQuery = normalize(importQuery)

    return availableFamilies
      .filter((family) => !importedFamilyNames.has(family.familyName))
      .filter((family) =>
        normalizedImportQuery
          ? family.searchableText.includes(normalizedImportQuery)
          : true
      )
      .slice(0, 40)
  }, [availableFamilies, curatedFamilies, importQuery])

  const visibleTags = useMemo(
    () => [...new Set(knownTags)].sort((left, right) => left.localeCompare(right)),
    [knownTags]
  )
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const family of curatedFamilies) {
      for (const tag of family.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }

    return counts
  }, [curatedFamilies])
  const persistedFamilies = useMemo<PersistedCuratedFamily[]>(
    () =>
      didHydrateRuntimeFamilies
        ? curatedFamilies.map(toPersistedFamily)
        : persistedLibrary.curatedFamilies,
    [curatedFamilies, didHydrateRuntimeFamilies]
  )
  const resolvedSelectedFamilyId =
    selectedFamilyId && filteredFamilies.some((family) => family.id === selectedFamilyId)
      ? selectedFamilyId
      : filteredFamilies[0]?.id ?? curatedFamilies[0]?.id ?? null
  const selectedFamily =
    curatedFamilies.find((family) => family.id === resolvedSelectedFamilyId) ??
    filteredFamilies[0] ??
    null
  const glyphFamily =
    curatedFamilies.find((family) => family.id === glyphDialogFamilyId) ?? null
  const sidebarFamilies = useMemo(() => {
    const normalizedSearch = normalize(deferredSidebarSearch)

    return curatedFamilies
      .filter((family) =>
        normalizedSearch
          ? normalize(family.familyName).includes(normalizedSearch)
          : true
      )
      .sort((left, right) => left.familyName.localeCompare(right.familyName))
  }, [curatedFamilies, deferredSidebarSearch])
  const isDemoMode = curatedFamilies.length === 0
  const displayAvailableCount =
    availableFamilies.length > 0 ? availableFamilies.length : DEMO_AVAILABLE_COUNT
  const displayFamilyCount = isDemoMode ? DEMO_AVAILABLE_COUNT : filteredFamilies.length

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      savePersistedLibrary({
        version: 2,
        curatedFamilies: persistedFamilies,
        knownTags: visibleTags,
        globalSampleText: globalSampleText.trim() || DEFAULT_SAMPLE_TEXT,
      })
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [globalSampleText, persistedFamilies, visibleTags])

  const connectInstalledFonts = async () => {
    if (!window.queryLocalFonts) {
      setConnectionState("unsupported")
      return
    }

    setConnectionState("connecting")
    setConnectError("")

    try {
      const handles = await window.queryLocalFonts()
      const groupedFamilies = groupLocalFonts(handles)
      setAvailableFamilies(groupedFamilies)

      const restoredFamilies = await Promise.all(
        persistedFamilies.map(async (persistedFamily) => {
          const match = groupedFamilies.find(
            (family) =>
              normalize(family.familyName) === normalize(persistedFamily.familyName)
          )

          return match ? loadCuratedFamily(match, persistedFamily) : null
        })
      )

      const nextFamilies = restoredFamilies.filter(
        (family): family is CuratedFontFamily => Boolean(family)
      )

      startTransition(() => {
        setCuratedFamilies(nextFamilies)
        setSelectedFamilyId(nextFamilies[0]?.id ?? null)
      })

      setDidHydrateRuntimeFamilies(true)
      setConnectionState("connected")
    } catch (error) {
      setConnectionState("error")
      setConnectError(
        error instanceof Error
          ? error.message
          : "The browser denied access to installed fonts."
      )
    }
  }

  const importFamily = async (familyName: string) => {
    const match = findBestFamily(familyName, availableImportCandidates)
    if (!match) {
      return
    }

    const imported = await loadCuratedFamily(match)
    startTransition(() => {
      setCuratedFamilies((currentFamilies) => {
        const withoutDuplicate = currentFamilies.filter(
          (family) => family.familyName !== imported.familyName
        )
        return [...withoutDuplicate, imported].sort((left, right) =>
          left.familyName.localeCompare(right.familyName)
        )
      })
      setSelectedFamilyId(imported.id)
    })
    setImportDialogOpen(false)
    setImportQuery("")
  }

  const updateFamily = (
    familyId: string,
    updater: (family: CuratedFontFamily) => CuratedFontFamily
  ) => {
    setCuratedFamilies((currentFamilies) =>
      currentFamilies.map((family) =>
        family.id === familyId ? updater(family) : family
      )
    )
  }

  const createTag = () => {
    const trimmed = tagDraft.trim()
    if (!trimmed) {
      return
    }

    if (!knownTags.includes(trimmed)) {
      setKnownTags((currentTags) =>
        [...currentTags, trimmed].sort((left, right) => left.localeCompare(right))
      )
    }

    if (selectedFamily) {
      updateFamily(selectedFamily.id, (family) => ({
        ...family,
        tags: uniqueSorted([...family.tags, trimmed]),
      }))
    }

    setTagDraft("")
  }

  const removeFamily = (familyId: string) => {
    setCuratedFamilies((currentFamilies) =>
      currentFamilies.filter((family) => family.id !== familyId)
    )
    if (glyphDialogFamilyId === familyId) {
      setGlyphDialogFamilyId(null)
    }
  }

  const deleteTag = (tag: string) => {
    setKnownTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag))
    setCuratedFamilies((currentFamilies) =>
      currentFamilies.map((family) => ({
        ...family,
        tags: family.tags.filter((currentTag) => currentTag !== tag),
      }))
    )
    if (selectedFilter === tag) {
      setSelectedFilter("all")
    }
  }

  const buildFamilyVariationSettings = (family: CuratedFontFamily, member?: LoadedFontMember) =>
    buildVariationSettings(member ?? previewMember(family), family.variationValues)

  return (
    <div className="font-panel-page">
      <div className="font-browser-shell">
        <header className="font-browser-topbar">
          <div className="font-window-controls">
            <span className="font-window-dot bg-[#ff5f57]" />
            <span className="font-window-dot bg-[#febc2e]" />
            <span className="font-window-dot bg-[#28c840]" />
          </div>

          <div className="font-browser-nav">
            <button type="button" className="font-icon-button" aria-label="Back">
              <ChevronLeftIcon className="size-4" />
            </button>
            <button type="button" className="font-icon-button" aria-label="Forward">
              <ChevronRightIcon className="size-4" />
            </button>
          </div>

          <div className="font-address-pill">
            <span className="font-address-lock" />
            <span>fontcurate.app</span>
          </div>

          <div className="font-browser-actions">
            <button type="button" className="font-icon-button" aria-label="Refresh">
              <RefreshCwIcon className="size-4" />
            </button>
            <button type="button" className="font-icon-button" aria-label="Add">
              <PlusIcon className="size-4" />
            </button>
            <button type="button" className="font-icon-button" aria-label="More">
              <MoreVerticalIcon className="size-4" />
            </button>
          </div>
        </header>

        <div className="font-app-panel">
          <aside className="font-sidebar glass-panel">
            <div className="font-sidebar-brand">
              <div className="font-brand-mark">F</div>
              <div className="space-y-1">
                <p className="font-sidebar-label">Library</p>
                <h1 className="text-lg font-medium tracking-tight">Font Studio</h1>
              </div>
            </div>

            <SidebarSection title="Library">
              <SidebarNavButton
                active={selectedFilter === "all"}
                label="All Fonts"
                icon={<FolderIcon className="size-4" />}
                count={isDemoMode ? DEMO_AVAILABLE_COUNT : curatedFamilies.length}
                onClick={() => setSelectedFilter("all")}
              />
              <SidebarNavButton
                active={false}
                label="Favorites"
                icon={<HeartIcon className="size-4" />}
                count={24}
                onClick={() => {}}
                disabled={!isDemoMode}
              />
              <SidebarNavButton
                active={false}
                label="Recently Used"
                icon={<ClockIcon className="size-4" />}
                count={36}
                onClick={() => {}}
                disabled={!isDemoMode}
              />
            </SidebarSection>

            <SidebarSection
              title="Tags"
              action={
                isDemoMode ? (
                  <button type="button" className="font-section-action" aria-label="Add tag">
                    <PlusIcon className="size-4" />
                  </button>
                ) : visibleTags.length > 0 ? (
                  <button
                    type="button"
                    className="font-section-action"
                    onClick={() => setSelectedFilter("all")}
                  >
                    Reset
                  </button>
                ) : null
              }
            >
              {isDemoMode ? (
                <div className="space-y-2">
                  {DEMO_TAGS.map(([tag, count]) => (
                    <button
                      key={tag}
                      type="button"
                      className={`font-tag-filter ${
                        tag === "Variable" ? "font-tag-filter-active" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <TagIcon className="size-4" />
                        {tag}
                      </span>
                      <span className="font-count-pill">{count}</span>
                    </button>
                  ))}
                </div>
              ) : visibleTags.length > 0 ? (
                <div className="space-y-2">
                  {visibleTags.map((tag) => (
                    <div key={tag} className="font-tag-row">
                      <button
                        type="button"
                        className={`font-tag-filter ${
                          selectedFilter === tag ? "font-tag-filter-active" : ""
                        }`}
                        onClick={() => setSelectedFilter(tag)}
                      >
                        <span className="flex items-center gap-2">
                          <TagIcon className="size-4" />
                          {tag}
                        </span>
                        <span className="font-count-pill">
                          {tagCounts.get(tag) ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="font-minimal-icon"
                        aria-label={`Delete ${tag}`}
                        onClick={() => deleteTag(tag)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="font-empty-sidebar">
                  Create tags in the detail panel to build your own categories.
                </div>
              )}
            </SidebarSection>

            <SidebarSection title="Families">
              <Input
                value={sidebarSearch}
                onChange={(event) => setSidebarSearch(event.target.value)}
                placeholder="Search families"
                className="h-9 rounded-xl border-white/60 bg-white/75"
              />
              <ScrollArea className="h-[18rem]">
                <div className="mt-3 space-y-1 pr-3">
                  {sidebarFamilies.length > 0 ? (
                    sidebarFamilies.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        className={`font-family-link ${
                          resolvedSelectedFamilyId === family.id
                            ? "font-family-link-active"
                            : ""
                        }`}
                        onClick={() => setSelectedFamilyId(family.id)}
                      >
                        {family.familyName}
                      </button>
                    ))
                  ) : isDemoMode ? (
                    DEMO_FAMILIES.map((family) => (
                      <button
                        key={family.name}
                        type="button"
                        className={`font-family-link ${
                          family.name === "Manrope" ? "font-family-link-active" : ""
                        }`}
                      >
                        {family.name}
                      </button>
                    ))
                  ) : (
                    <div className="font-empty-sidebar">No imported families yet.</div>
                  )}
                </div>
              </ScrollArea>
            </SidebarSection>
          </aside>

          <main className="min-w-0">
            <section className="font-toolbar glass-panel">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() =>
                    connectionState === "connected"
                      ? setImportDialogOpen(true)
                      : connectInstalledFonts()
                  }
                  disabled={connectionState === "connecting"}
                  className="rounded-2xl bg-white/80 text-primary shadow-none hover:bg-white"
                  variant="outline"
                >
                  <DownloadIcon data-icon="inline-start" />
                  {connectionState === "connected"
                    ? "Add Installed Family"
                    : connectionState === "connecting"
                      ? "Connecting…"
                      : "Connect Installed Fonts"}
                </Button>
              </div>

              <div className="flex min-w-[20rem] flex-1 items-center gap-3">
                <label className="text-sm text-muted-foreground">Sample text</label>
                <Input
                  value={globalSampleText}
                  onChange={(event) => setGlobalSampleText(event.target.value)}
                  placeholder="Something"
                  className="h-12 rounded-2xl border-white/70 bg-white/80 text-xl shadow-none"
                />
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-2 font-medium">
                  <span className={`font-status-dot font-status-${connectionState}`} />
                  {statusLabel(connectionState, displayAvailableCount)}
                </span>
                <button
                  type="button"
                  className="font-icon-button"
                  aria-label="Refresh installed fonts"
                  onClick={connectInstalledFonts}
                  disabled={connectionState === "connecting"}
                >
                  <RefreshCwIcon className="size-4" />
                </button>
              </div>
            </section>

            {connectError ? (
              <section className="mb-4 rounded-[1.3rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {connectError}
              </section>
            ) : null}

            <section className="font-center-panel glass-panel">
              <div className="font-panel-header">
                <div>
                  <h2 className="text-[1.55rem] font-medium tracking-tight">
                    {displayFamilyCount.toLocaleString()} families
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-view-toggle">
                    <button
                      type="button"
                      className={viewMode === "list" ? "font-view-toggle-active" : ""}
                      onClick={() => setViewMode("list")}
                      aria-label="List view"
                    >
                      <ListIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={viewMode === "compact" ? "font-view-toggle-active" : ""}
                      onClick={() => setViewMode("compact")}
                      aria-label="Compact view"
                    >
                      <Grid3X3Icon className="size-4" />
                    </button>
                  </div>

                  <label className="font-select-wrap">
                    <span className="sr-only">Sort families</span>
                    <select
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as SortMode)}
                      className="font-select"
                    >
                      <option value="name-asc">A → Z</option>
                      <option value="styles-desc">Most Styles</option>
                    </select>
                  </label>

                  <div className="relative min-w-[16rem]">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={librarySearch}
                      onChange={(event) => setLibrarySearch(event.target.value)}
                      placeholder="Search families, tags, members…"
                      className="h-11 rounded-2xl border-white/60 bg-white/78 pl-9 shadow-none"
                    />
                  </div>
                </div>
              </div>

              {isDemoMode ? (
                <DemoFamilyListPanel
                  globalSampleText={globalSampleText}
                  viewMode={viewMode}
                />
              ) : (
                <FamilyListPanel
                  connectionState={connectionState}
                  families={filteredFamilies}
                  globalSampleText={globalSampleText}
                  onOpenGlyphs={setGlyphDialogFamilyId}
                  onRemoveFamily={removeFamily}
                  onSelectFamily={setSelectedFamilyId}
                  selectedFamilyId={resolvedSelectedFamilyId}
                  viewMode={viewMode}
                  buildVariationSettings={buildFamilyVariationSettings}
                />
              )}
            </section>
          </main>

          <aside className="font-detail-panel glass-panel">
            {isDemoMode ? (
              <DemoFamilyDetailPanel
                sampleText={globalSampleText}
              />
            ) : (
              <FamilyDetailPanel
                family={selectedFamily}
                globalSampleText={globalSampleText}
                knownTags={visibleTags}
                onCreateTag={createTag}
                onOpenGlyphs={setGlyphDialogFamilyId}
                onPreviewMemberChange={(memberId) => {
                  if (!selectedFamily) {
                    return
                  }

                  updateFamily(selectedFamily.id, (family) => ({
                    ...family,
                    previewMemberId: memberId,
                  }))
                }}
                onSampleOverrideChange={(sampleOverride) => {
                  if (!selectedFamily) {
                    return
                  }

                  updateFamily(selectedFamily.id, (family) => ({
                    ...family,
                    sampleOverride,
                  }))
                }}
                onTagDraftChange={setTagDraft}
                onTagSelectionChange={(nextTags) => {
                  if (!selectedFamily) {
                    return
                  }

                  updateFamily(selectedFamily.id, (family) => ({
                    ...family,
                    tags: uniqueSorted(nextTags),
                  }))
                }}
                onVariationChange={(axisTag, nextValue) => {
                  if (!selectedFamily) {
                    return
                  }

                  updateFamily(selectedFamily.id, (family) => ({
                    ...family,
                    variationValues: {
                      ...family.variationValues,
                      [axisTag]: nextValue,
                    },
                  }))
                }}
                tagDraft={tagDraft}
                buildVariationSettings={buildFamilyVariationSettings}
              />
            )}
          </aside>
        </div>
      </div>

      <Suspense fallback={null}>
        {importDialogOpen ? (
          <ImportFamilyDialog
            busy={isPending}
            candidates={availableImportCandidates}
            onImport={importFamily}
            onOpenChange={setImportDialogOpen}
            onQueryChange={setImportQuery}
            open={importDialogOpen}
            query={importQuery}
          />
        ) : null}

        {glyphDialogFamilyId ? (
          <GlyphBrowserDialog
            family={glyphFamily ?? undefined}
            open={Boolean(glyphDialogFamilyId)}
            onOpenChange={(open) => {
              if (!open) {
                setGlyphDialogFamilyId(null)
              }
            }}
            onPreviewMemberChange={(memberId) => {
              if (!glyphFamily) {
                return
              }

              updateFamily(glyphFamily.id, (family) => ({
                ...family,
                previewMemberId: memberId,
              }))
            }}
            onVariationChange={(axisTag, nextValue) => {
              if (!glyphFamily) {
                return
              }

              updateFamily(glyphFamily.id, (family) => ({
                ...family,
                variationValues: {
                  ...family.variationValues,
                  [axisTag]: nextValue,
                },
              }))
            }}
            sampleText={glyphFamily ? resolveSampleText(glyphFamily, globalSampleText) : globalSampleText}
            variationValues={glyphFamily?.variationValues ?? {}}
            buildVariationSettings={(member) =>
              glyphFamily ? buildFamilyVariationSettings(glyphFamily, member) : undefined
            }
          />
        ) : null}
      </Suspense>
    </div>
  )
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-sidebar-label">{title}</p>
        {action}
      </div>
      {children}
    </section>
  )
}

function SidebarNavButton({
  active,
  count,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean
  count: number
  disabled?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`font-side-nav ${active ? "font-side-nav-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      <span className="font-count-pill">{count}</span>
    </button>
  )
}

function DemoFamilyListPanel({
  globalSampleText,
  viewMode,
}: {
  globalSampleText: string
  viewMode: LibraryViewMode
}) {
  return (
    <ScrollArea className="h-[calc(100vh-19rem)] min-h-[36rem]">
      <div className="pr-3">
        {DEMO_FAMILIES.map((family) => {
          const selected = family.name === "Manrope"
          return (
            <div
              key={family.name}
              className={`demo-family-row ${selected ? "demo-family-row-selected" : ""} ${
                viewMode === "compact" ? "demo-family-row-compact" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  {family.variable ? <Badge variant="outline">Variable</Badge> : null}
                  <span className="truncate text-sm text-foreground">{family.name}</span>
                </div>
                <div className={`demo-row-specimen ${family.face}`}>
                  {family.name === "Clash Display" ? "Clascthing" : globalSampleText}
                </div>
              </div>

              <div className="demo-family-meta">
                <span>{family.styles} styles</span>
                {family.variable ? <span>Variable</span> : <span />}
                <StarIcon
                  className={`size-5 ${
                    family.favorite ? "fill-primary text-primary" : "text-muted-foreground"
                  }`}
                />
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function DemoFamilyDetailPanel({
  sampleText,
}: {
  sampleText: string
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate text-2xl font-medium">Manrope</h2>
          <Badge variant="outline">Variable</Badge>
        </div>
        <div className="flex items-center gap-3">
          <StarIcon className="size-5 fill-primary text-primary" />
          <button type="button" className="font-minimal-icon" aria-label="More">
            <MoreVerticalIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <section className="font-detail-surface">
          <div className="font-detail-specimen font-demo-sans">{sampleText}</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" className="rounded-xl bg-white/72 shadow-none">
              <Grid3X3Icon data-icon="inline-start" />
              Glyphs
            </Button>
            <Button variant="outline" className="rounded-xl bg-white/72 shadow-none">
              <ExternalLinkIcon data-icon="inline-start" />
              View in detail
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-sidebar-label">Family Members</p>
            <span className="text-sm text-muted-foreground">12 styles</span>
          </div>

          <div className="font-members-table">
            {DEMO_MEMBERS.map(([name, weight, style], index) => (
              <button
                key={name}
                type="button"
                className={`font-member-row ${
                  name === "Regular" ? "font-member-row-active" : ""
                } ${index === 0 ? "rounded-t-[1.1rem]" : ""} ${
                  index === DEMO_MEMBERS.length - 1 ? "rounded-b-[1.1rem]" : ""
                }`}
              >
                <span className="font-medium text-foreground">{name}</span>
                <span className="text-muted-foreground">{weight}</span>
                <span className="text-muted-foreground">{style}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-sidebar-label">Variable Axis</p>
            <span className="text-sm text-muted-foreground">2 axes</span>
          </div>

          <DemoAxis tag="wght" label="Weight" value={400} min={100} max={800} />
          <DemoAxis tag="wdth" label="Width" value={100} min={75} max={125} />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Changes apply to the preview above
            <span className="font-info-dot">i</span>
          </div>
        </section>
      </div>
    </div>
  )
}

function DemoAxis({
  tag,
  label,
  value,
  min,
  max,
}: {
  tag: string
  label: string
  value: number
  min: number
  max: number
}) {
  return (
    <div className="font-axis-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{tag}</Badge>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="rounded-lg border border-border/70 bg-white/85 px-3 py-1.5 text-sm font-medium">
          {value}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span className="w-8 text-sm text-muted-foreground">{min}</span>
        <Slider value={[value]} min={min} max={max} step={1} />
        <span className="w-8 text-right text-sm text-muted-foreground">{max}</span>
      </div>
    </div>
  )
}

function FamilyListPanel({
  connectionState,
  families,
  globalSampleText,
  onOpenGlyphs,
  onRemoveFamily,
  onSelectFamily,
  selectedFamilyId,
  viewMode,
  buildVariationSettings,
}: {
  connectionState: ConnectionState
  families: CuratedFontFamily[]
  globalSampleText: string
  onOpenGlyphs: (familyId: string) => void
  onRemoveFamily: (familyId: string) => void
  onSelectFamily: (familyId: string) => void
  selectedFamilyId: string | null
  viewMode: LibraryViewMode
  buildVariationSettings: (
    family: CuratedFontFamily,
    member?: LoadedFontMember
  ) => string | undefined
}) {
  if (connectionState === "unsupported") {
    return (
      <div className="font-empty-state">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircleIcon />
            </EmptyMedia>
            <EmptyTitle>Local font access is not available here</EmptyTitle>
            <EmptyDescription>
              Use a Chromium-based browser on `localhost` or a secure origin to grant
              installed font access.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  if (connectionState !== "connected") {
    return (
      <div className="font-empty-state">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LaptopMinimalCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Connect your installed fonts</EmptyTitle>
            <EmptyDescription>
              The web app only sees local families after the browser grants Local Font
              Access permission.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  if (families.length === 0) {
    return (
      <div className="font-empty-state">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderPlusIcon />
            </EmptyMedia>
            <EmptyTitle>No curated families yet</EmptyTitle>
            <EmptyDescription>
              Import a family from your installed fonts to start building this panel.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-19rem)] min-h-[36rem]">
      <div className="space-y-3 pr-3">
        {families.map((family) => {
          const member = previewMember(family)
          const sampleText = resolveSampleText(family, globalSampleText)
          const isSelected = family.id === selectedFamilyId

          return (
            <div
              key={family.id}
              role="button"
              tabIndex={0}
              className={`family-row ${isSelected ? "family-row-selected" : ""} ${
                viewMode === "compact" ? "family-row-compact" : ""
              }`}
              onClick={() => onSelectFamily(family.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelectFamily(family.id)
                }
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {member?.isVariable ? <Badge variant="outline">Variable</Badge> : null}
                    <span className="truncate text-base font-medium text-foreground">
                      {family.familyName}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {family.members.length} styles
                    {member?.isVariable ? " · Variable" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {family.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                  <StarIcon
                    className={`size-4 ${
                      isSelected ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <ChevronRightIcon className="size-4" />
                </div>
              </div>

              <div
                className={`font-specimen-card ${
                  viewMode === "compact" ? "font-specimen-card-compact" : ""
                }`}
                style={{
                  fontFamily: member?.cssFamily,
                  fontVariationSettings: buildVariationSettings(family, member),
                }}
              >
                {sampleText}
              </div>

              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-5">
                  <span>{member?.styleName ?? "Regular"}</span>
                  <span>{family.members.length} styles</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenGlyphs(family.id)
                    }}
                  >
                    <Grid3X3Icon data-icon="inline-start" />
                    Glyphs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemoveFamily(family.id)
                    }}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function FamilyDetailPanel({
  family,
  globalSampleText,
  knownTags,
  onCreateTag,
  onOpenGlyphs,
  onPreviewMemberChange,
  onSampleOverrideChange,
  onTagDraftChange,
  onTagSelectionChange,
  onVariationChange,
  tagDraft,
  buildVariationSettings,
}: {
  family: CuratedFontFamily | null
  globalSampleText: string
  knownTags: string[]
  onCreateTag: () => void
  onOpenGlyphs: (familyId: string) => void
  onPreviewMemberChange: (memberId: string) => void
  onSampleOverrideChange: (sampleOverride: string) => void
  onTagDraftChange: (value: string) => void
  onTagSelectionChange: (nextTags: string[]) => void
  onVariationChange: (axisTag: string, nextValue: number) => void
  tagDraft: string
  buildVariationSettings: (
    family: CuratedFontFamily,
    member?: LoadedFontMember
  ) => string | undefined
}) {
  if (!family) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TypeIcon />
            </EmptyMedia>
            <EmptyTitle>Select a family</EmptyTitle>
            <EmptyDescription>
              Choose an imported family to inspect its specimen, members, tags, and
              variable axes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const member = previewMember(family)
  const sampleText = resolveSampleText(family, globalSampleText)

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-[1.9rem] font-medium tracking-tight">
              {family.familyName}
            </h2>
            {member?.isVariable ? <Badge variant="outline">Variable</Badge> : null}
          </div>
          <button type="button" className="font-minimal-icon" aria-label="More">
            <MoreVerticalIcon className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {family.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <section className="font-detail-surface">
          <div
            className="font-detail-specimen"
            style={{
              fontFamily: member?.cssFamily,
              fontVariationSettings: buildVariationSettings(family, member),
            }}
          >
            {sampleText}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="rounded-2xl bg-white/72 shadow-none hover:bg-white"
              onClick={() => onOpenGlyphs(family.id)}
            >
              <Grid3X3Icon data-icon="inline-start" />
              Glyphs
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl bg-white/72 shadow-none hover:bg-white"
              onClick={() => onPreviewMemberChange(member?.id ?? family.previewMemberId)}
            >
              <TypeIcon data-icon="inline-start" />
              View in detail
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-sidebar-label">Family Members</p>
            <span className="text-sm text-muted-foreground">
              {family.members.length} styles
            </span>
          </div>

          <div className="font-members-table">
            {family.members.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`font-member-row ${
                  item.id === family.previewMemberId ? "font-member-row-active" : ""
                } ${index === 0 ? "rounded-t-[1.1rem]" : ""} ${
                  index === family.members.length - 1 ? "rounded-b-[1.1rem]" : ""
                }`}
                onClick={() => onPreviewMemberChange(item.id)}
              >
                <span className="font-medium text-foreground">{item.styleName}</span>
                <span className="text-muted-foreground">
                  {styleWeightGuess(item.styleName)}
                </span>
                <span className="text-muted-foreground">
                  {item.isVariable ? "Variable" : "Roman"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {member?.axes.length ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-sidebar-label">Variable Axis</p>
              <span className="text-sm text-muted-foreground">
                {member.axes.length} axes
              </span>
            </div>

            <div className="space-y-4">
              {member.axes.map((axis) => (
                <div key={axis.tag} className="font-axis-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{axis.tag}</Badge>
                      <span className="text-sm text-muted-foreground">{axis.name}</span>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-white/85 px-3 py-1.5 text-sm font-medium">
                      {(family.variationValues[axis.tag] ?? axis.defaultValue).toFixed(0)}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <Slider
                      value={[family.variationValues[axis.tag] ?? axis.defaultValue]}
                      min={axis.min}
                      max={axis.max}
                      step={0.1}
                      onValueChange={(nextValue) =>
                        onVariationChange(
                          axis.tag,
                          Array.isArray(nextValue)
                            ? (nextValue[0] ?? axis.defaultValue)
                            : nextValue
                        )
                      }
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{axis.min.toFixed(0)}</span>
                      <span>{axis.max.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-sidebar-label">Tags</p>
            <span className="text-sm text-muted-foreground">
              {family.tags.length} assigned
            </span>
          </div>

          <div className="flex gap-3">
            <Input
              value={tagDraft}
              onChange={(event) => onTagDraftChange(event.target.value)}
              placeholder="Editorial, grotesk, UI…"
              className="h-10 rounded-xl border-white/60 bg-white/76"
            />
            <Button onClick={onCreateTag} className="rounded-xl">
              Create
            </Button>
          </div>

          {knownTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {knownTags.map((tag) => {
                const active = family.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`font-chip-button ${active ? "font-chip-button-active" : ""}`}
                    onClick={() =>
                      onTagSelectionChange(
                        active
                          ? family.tags.filter((currentTag) => currentTag !== tag)
                          : [...family.tags, tag]
                      )
                    }
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="font-empty-sidebar">
              No tags yet. Create one above to organize this family.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <p className="font-sidebar-label">Per-family Sample Override</p>
          <textarea
            value={family.sampleOverride}
            onChange={(event) => onSampleOverrideChange(event.target.value)}
            placeholder="Leave blank to inherit Something"
            className="min-h-24 w-full resize-none rounded-[1.1rem] border border-border/70 bg-white/74 px-4 py-3 text-sm shadow-none outline-none"
          />
        </section>
      </div>
    </div>
  )
}

function previewMember(family: CuratedFontFamily) {
  return (
    family.members.find((member) => member.id === family.previewMemberId) ??
    family.members[0]
  )
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

function statusLabel(state: ConnectionState, availableCount: number) {
  if (state === "connected") {
    return `${availableCount.toLocaleString()} fonts available`
  }

  if (state === "connecting") {
    return "Requesting permission"
  }

  if (state === "unsupported") {
    return "Unsupported browser"
  }

  if (state === "error") {
    return "Permission failed"
  }

  return "Waiting to connect"
}

function styleWeightGuess(styleName: string) {
  const normalized = styleName.toLowerCase()
  if (normalized.includes("thin")) return "100"
  if (normalized.includes("extra light") || normalized.includes("extralight")) return "200"
  if (normalized.includes("light")) return "300"
  if (normalized.includes("regular") || normalized.includes("roman")) return "400"
  if (normalized.includes("medium")) return "500"
  if (normalized.includes("semi") || normalized.includes("demi")) return "600"
  if (normalized.includes("bold")) return "700"
  if (normalized.includes("extra bold") || normalized.includes("extrabold")) return "800"
  if (normalized.includes("black")) return "900"
  return "400"
}

export default App
