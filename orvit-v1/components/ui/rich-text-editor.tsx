'use client';

import React, { useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ImageIcon,
  Undo,
  Redo,
  Heading2,
  Quote,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
}

const MenuBar = ({
  editor,
  onImageClick,
  disabled
}: {
  editor: Editor | null;
  onImageClick: () => void;
  disabled?: boolean;
}) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-muted")}
        title="Negrita"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-muted")}
        title="Cursiva"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={disabled}
        className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 2 }) && "bg-muted")}
        title="Título"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={disabled}
        className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-muted")}
        title="Lista"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={disabled}
        className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-muted")}
        title="Lista numerada"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={disabled}
        className={cn("h-8 w-8 p-0", editor.isActive('blockquote') && "bg-muted")}
        title="Cita"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={disabled}
        title="Línea horizontal"
        className="h-8 w-8 p-0"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onImageClick}
        disabled={disabled}
        className="h-8 w-8 p-0"
        title="Insertar imagen"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={disabled || !editor.can().chain().focus().undo().run()}
        className="h-8 w-8 p-0"
        title="Deshacer"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={disabled || !editor.can().chain().focus().redo().run()}
        className="h-8 w-8 p-0"
        title="Rehacer"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
};

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Escribe aquí...',
  className,
  minHeight = '150px',
  disabled = false,
  onImageUpload
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto my-2'
        }
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty'
      })
    ],
    content,
    editable: !disabled,
    immediatelyRender: false, // Fix SSR hydration issue
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none p-3',
          'prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1',
          'prose-ul:my-1 prose-ol:my-1 prose-li:my-0',
          'prose-blockquote:my-2 prose-hr:my-3'
        ),
        style: `min-height: ${minHeight}`
      }
    }
  });

  const handleImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    try {
      let imageUrl: string;

      if (onImageUpload) {
        // Usar la función de upload proporcionada (para S3, etc.)
        imageUrl = await onImageUpload(file);
      } else {
        // Convertir a base64 por defecto
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      editor.chain().focus().setImage({ src: imageUrl }).run();
    } catch (error) {
      console.error('Error al insertar imagen:', error);
      alert('Error al insertar la imagen');
    }

    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor, onImageUpload]);

  return (
    <div className={cn(
      "border rounded-md overflow-hidden bg-background",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <MenuBar editor={editor} onImageClick={handleImageClick} disabled={disabled} />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .ProseMirror {
          outline: none;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }

        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          margin: 0.5rem 0;
        }

        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .ProseMirror blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
        }

        .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1rem 0;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
        }

        .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .ProseMirror h3 {
          font-size: 1.1rem;
          font-weight: 600;
        }
      ` }} />
    </div>
  );
}

export default RichTextEditor;
