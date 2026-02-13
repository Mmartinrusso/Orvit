"use client";

import { useState } from "react";
import { 
  Phone, Mail, Building2, User, MoreHorizontal, 
  Edit, Trash, MessageCircle, Calendar, Bell 
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Contact } from "@/types/agenda";

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
  onCreateReminder: (contact: Contact) => void;
}

export function ContactCard({ 
  contact, 
  onEdit, 
  onDelete, 
  onCreateReminder
}: ContactCardProps) {
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '??';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCategoryColor = (category?: string) => {
    const colors = {
      'Cliente': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400',
      'Proveedor': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400',
      'Interno': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400',
      'Personal': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
              {getInitials(contact.name)}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{contact.name}</h3>
              {contact.position && contact.company && (
                <p className="text-sm text-muted-foreground">
                  {contact.position} en {contact.company}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {contact.pendingReminders > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                <Bell className="h-3 w-3 mr-1" />
                {contact.pendingReminders}
              </Badge>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(contact)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateReminder(contact)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Nuevo Recordatorio
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(contact.id)}
                  className="text-destructive"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Información de contacto */}
        <div className="space-y-2">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a 
                href={`mailto:${contact.email}`} 
                className="text-primary hover:underline"
              >
                {contact.email}
              </a>
            </div>
          )}
          
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a 
                href={`tel:${contact.phone}`} 
                className="text-primary hover:underline"
              >
                {contact.phone}
              </a>
            </div>
          )}
          
          {contact.company && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{contact.company}</span>
            </div>
          )}
        </div>

        {/* Categoría y tags */}
        <div className="flex flex-wrap gap-2">
          {contact.category && (
            <Badge 
              variant="outline" 
              className={getCategoryColor(contact.category)}
            >
              {contact.category}
            </Badge>
          )}
          
          {contact.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Notas (si existen) */}
        {contact.notes && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {contact.notes}
            </p>
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onCreateReminder(contact)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Recordatorio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 