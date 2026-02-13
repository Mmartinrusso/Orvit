'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  UserCheck, 
  Calendar, 
  Package, 
  ArrowRightLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  X
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';

interface LoanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tool: any;
  onLoanCreated?: () => void;
}

interface User {
  id: number;
  name: string;
  email: string | null;
  role: string;
  type: 'USER' | 'WORKER';
  specialty?: string;
}

interface Loan {
  id: number;
  quantity: number;
  borrowedAt: string;
  expectedReturnDate: string | null;
  notes: string | null;
  user: User | null;
  worker: User | null;
  borrowedBy: User;
  status: string;
  borrowerType: string;
}

export default function LoanDialog({ isOpen, onClose, tool, onLoanCreated }: LoanDialogProps) {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'loans' | 'new'>('loans');
  const [users, setUsers] = useState<User[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Estado para el diálogo de devolución
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<Loan | null>(null);
  const [returnForm, setReturnForm] = useState({
    condition: 'GOOD',
    returnNotes: '',
    returnedBy: ''
  });
  
  // Form para nuevo préstamo
  const [loanForm, setLoanForm] = useState({
    userId: '',
    quantity: 1,
    expectedReturnDate: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && tool && currentCompany) {
      fetchUsers();
      fetchActiveLoans();
    }
  }, [isOpen, tool, currentCompany]);

  const fetchUsers = async () => {
    if (!currentCompany) {
      return;
    }
    
    try {
      const response = await fetch(`/api/companies/${currentCompany.id}/users`);
      
      if (response.ok) {
        const data = await response.json();
        // Asegurar que siempre sea un array
        setUsers(Array.isArray(data.users) ? data.users : []);
      } else {
        setUsers([]); // Mantener como array vacío en caso de error
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]); // Mantener como array vacío en caso de error
    }
  };

  const fetchActiveLoans = async () => {
    if (!tool || !currentCompany) return;

    try {
      const response = await fetch(`/api/tools/loans?companyId=${currentCompany.id}&toolId=${tool.id}&status=BORROWED`);
      if (response.ok) {
        const data = await response.json();
        setActiveLoans(data.loans || []);
      }
    } catch (error) {
      console.error('Error fetching active loans:', error);
    }
  };

  const handleCreateLoan = async () => {
    if (!loanForm.userId || loanForm.quantity <= 0) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    if (loanForm.quantity > tool.stockQuantity) {
      toast.error(`Stock insuficiente. Disponible: ${tool.stockQuantity}`);
      return;
    }

    // Extraer tipo y ID del valor seleccionado (formato: "USER-123" o "WORKER-456")
    const [borrowerType, userIdStr] = loanForm.userId.split('-');
    const userId = parseInt(userIdStr);

    if (!borrowerType || !userId) {
      toast.error('Selección de usuario inválida');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: tool.id,
          userId: userId,
          borrowerType: borrowerType,
          quantity: loanForm.quantity,
          expectedReturnDate: loanForm.expectedReturnDate || null,
          notes: loanForm.notes || null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`📦 Préstamo registrado: ${data.message}`, {
          description: `Se ha registrado automáticamente en el historial de movimientos`
        });
        setLoanForm({ userId: '', quantity: 1, expectedReturnDate: '', notes: '' });
        setActiveTab('loans');
        fetchActiveLoans();
        if (onLoanCreated) onLoanCreated();
      } else {
        toast.error(data.error || 'Error al crear préstamo');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear préstamo');
    } finally {
      setIsLoading(false);
    }
  };

  const openReturnDialog = (loan: Loan) => {
    setSelectedLoanForReturn(loan);
    setReturnForm({
      condition: 'GOOD',
      returnNotes: '',
      returnedBy: ''
    });
    setIsReturnDialogOpen(true);
  };

  const handleReturnLoan = async () => {
    if (!selectedLoanForReturn || !returnForm.returnedBy.trim()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/loans/${selectedLoanForReturn.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnNotes: returnForm.returnNotes || null,
          condition: returnForm.condition,
          returnedBy: returnForm.returnedBy.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`✅ Devolución confirmada: ${data.message}`);
        setIsReturnDialogOpen(false);
        setSelectedLoanForReturn(null);
        fetchActiveLoans();
        if (onLoanCreated) onLoanCreated();
      } else {
        toast.error(data.error || 'Error al devolver herramienta');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al devolver herramienta');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const getDaysUntilReturn = (expectedReturnDate: string | null) => {
    if (!expectedReturnDate) return null;
    
    const today = new Date();
    const returnDate = new Date(expectedReturnDate);
    const diffTime = returnDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Helper para obtener el nombre del prestatario (usuario o operario)
  const getBorrowerInfo = (loan: Loan) => {
    // Verificar si es un operario y tiene datos
    if (loan.borrowerType === 'WORKER' && loan.worker && loan.worker.name) {
      return {
        name: loan.worker.name,
        contact: 'Operario',
        type: 'Operario',
        specialty: (loan.worker as any).specialty || null
      };
    } 
    // Verificar si es un usuario y tiene datos
    else if (loan.borrowerType === 'USER' && loan.user && loan.user.name) {
      return {
        name: loan.user.name,
        contact: 'Usuario del sistema',
        type: 'Usuario',
        specialty: null
      };
    }
    // Fallback por si los datos están incompletos
    else if (loan.user && loan.user.name) {
      return {
        name: loan.user.name,
        contact: 'Usuario del sistema',
        type: 'Usuario',
        specialty: null
      };
    }
    
    // Último fallback
    return { 
      name: 'Usuario desconocido', 
      contact: 'Sin contacto', 
      type: 'Desconocido', 
      specialty: null 
    };
  };

  // Extraer el ID del usuario seleccionado del formato "TYPE-ID"
  const getSelectedUser = () => {
    if (!loanForm.userId) return null;
    const [borrowerType, userIdStr] = loanForm.userId.split('-');
    const userId = parseInt(userIdStr);
    return users.find(u => u.id === userId && u.type === borrowerType);
  };
  
  const selectedUser = getSelectedUser();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Gestión de Préstamos - {tool?.name}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>

        {/* Información de la herramienta */}
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-lg">{tool?.name}</h3>
                  <p className="text-sm text-gray-600">Stock disponible: {tool?.stockQuantity} unidades</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Stock mínimo: {tool?.minStockLevel}</p>
                <Badge variant={tool?.stockQuantity <= tool?.minStockLevel ? 'destructive' : 'secondary'}>
                  {tool?.stockQuantity <= tool?.minStockLevel ? 'Stock Bajo' : 'Stock OK'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <Button
            variant={activeTab === 'loans' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('loans')}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            Préstamos Activos ({activeLoans.length})
          </Button>
          <Button
            variant={activeTab === 'new' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('new')}
            className="flex-1"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Nuevo Préstamo
          </Button>
        </div>

        {/* Contenido de tabs */}
        {activeTab === 'loans' && (
          <div className="space-y-4">
            {activeLoans.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-medium text-lg mb-2">No hay préstamos activos</h3>
                  <p className="text-gray-500">
                    Esta herramienta no tiene préstamos pendientes de devolución
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeLoans.map((loan) => {
                const daysUntilReturn = getDaysUntilReturn(loan.expectedReturnDate);
                const isOverdue = daysUntilReturn !== null && daysUntilReturn < 0;
                const borrowerInfo = getBorrowerInfo(loan);
                
                return (
                  <Card key={loan.id} className={`${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <User className={`h-8 w-8 ${borrowerInfo.type === 'Operario' ? 'text-green-600' : 'text-blue-600'}`} />
                          <div>
                            <CardTitle className="text-lg">
                              {borrowerInfo.name}
                              <span className="ml-2 text-xs font-normal bg-gray-100 px-2 py-1 rounded">
                                {borrowerInfo.type}
                              </span>
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                              {borrowerInfo.contact}
                              {borrowerInfo.specialty && (
                                <span className="ml-2 text-xs">({borrowerInfo.specialty})</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isOverdue && (
                          <Badge variant="destructive" className="animate-pulse">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Vencido
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-blue-500 text-white">
                            Prestado
                          </Badge>
                          {isOverdue && (
                            <Badge variant="destructive" className="animate-pulse">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Vencido
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          Prestado por: {loan.borrowedBy?.name || 'Sistema'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Cantidad:</span>
                          <p className="font-medium">{loan.quantity} unidades</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Prestado el:</span>
                          <p className="font-medium">{formatDate(loan.borrowedAt)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Esperado:</span>
                          <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                            {loan.expectedReturnDate ? formatDate(loan.expectedReturnDate) : 'Sin fecha límite'}
                            {daysUntilReturn !== null && (
                              <span className="block text-xs">
                                {isOverdue ? `${Math.abs(daysUntilReturn)} días vencido` : `${daysUntilReturn} días restantes`}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {loan.notes && (
                        <div>
                          <span className="text-gray-500 text-sm">Notas:</span>
                          <p className="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">{loan.notes}</p>
                        </div>
                      )}

                      <Separator />

                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          🔄 Confirmar Devolución
                        </h4>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => openReturnDialog(loan)}
                            disabled={isLoading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            🔄 Procesar Devolución
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Se registrará automáticamente en el historial de movimientos
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="space-y-6">
            {tool?.stockQuantity === 0 ? (
              <Card className="border-red-300 bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-6 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="font-medium text-lg mb-2">Sin Stock Disponible</h3>
                  <p className="text-red-600">
                    No se pueden crear préstamos porque no hay stock disponible
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Selector de usuario */}
                <div>
                  <Label htmlFor="user">Usuario/Operario a quien prestar *</Label>
                  <Select value={loanForm.userId} onValueChange={(value) => setLoanForm(prev => ({ ...prev, userId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario u operario" />
                    </SelectTrigger>
                    <SelectContent>
                      {!Array.isArray(users) || users.length === 0 ? (
                        <SelectItem value="debug" disabled>
                          🔍 No hay usuarios ni operarios disponibles
                        </SelectItem>
                      ) : (
                        users.map((user) => (
                          <SelectItem key={`${user.type}-${user.id}`} value={`${user.type}-${user.id}`}>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {user.type === 'USER' 
                                    ? `(Usuario)` 
                                    : `(Operario)`
                                  }
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cantidad */}
                <div>
                  <Label htmlFor="quantity">Cantidad *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={tool?.stockQuantity || 1}
                    value={loanForm.quantity}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo disponible: {tool?.stockQuantity} unidades
                  </p>
                </div>

                {/* Fecha esperada de devolución */}
                <div>
                  <Label htmlFor="returnDate">Fecha esperada de devolución</Label>
                  <DatePicker
                    value={loanForm.expectedReturnDate}
                    onChange={(date) => setLoanForm(prev => ({ ...prev, expectedReturnDate: date }))}
                    placeholder="Selecciona una fecha"
                  />
                </div>

                {/* Notas */}
                <div>
                  <Label htmlFor="notes">Razón del Préstamo y Notas</Label>
                  <Textarea
                    id="notes"
                    value={loanForm.notes}
                    onChange={(e) => setLoanForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Ejemplo: Mantenimiento programado sector A, Reparación urgente máquina línea 3, etc."
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📝 Se recomienda especificar el motivo para un mejor control del historial
                  </p>
                </div>

                {/* Resumen */}
                {selectedUser && (
                  <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Resumen del préstamo:</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Usuario:</strong> {selectedUser.name}</p>
                        <p><strong>Cantidad:</strong> {loanForm.quantity} unidades</p>
                        <p><strong>Stock restante:</strong> {tool?.stockQuantity - loanForm.quantity} unidades</p>
                        {loanForm.expectedReturnDate && (
                          <p><strong>Devolución esperada:</strong> {formatDate(loanForm.expectedReturnDate)}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Botones */}
                <div className="flex gap-2 pt-4">
                  <Button onClick={onClose} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateLoan} 
                    disabled={isLoading || !loanForm.userId || loanForm.quantity <= 0}
                    className="flex-1"
                  >
                    {isLoading ? 'Creando...' : 'Crear Préstamo'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
          </DialogBody>
      </DialogContent>
    </Dialog>

    {/* Diálogo de Devolución */}
    <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            Procesar Devolución
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        {selectedLoanForReturn && (
          <div className="space-y-4">
            {/* Información del préstamo */}
            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-3">
                <div className="text-sm">
                  <p><strong>Herramienta:</strong> {tool?.name}</p>
                  <p><strong>Cantidad:</strong> {selectedLoanForReturn.quantity} unidades</p>
                  <p><strong>Prestado a:</strong> {getBorrowerInfo(selectedLoanForReturn).name}</p>
                  <p><strong>Fecha préstamo:</strong> {formatDate(selectedLoanForReturn.borrowedAt)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Formulario de devolución */}
            <div className="space-y-4">
              {/* Quién devuelve */}
              <div>
                <Label htmlFor="returnedBy">¿Quién está devolviendo? *</Label>
                <Select 
                  value={returnForm.returnedBy} 
                  onValueChange={(value) => setReturnForm(prev => ({ ...prev, returnedBy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar quien devuelve..." />
                  </SelectTrigger>
                  <SelectContent>
                    {!Array.isArray(users) || users.length === 0 ? (
                      <SelectItem value="none" disabled>Cargando usuarios...</SelectItem>
                    ) : (
                      users.map((user) => (
                        <SelectItem key={`return-${user.type}-${user.id}`} value={user.name}>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {user.type === 'USER' 
                                  ? `(Usuario)` 
                                  : `(Operario)`
                                }
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado de la herramienta */}
              <div>
                <Label htmlFor="condition">Estado de la herramienta *</Label>
                <Select 
                  value={returnForm.condition} 
                  onValueChange={(value) => setReturnForm(prev => ({ ...prev, condition: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOD">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Buen Estado</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="DAMAGED">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span>Con Daños</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="BROKEN">
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-red-500" />
                        <span>Rota/Inutilizable</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notas */}
              <div>
                <Label htmlFor="returnNotes">Observaciones de la devolución</Label>
                <Textarea
                  id="returnNotes"
                  value={returnForm.returnNotes}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, returnNotes: e.target.value }))}
                  placeholder="Ej: Herramienta en perfecto estado, se usó para mantenimiento preventivo..."
                  rows={3}
                />
              </div>

            </div>
          </div>
        )}
        </DialogBody>

        <DialogFooter>
          <Button
            onClick={() => setIsReturnDialogOpen(false)}
            variant="outline"
            size="sm"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReturnLoan}
            disabled={isLoading || !returnForm.returnedBy.trim()}
            size="sm"
          >
            {isLoading ? 'Procesando...' : 'Confirmar Devolución'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
} 