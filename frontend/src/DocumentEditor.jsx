import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Check,
  FileText,
  Save,
  Pencil,
} from "lucide-react";
import "./DocumentEditor.css";

function DocumentEditor({ document, onBack, onTitleChange }) {
  const storageKey = `collab-doc-${document.id}`;

  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [, setEditorVersion] = useState(0);
  const [renaming, setRenaming] = useState(false);

  const [title, setTitle] = useState(() => {
    try {
      return (
        localStorage.getItem(`${storageKey}-title`) ||
        document.title ||
        "Untitled Document"
      );
    } catch {
      return document.title || "Untitled Document";
    }
  });

  const editor = useEditor({
    extensions: [StarterKit],

    content: (() => {
      try {
        return (
          localStorage.getItem(storageKey) ||
          "<p>Start writing your ideas here...</p>"
        );
      } catch {
        return "<p>Start writing your ideas here...</p>";
      }
    })(),

    editorProps: {
      attributes: {
        class: "tiptap-content",
        spellcheck: "true",
      },
    },

    onUpdate: ({ editor }) => {
      try {
        localStorage.setItem(storageKey, editor.getHTML());
        setSaveStatus("Unsaved changes");
      } catch {
        setSaveStatus("Unable to save locally");
      }

      setEditorVersion((version) => version + 1);
    },

    onSelectionUpdate: () => {
      setEditorVersion((version) => version + 1);
    },

    onTransaction: () => {
      setEditorVersion((version) => version + 1);
    },
  });

  const updateTitle = (value) => {
    setTitle(value);
    onTitleChange?.(value);

    try {
      localStorage.setItem(`${storageKey}-title`, value);
      setSaveStatus("Unsaved changes");
    } catch {
      setSaveStatus("Unable to save locally");
    }
  };

  const saveDocument = () => {
    try {
      const finalTitle = title.trim() || "Untitled Document";

      setTitle(finalTitle);
      localStorage.setItem(`${storageKey}-title`, finalTitle);

      if (editor) {
        localStorage.setItem(storageKey, editor.getHTML());
      }

      onTitleChange?.(finalTitle);
      setSaveStatus("All changes saved");
    } catch {
      setSaveStatus("Unable to save locally");
    }
  };

  const handleBack = () => {
    saveDocument();
    onBack?.();
  };

  if (!editor) {
    return <p>Loading editor...</p>;
  }

  const wordCount = editor
    .getText()
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const characterCount = editor.getText().length;

  const toolButton = (label, active, action, icon, disabled = false) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`editor-tool ${active ? "tool-active" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
    </button>
  );

  return (
    <div className="editor-page">
      <header className="editor-topbar">
        <button
          type="button"
          className="back-button"
          onClick={handleBack}
        >
          <ArrowLeft size={18} />
          <span>Workspace</span>
        </button>

        <div className="editor-document-label">
          <FileText size={18} />
          <span>Document editor</span>
        </div>

        <div className="editor-topbar-actions">
          <div className="editor-save-status">
            <Check size={15} />
            <span>{saveStatus}</span>
          </div>

          <button
            type="button"
            className="save-document-button"
            onClick={saveDocument}
          >
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
      </header>

      <main className="editor-main">
        <div className="editor-title-row">
          <div className="editor-title-controls">
            <input
              className="document-title-input"
              value={title}
              readOnly={!renaming}
              onChange={(event) => updateTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setRenaming(false);
                  saveDocument();
                }

                if (event.key === "Escape") {
                  setRenaming(false);
                  setTitle(
                    localStorage.getItem(`${storageKey}-title`) ||
                      document.title ||
                      "Untitled Document"
                  );
                }
              }}
              placeholder="Untitled Document"
              aria-label="Document title"
            />

            <button
              type="button"
              className="rename-document-button"
              onClick={() => {
                if (renaming) {
                  setRenaming(false);
                  saveDocument();
                } else {
                  setRenaming(true);
                }
              }}
            >
              <Pencil size={15} />
              <span>{renaming ? "Done" : "Rename"}</span>
            </button>
          </div>

          <span className="document-type-label">
            <FileText size={14} />
            Document
          </span>
        </div>

        <div className="editor-paper">
          <div className="editor-toolbar">
            {toolButton(
              "Bold",
              editor.isActive("bold"),
              () => editor.chain().focus().toggleBold().run(),
              <Bold size={17} />
            )}

            {toolButton(
              "Italic",
              editor.isActive("italic"),
              () => editor.chain().focus().toggleItalic().run(),
              <Italic size={17} />
            )}

            <span className="toolbar-divider" />

            {toolButton(
              "Heading 1",
              editor.isActive("heading", { level: 1 }),
              () =>
                editor.chain().focus().toggleHeading({ level: 1 }).run(),
              <Heading1 size={18} />
            )}

            {toolButton(
              "Heading 2",
              editor.isActive("heading", { level: 2 }),
              () =>
                editor.chain().focus().toggleHeading({ level: 2 }).run(),
              <Heading2 size={18} />
            )}

            <span className="toolbar-divider" />

            {toolButton(
              "Bullet list",
              editor.isActive("bulletList"),
              () => editor.chain().focus().toggleBulletList().run(),
              <List size={18} />
            )}

            {toolButton(
              "Numbered list",
              editor.isActive("orderedList"),
              () => editor.chain().focus().toggleOrderedList().run(),
              <ListOrdered size={18} />
            )}

            {toolButton(
              "Quote",
              editor.isActive("blockquote"),
              () => editor.chain().focus().toggleBlockquote().run(),
              <Quote size={17} />
            )}

            <span className="toolbar-divider" />

            {toolButton(
              "Undo",
              false,
              () => editor.chain().focus().undo().run(),
              <Undo2 size={17} />,
              !editor.can().undo()
            )}

            {toolButton(
              "Redo",
              false,
              () => editor.chain().focus().redo().run(),
              <Redo2 size={17} />,
              !editor.can().redo()
            )}
          </div>

          <EditorContent editor={editor} />
        </div>

        <div className="editor-stats">
          <span>{wordCount} words</span>
          <span>{characterCount} characters</span>
        </div>

        <p className="editor-footer-note">
          Your document is saved in this browser. Use Save to save your latest
          changes, or Workspace to return to your documents.
        </p>
      </main>
    </div>
  );
}

export default DocumentEditor;