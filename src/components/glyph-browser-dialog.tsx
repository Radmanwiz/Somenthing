import { VariableIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CuratedFontFamily, LoadedFontMember, VariableAxis } from "@/types/font-curator"

interface GlyphBrowserDialogProps {
  family: CuratedFontFamily | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onPreviewMemberChange: (memberId: string) => void
  onVariationChange: (axisTag: string, nextValue: number) => void
  sampleText: string
  variationValues: Record<string, number>
  buildVariationSettings: (member: LoadedFontMember | undefined) => string | undefined
}

export function GlyphBrowserDialog({
  family,
  open,
  onOpenChange,
  onPreviewMemberChange,
  onVariationChange,
  sampleText,
  variationValues,
  buildVariationSettings,
}: GlyphBrowserDialogProps) {
  const selectedMember =
    family?.members.find((member) => member.id === family.previewMemberId) ??
    family?.members[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            {selectedMember?.isVariable ? (
              <Badge variant="outline">Variable</Badge>
            ) : null}
            {family?.familyName ?? "Glyph Browser"}
          </DialogTitle>
          <DialogDescription>
            Inspect every mapped glyph for the selected style and preview variable
            axes directly in the browser.
          </DialogDescription>
        </DialogHeader>

        {family && selectedMember ? (
          <div className="grid min-h-[42rem] gap-0 lg:grid-cols-[22rem_1fr]">
            <div className="border-b px-6 py-5 lg:border-r lg:border-b-0">
              <FieldGroup>
                <Field>
                  <FieldLabel>Style</FieldLabel>
                  <FieldContent>
                    <Select
                      value={selectedMember.id}
                      onValueChange={(nextValue) => onPreviewMemberChange(String(nextValue))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {family.members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.styleName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>Specimen</FieldLabel>
                  <FieldContent>
                    <div
                      className="rounded-2xl border border-border/60 bg-background/80 px-4 py-5 text-3xl tracking-tight text-foreground"
                      style={{
                        fontFamily: selectedMember.cssFamily,
                        fontVariationSettings: buildVariationSettings(selectedMember),
                      }}
                    >
                      {sampleText}
                    </div>
                  </FieldContent>
                </Field>

                {selectedMember.axes.length > 0 ? (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-4">
                      {selectedMember.axes.map((axis) => (
                        <AxisEditor
                          key={axis.tag}
                          axis={axis}
                          value={variationValues[axis.tag] ?? axis.defaultValue}
                          onValueChange={onVariationChange}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </FieldGroup>
            </div>

            <ScrollArea className="h-[42rem]">
              <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
                {selectedMember.glyphs.map((glyph) => (
                  <div
                    key={glyph.id}
                    className="flex min-h-32 flex-col justify-between rounded-2xl border border-border/70 bg-background/80 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{glyph.label}</Badge>
                      {selectedMember.isVariable ? (
                        <VariableIcon className="size-4 text-muted-foreground" />
                      ) : null}
                    </div>

                    <div
                      className="flex flex-1 items-center justify-center text-5xl text-foreground"
                      style={{
                        fontFamily: selectedMember.cssFamily,
                        fontVariationSettings: buildVariationSettings(selectedMember),
                      }}
                    >
                      {glyph.character}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex min-h-[26rem] items-center justify-center px-6 py-10 text-sm text-muted-foreground">
            Select a family to inspect its glyph set.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AxisEditor({
  axis,
  value,
  onValueChange,
}: {
  axis: VariableAxis
  value: number
  onValueChange: (axisTag: string, nextValue: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{axis.tag}</Badge>
          <span className="text-sm font-medium text-foreground">{axis.name}</span>
        </div>
        <span className="text-sm text-muted-foreground">{value.toFixed(1)}</span>
      </div>

      <Slider
        value={[value]}
        min={axis.min}
        max={axis.max}
        step={0.1}
        onValueChange={(next) =>
          onValueChange(
            axis.tag,
            Array.isArray(next) ? (next[0] ?? axis.defaultValue) : next
          )
        }
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{axis.min.toFixed(1)}</span>
        <span>Default {axis.defaultValue.toFixed(1)}</span>
        <span>{axis.max.toFixed(1)}</span>
      </div>
    </div>
  )
}
