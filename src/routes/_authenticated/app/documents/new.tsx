import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { getDocumentMastersFn } from "@/server/documents/document.functions"
import {
  DOCUMENT_TARGET_VALUES,
  allowedDocumentTypes,
} from "@/server/documents/policy"
import type { DocumentTargetType } from "@/server/documents/policy"
import { documentCreateSearchSchema } from "@/server/documents/schemas"

export const Route = createFileRoute("/_authenticated/app/documents/new")({
  validateSearch: documentCreateSearchSchema,
  loader: () => getDocumentMastersFn(),
  component: NewDocumentPage,
})

function NewDocumentPage() {
  const masters = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const initialType = search.targetType ?? "TRIP"
  const [targetType, setTargetType] = useState<DocumentTargetType>(initialType)
  const [targetId, setTargetId] = useState(
    search.targetType === initialType ? (search.targetId ?? "") : ""
  )
  const records = masters[targetType]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Documents"
        title="Add document"
        description="Choose the business record first so access follows that record's permissions."
      />
      <Card>
        <CardHeader>
          <CardTitle>Related record</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="targetType">Record type</FieldLabel>
              <NativeSelect
                id="targetType"
                value={targetType}
                onChange={(event) => {
                  setTargetType(event.target.value as DocumentTargetType)
                  setTargetId("")
                }}
                className="w-full"
              >
                {DOCUMENT_TARGET_VALUES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type[0] + type.slice(1).toLowerCase()}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="targetId">Record</FieldLabel>
              <NativeSelect
                id="targetId"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="w-full"
              >
                <NativeSelectOption value="">
                  Select a record
                </NativeSelectOption>
                {records.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      {targetId ? (
        <DocumentUploadCard
          key={`${targetType}:${targetId}`}
          targetType={targetType}
          targetId={targetId}
          documentTypes={allowedDocumentTypes(targetType)}
          defaultDocumentType={
            search.targetType === targetType ? search.documentType : undefined
          }
          onUploaded={() =>
            router.navigate({
              to: "/app/documents",
              search: {
                search: "",
                documentType: "ALL",
                page: 1,
                pageSize: 20,
              },
            })
          }
        />
      ) : null}
    </div>
  )
}
