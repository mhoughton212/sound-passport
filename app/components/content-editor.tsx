"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import defaultContent from "../data/content.json";
import { Genre } from "../lib/music";

type Content = typeof defaultContent;
type ContentKey = keyof Content;
type GenreField = "name" | "description";
type EditTarget =
  | { kind: "content"; key: ContentKey; value: string }
  | { kind: "genre"; id: string; field: GenreField; value: string; label: string }
  | { kind: "example-note"; genreId: string; index: number; value: string; label: string };

type EditorContextValue = {
  available: boolean;
  editing: boolean;
  copy: Content;
  resolveGenre: (genre: Genre) => Genre;
  toggleEditing: () => void;
  editContent: (key: ContentKey) => void;
  editGenre: (genre: Genre, field: GenreField) => void;
  editExampleNote: (genreId: string, index: number, note: string) => void;
};

const development = process.env.NODE_ENV === "development";

const EditorContext = createContext<EditorContextValue | null>(null);

export function ContentEditorProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [copy, setCopy] = useState<Content>(defaultContent);
  const [genreOverrides, setGenreOverrides] = useState<Record<string, Partial<Record<GenreField, string>>>>({});
  const [exampleNotes, setExampleNotes] = useState<Record<string, string>>({});
  const [activeEdit, setActiveEdit] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeEdit) inputRef.current?.focus();
  }, [activeEdit]);

  const resolveGenre = useCallback((genre: Genre) => {
    const override = genreOverrides[genre.id];
    return {
      ...genre,
      ...override,
      examples: genre.examples.map((example) => ({
        ...example,
        note: exampleNotes[`${genre.id}:${example.index}`] ?? example.note,
      })),
    };
  }, [exampleNotes, genreOverrides]);

  function openEditor(target: EditTarget) {
    if (!development || !editing) return;
    setActiveEdit(target);
    setDraft(target.value);
    setStatus("idle");
  }

  const value: EditorContextValue = {
    available: development,
    editing: development && editing,
    copy,
    resolveGenre,
    toggleEditing: () => {
      setEditing((current) => !current);
      setActiveEdit(null);
    },
    editContent: (key) => openEditor({ kind: "content", key, value: copy[key] }),
    editGenre: (genre, field) => openEditor({ kind: "genre", id: genre.id, field, value: genre[field], label: `${genre.spotifyName}.${field}` }),
    editExampleNote: (genreId, index, note) => openEditor({ kind: "example-note", genreId, index, value: note, label: `${genreId}.example-${index + 1}.note` }),
  };

  async function save() {
    if (!activeEdit || !draft.trim()) return;
    setStatus("saving");
    try {
      const response = await fetch("/__sound-passport/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeEdit, value: draft }),
      });
      if (!response.ok) throw new Error("Save failed");

      const nextValue = draft.trim();
      if (activeEdit.kind === "content") {
        setCopy((current) => ({ ...current, [activeEdit.key]: nextValue }));
      } else if (activeEdit.kind === "genre") {
        setGenreOverrides((current) => ({
          ...current,
          [activeEdit.id]: { ...current[activeEdit.id], [activeEdit.field]: nextValue },
        }));
      } else {
        setExampleNotes((current) => ({ ...current, [`${activeEdit.genreId}:${activeEdit.index}`]: nextValue }));
      }

      setStatus("saved");
      window.setTimeout(() => setActiveEdit(null), 450);
    } catch {
      setStatus("error");
    }
  }

  return (
    <EditorContext.Provider value={value}>
      {children}
      {development && editing && <div className="edit-mode-note">Click highlighted text to edit.</div>}
      {development && activeEdit && (
        <div className="copy-editor" role="dialog" aria-label="Edit text">
          <div>
            <small>{activeEdit.kind === "content" ? activeEdit.key : activeEdit.label}</small>
            <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") setActiveEdit(null); }} />
          </div>
          <button className="save-copy" onClick={save} disabled={status === "saving"}>{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}</button>
          <button onClick={() => setActiveEdit(null)}>Cancel</button>
          {status === "error" && <p>Could not save this change.</p>}
        </div>
      )}
    </EditorContext.Provider>
  );
}

export function useContentEditor() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useContentEditor must be used inside ContentEditorProvider");
  return context;
}

export function EditableContent({ contentKey, className }: { contentKey: ContentKey; className?: string }) {
  const editor = useContentEditor();
  const edit = () => editor.editContent(contentKey);
  return <span className={`${className ?? ""} ${editor.editing ? "editable-copy" : ""}`.trim()} role={editor.editing ? "button" : undefined} tabIndex={editor.editing ? 0 : undefined} onClick={editor.editing ? (event) => { event.preventDefault(); event.stopPropagation(); edit(); } : undefined} onKeyDown={editor.editing ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); edit(); } } : undefined}>{editor.copy[contentKey]}</span>;
}

export function EditableGenre({ genre, field, className }: { genre: Genre; field: GenreField; className?: string }) {
  const editor = useContentEditor();
  const edit = () => editor.editGenre(genre, field);
  return <span className={`${className ?? ""} ${editor.editing ? "editable-copy" : ""}`.trim()} role={editor.editing ? "button" : undefined} tabIndex={editor.editing ? 0 : undefined} onClick={editor.editing ? (event) => { event.preventDefault(); event.stopPropagation(); edit(); } : undefined} onKeyDown={editor.editing ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); edit(); } } : undefined}>{genre[field]}</span>;
}

export function EditableExampleNote({ genreId, index, note }: { genreId: string; index: number; note: string }) {
  const editor = useContentEditor();
  const edit = () => editor.editExampleNote(genreId, index, note);
  return <span className={`example-note ${editor.editing ? "editable-copy" : ""}`.trim()} role={editor.editing ? "button" : undefined} tabIndex={editor.editing ? 0 : undefined} onClick={editor.editing ? (event) => { event.preventDefault(); event.stopPropagation(); edit(); } : undefined} onKeyDown={editor.editing ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); edit(); } } : undefined}>{note}</span>;
}
