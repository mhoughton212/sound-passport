import AppShell from "./components/app-shell";
import { ContentEditorProvider } from "./components/content-editor";
import { LibraryProvider } from "./components/library-context";
import { CatalogProvider } from "./components/catalog-context";

export default function Home() {
  return <ContentEditorProvider><CatalogProvider><LibraryProvider><AppShell /></LibraryProvider></CatalogProvider></ContentEditorProvider>;
}
