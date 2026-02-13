// Utilidad para recortar una imagen usando canvas a partir de react-easy-crop
// Mejorada para generar imágenes perfectamente centradas

export default function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Validar parámetros de entrada
    if (!imageSrc || typeof imageSrc !== 'string') {
      reject(new Error('La fuente de imagen no es válida'));
      return;
    }
    
    if (!pixelCrop || typeof pixelCrop !== 'object') {
      reject(new Error('Los parámetros de recorte no son válidos'));
      return;
    }
    
    const { x, y, width, height } = pixelCrop;
    if (typeof x !== 'number' || typeof y !== 'number' || 
        typeof width !== 'number' || typeof height !== 'number' ||
        width <= 0 || height <= 0) {
      reject(new Error('Las dimensiones de recorte no son válidas'));
      return;
    }

    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    
    image.onload = () => {
      try {
        // Validar que la imagen se cargó correctamente
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error('La imagen no se cargó correctamente'));
          return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }
        
        // Configurar el contexto para mejor calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Dibujar la imagen recortada
        ctx.drawImage(
          image,
          Math.round(x),
          Math.round(y),
          Math.round(width),
          Math.round(height),
          0,
          0,
          Math.round(width),
          Math.round(height)
        );
        
        // Crear blob con timeout para evitar bloqueos
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout al crear el blob de la imagen'));
        }, 10000);
        
        canvas.toBlob((blob) => {
          clearTimeout(timeoutId);
          if (!blob) {
            reject(new Error('No se pudo crear el blob de la imagen recortada'));
            return;
          }
          console.log('Blob creado exitosamente, tamaño:', blob.size, 'bytes');
          resolve(blob);
        }, 'image/png', 0.95);
        
      } catch (error) {
        console.error('Error en el procesamiento de la imagen:', error);
        reject(error);
      }
    };
    
    image.onerror = (error) => {
      console.error('Error cargando imagen:', error);
      reject(new Error('Error al cargar la imagen para recortar'));
    };
    
    // Timeout para la carga de la imagen
    const loadTimeout = setTimeout(() => {
      reject(new Error('Timeout al cargar la imagen'));
    }, 15000);
    
    const originalOnLoad = image.onload;
    image.onload = () => {
      clearTimeout(loadTimeout);
      if (originalOnLoad) {
        originalOnLoad.call(image, null as any);
      }
    };
    
    // Establecer la fuente después de configurar los event listeners
    try {
      image.src = imageSrc;
    } catch (error) {
      clearTimeout(loadTimeout);
      reject(new Error('Error al establecer la fuente de la imagen'));
    }
  });
} 