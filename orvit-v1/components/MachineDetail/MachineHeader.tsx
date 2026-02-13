import React from "react";

interface MachineHeaderProps {
  machine: any;
}

export default function MachineHeader({ machine }: MachineHeaderProps) {
  return (
    <div className="flex items-center gap-6 border-b pb-4">
      {machine.photo && (
        <img
          src={machine.photo}
          alt={machine.name}
          className="w-32 h-32 object-cover rounded shadow"
        />
      )}
      <div>
        <h1 className="text-3xl font-bold mb-1">{machine.name}</h1>
        <div className="text-gray-600">ID: {machine.id}</div>
        <div className="text-gray-500 text-sm mt-1">Estado: <span className="font-semibold">{machine.status || 'Desconocido'}</span></div>
      </div>
    </div>
  );
} 