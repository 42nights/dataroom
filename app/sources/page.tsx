import { AppShell } from "@/components/AppShell";
import { FileDropZone } from "@/components/FileDropZone";
import { SourceList } from "@/components/SourceList";

export default function SourcesPage() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <header className="mb-8">
          <h1 className="font-serif text-3xl tracking-tight">Sources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every file you've dropped into the data room. Upload more to broaden
            what the assistant can answer.
          </p>
        </header>

        <FileDropZone />

        <div className="mt-10">
          <SourceList />
        </div>
      </div>
    </AppShell>
  );
}
