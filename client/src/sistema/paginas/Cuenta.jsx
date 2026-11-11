import { useState } from 'react';
import { api, leerForm } from '../../lib/api.js';
import { Campo } from '../../components/ui.jsx';
import { useAviso } from '../../components/Avisos.jsx';

export default function Cuenta() {
  const aviso = useAviso();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cambiar = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setOcupado(true); setError('');
    try { await api.post('/auth/password', leerForm(form)); form.reset(); aviso.ok('Contraseña actualizada'); }
    catch (er) { setError(er.message); }
    finally { setOcupado(false); }
  };

  return (
    <div className="panel" style={{ maxWidth: 440 }}>
      <h3>Cambiar contraseña</h3>
      <form className="form" onSubmit={cambiar}>
        <Campo label="Contraseña actual" name="actual" tipo="password" req autoComplete="current-password" />
        <Campo label="Nueva contraseña (mín. 8 caracteres)" name="nueva" tipo="password" req max={72} autoComplete="new-password" />
        <p className="err">{error}</p>
        <button className="btn" disabled={ocupado}>Cambiar contraseña</button>
      </form>
    </div>
  );
}
