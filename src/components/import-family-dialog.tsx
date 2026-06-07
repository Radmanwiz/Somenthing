import { SearchIcon, TypeIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AvailableFontFamily } from "@/types/font-curator"

interface ImportFamilyDialogProps {
  candidates: AvailableFontFamily[]
  onImport: (familyName: string) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
  open: boolean
  query: string
  busy: boolean
}

export function ImportFamilyDialog({
  candidates,
  onImport,
  onOpenChange,
  onQueryChange,
  open,
  query,
  busy,
}: ImportFamilyDialogProps) {
  const hasQuery = query.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Add Installed Font Family</DialogTitle>
          <DialogDescription>
            Search by family, full font name, or PostScript name. Importing a match
            brings the full family into the web library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="family-search">Search installed fonts</FieldLabel>
              <FieldContent>
                <Input
                  id="family-search"
                  placeholder="SF Pro Display, Skia, Helvetica Neue…"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                />
                <FieldDescription>
                  Chromium browsers expose installed fonts here through the Local Font
                  Access API after permission is granted.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <ScrollArea className="h-[28rem] rounded-xl border bg-background/50">
            <div className="flex flex-col gap-3 p-3">
              {candidates.length > 0 ? (
                candidates.map((family) => (
                  <div
                    key={family.id}
                    role="button"
                    tabIndex={0}
                    className="group flex w-full items-start justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-left transition hover:border-primary/30 hover:bg-background"
                    onClick={() => onImport(family.familyName)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onImport(family.familyName)
                      }
                    }}
                    aria-disabled={busy}
                  >
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {family.familyName}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {family.members.slice(0, 4).map((member) => member.styleName).join(", ")}
                        {family.members.length > 4 ? "…" : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{family.members.length} styles</Badge>
                      <Button variant="outline" size="sm" disabled={busy}>
                        <SearchIcon data-icon="inline-start" />
                        Import
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty className="min-h-[20rem] border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>
                      {hasQuery ? "No installed family matched" : "Search your installed fonts"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {hasQuery
                        ? "Try a family name or a specific member name like Regular or Bold."
                        : "Type to search the fonts your browser exposed from this machine."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
