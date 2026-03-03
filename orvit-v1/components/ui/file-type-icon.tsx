'use client';

interface FileTypeIconProps {
  /** Filename (e.g. "report.pdf") or raw extension (e.g. "pdf") */
  name: string;
  /** Rendered size in pixels. Default: 28 */
  size?: number;
}

const BASE = '/icons/file-types';

function iconSrc(ext: string): string {
  if (ext === 'pdf')                                        return `${BASE}/pdf.svg`;
  if (ext === 'doc'  || ext === 'docx')                    return `${BASE}/docx.svg`;
  if (ext === 'xls'  || ext === 'xlsx')                    return `${BASE}/xlsx.svg`;
  if (ext === 'ppt'  || ext === 'pptx')                    return `${BASE}/pptx.svg`;
  if (['png','jpg','jpeg','gif','webp'].includes(ext))      return `${BASE}/img.svg`;
  if (ext === 'fig'  || ext === 'figma')                    return `${BASE}/figma.svg`;
  if (ext === 'zip'  || ext === 'rar' || ext === '7z')     return `${BASE}/zip.svg`;
  return `${BASE}/generic.svg`;
}

export function FileTypeIcon({ name, size = 28 }: FileTypeIconProps) {
  const ext = name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? '') : name.toLowerCase();
  const src = iconSrc(ext);

  return (
    <img
      src={src}
      alt={ext.toUpperCase()}
      width={size}
      height={size}
      style={{ flexShrink: 0, display: 'block' }}
      draggable={false}
    />
  );
}
