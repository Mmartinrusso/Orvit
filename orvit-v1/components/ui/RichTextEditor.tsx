'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Escribe aquí... Puedes pegar imágenes con Ctrl+V o Cmd+V',
  className = ''
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    
    // Verificar si hay imágenes en el portapapeles
    const items = Array.from(clipboardData.items);
    const imageItem = items.find(item => item.type.indexOf('image') !== -1);
    
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        await uploadAndInsertImage(file);
        return;
      }
    }
    
    // Si no hay imagen, pegar texto normal
    const text = clipboardData.getData('text/plain');
    if (text) {
      document.execCommand('insertText', false, text);
      handleInput();
    }
  };

  const uploadAndInsertImage = async (file: File) => {
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Solo se pueden pegar imágenes',
        variant: 'destructive'
      });
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen es demasiado grande. Máximo 5MB',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Convertir a base64 para insertar directamente
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        
        // Insertar imagen en el editor
        if (editorRef.current) {
          const selection = window.getSelection();
          const range = selection?.getRangeAt(0);
          
          const img = document.createElement('img');
          img.src = imageUrl;
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.display = 'block';
          img.style.margin = '10px 0';
          img.style.borderRadius = '4px';
          
          if (range) {
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          } else {
            editorRef.current.appendChild(img);
          }
          
          handleInput();
          
          toast({
            title: 'Imagen insertada',
            description: 'La imagen se ha insertado correctamente'
          });
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error al insertar imagen:', error);
      toast({
        title: 'Error',
        description: 'No se pudo insertar la imagen',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAndInsertImage(file);
    }
    // Limpiar el input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className={`border rounded-lg ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className="h-8 w-8 p-0"
          title="Negrita (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          className="h-8 w-8 p-0"
          title="Cursiva (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          className="h-8 w-8 p-0"
          title="Subrayado (Ctrl+U)"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className="h-8 w-8 p-0"
          title="Lista con viñetas"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className="h-8 w-8 p-0"
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 p-0"
          title="Insertar imagen"
          disabled={isUploading}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[300px] p-4 focus:outline-none prose prose-sm max-w-none dark:prose-invert rich-text-editor text-sm"
        style={{
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          fontSize: '0.875rem',
          lineHeight: '1.25rem'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .rich-text-editor[data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .rich-text-editor img {
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
          margin: 10px 0 !important;
          border-radius: 4px !important;
        }
        .rich-text-editor p {
          margin: 0.5em 0;
        }
        .rich-text-editor ul, .rich-text-editor ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
      `}} />
      
    </div>
  );
}

