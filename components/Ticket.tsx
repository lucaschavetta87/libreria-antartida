import Image from 'next/image';
import logoControlCel from '../assets/logo.png';

export default function Ticket({ orden }: { orden: any }) {
  if (!orden) return null;
  
  return (
    <div className="ticket-imprimible" style={ticketVisual}>
      <div style={{ textAlign: 'center' }}>
        <Image src={logoControlCel} alt="Logo" width={60} height={60} />
        <h4>Libreria Antártida</h4>
        <p style={{ fontSize: '9px' }}>Pasaje San Martin - Av. San Martin 1136 Local 48, Mendoza.</p>
      </div>
      <div style={divider}></div>
      <div style={{ fontSize: '11px' }}>
      </div>
      {/* ... resto del diseño del ticket ... */}
    </div>
  );
}

// Los estilos específicos del ticket se quedan acá
const ticketVisual = { /* ... */ };
const divider = { /* ... */ };