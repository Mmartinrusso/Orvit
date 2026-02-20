import React from 'react';
import { Settings, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NodeCardProps = {
  title: string;
  subtitle: "Máquina" | "Parte" | "Módulo";
  icon?: "gear" | "layers";
  showDot?: boolean;
  size?: "root" | "child";
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function NodeCard({
  title,
  subtitle,
  icon,
  showDot = false,
  size = "child",
  selected = false,
  onClick,
  className
}: NodeCardProps) {
  // Determinar el ícono por defecto según el subtítulo
  const defaultIcon = subtitle === "Módulo" ? "layers" : "gear";
  const iconType = icon || defaultIcon;
  
  const IconComponent = iconType === "layers" ? Layers : Settings;
  const iconSize = size === "root" ? "h-5 w-5" : "h-4 w-4";
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-background",
        "border border-border/60",
        "rounded-2xl",
        "shadow-[0_6px_18px_rgba(15,23,42,0.08)]",
        "hover:shadow-[0_10px_26px_rgba(15,23,42,0.12)]",
        "transition-all duration-200",
        "cursor-pointer select-none",
        "flex flex-col items-center justify-center",
        size === "root" ? "w-[220px] h-[80px] px-4 py-3" : "w-[190px] h-[76px] px-4 py-3",
        selected && "ring-2 ring-foreground/10 border-foreground/20 bg-muted/20",
        className
      )}
      title={title}
    >
      {/* Punto negro opcional */}
      {showDot && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-foreground/80" />
      )}
      
      {/* Ícono centrado arriba */}
      <div className={cn("mb-1.5 text-foreground/80", iconSize)}>
        <IconComponent className={cn("h-full w-full")} />
      </div>
      
      {/* Título */}
      <div className="w-full flex flex-col items-center">
        <div
          className={cn(
            "text-[15px] leading-tight text-foreground text-center",
            "truncate max-w-[170px]"
          )}
          style={{ fontWeight: 650 }}
          title={title}
        >
          {title}
        </div>
        
        {/* Subtítulo */}
        <div className="text-[11px] text-muted-foreground text-center mt-0.5">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

