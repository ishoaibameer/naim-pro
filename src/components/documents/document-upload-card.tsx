import { useEffect, useRef, useState } from "react"
import { IconCamera, IconFileUpload, IconRefresh } from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  DOCUMENT_TYPE_LABELS,
  allowedDocumentTypes,
} from "@/server/documents/policy"
import type {
  DocumentTargetType,
  DocumentType,
} from "@/server/documents/policy"

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf"

export function DocumentUploadCard({
  targetType,
  targetId,
  documentTypes,
  defaultDocumentType,
  title = "Add document",
  accept = ACCEPTED,
  onUploaded,
}: {
  targetType: DocumentTargetType
  targetId: string
  documentTypes?: readonly DocumentType[]
  defaultDocumentType?: DocumentType
  title?: string
  accept?: string
  onUploaded?: (result: {
    id: string
    versionNumber: number
  }) => void | Promise<void>
}) {
  const types = documentTypes ?? allowedDocumentTypes(targetType)
  const [documentType, setDocumentType] = useState<DocumentType>(
    defaultDocumentType && types.includes(defaultDocumentType)
      ? defaultDocumentType
      : types[0]
  )
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [progress, setProgress] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview("")
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function choose(selected?: File) {
    setError("")
    setProgress(0)
    setFile(selected ?? null)
  }

  async function upload(form: HTMLFormElement) {
    if (!file) {
      setError("Choose a photo or PDF first.")
      return
    }
    setPending(true)
    setError("")
    const formData = new FormData(form)
    formData.set("file", file)
    formData.set("targetType", targetType)
    formData.set("targetId", targetId)
    formData.set("documentType", documentType)
    try {
      const result = await new Promise<{
        id: string
        versionNumber: number
      }>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open("POST", "/api/documents/upload")
        request.upload.onprogress = (event) => {
          if (event.lengthComputable)
            setProgress(Math.round((event.loaded / event.total) * 100))
        }
        request.onload = () => {
          if (request.status >= 200 && request.status < 300)
            resolve(
              JSON.parse(request.responseText) as {
                id: string
                versionNumber: number
              }
            )
          else reject(new Error(request.responseText || "Upload failed."))
        }
        request.onerror = () =>
          reject(new Error("Upload failed. Check your connection and retry."))
        request.send(formData)
      })
      form.reset()
      setFile(null)
      setProgress(100)
      await onUploaded?.(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          JPEG, PNG, or WebP up to 10 MB; PDF up to 15 MB.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void upload(event.currentTarget)
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`document-type-${targetId}`}>
                Type
              </FieldLabel>
              <NativeSelect
                id={`document-type-${targetId}`}
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as DocumentType)
                }
                className="w-full"
                disabled={pending}
              >
                {types.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex flex-wrap gap-2">
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => choose(event.target.files?.[0])}
              />
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(event) => choose(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraRef.current?.click()}
                disabled={pending}
              >
                <IconCamera data-icon="inline-start" /> Take photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
              >
                <IconFileUpload data-icon="inline-start" /> Choose file
              </Button>
            </div>
            {file ? (
              <div className="border p-3 text-sm">
                <p className="font-medium break-all">{file.name}</p>
                <p className="text-muted-foreground">
                  {(file.size / 1_048_576).toFixed(2)} MB
                </p>
                {preview ? (
                  <img
                    src={preview}
                    alt="Selected upload preview"
                    className="mt-3 max-h-56 w-full object-contain"
                  />
                ) : null}
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor={`document-title-${targetId}`}>
                Title (optional)
              </FieldLabel>
              <Input
                id={`document-title-${targetId}`}
                name="title"
                maxLength={240}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`document-description-${targetId}`}>
                Description (optional)
              </FieldLabel>
              <Textarea
                id={`document-description-${targetId}`}
                name="description"
                maxLength={2000}
                disabled={pending}
              />
            </Field>
            {pending || progress > 0 ? (
              <div className="space-y-1" aria-live="polite">
                <div className="flex justify-between text-xs">
                  <span>Upload progress</span>
                  <span>{progress}%</span>
                </div>
                <progress
                  value={progress}
                  max={100}
                  className="h-2 w-full accent-primary"
                />
              </div>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Upload failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending || !file}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : error ? (
              <IconRefresh data-icon="inline-start" />
            ) : (
              <IconFileUpload data-icon="inline-start" />
            )}
            {error ? "Retry upload" : "Upload"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
