import { DocumentDetailShell } from "@/components/dokumen/document-detail-shell";
import { DocumentDetailSkeleton } from "@/components/dokumen/document-detail-skeleton";

export default function DokumenDetailLoading() {
  return <DocumentDetailShell><DocumentDetailSkeleton /></DocumentDetailShell>;
}
