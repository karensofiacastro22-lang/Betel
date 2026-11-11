import { useState } from 'react';
import { api, leerForm } from '../lib/api.js';
import { useSesion } from './sesion.jsx';

export default function Login() {
  const { iniciar } = useSesion();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try { await api.post('/auth/login', leerForm(e.currentTarget)); await iniciar(); }
    catch (er) { setError(er.message); setOcupado(false); }
  };

  return (
    <section className="login">
      <form className="login-card" onSubmit={enviar}>
        <img src="/img/logo-v.png" alt="Logo El Calvario" width="110" height="110" />
        <h1>BETEL</h1>
        <p className="sub">Sistema Integral de Gestión e Información<br />Misión Cristiana El Calvario</p>
        <label>Correo<input name="correo" type="email" required autoComplete="username" /></label>
        <label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>
        <p className="err" role="alert">{error}</p>
        <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Ingresar'}</button>
        <a className="volver" href="/">← Volver al sitio web</a>
      </form>
    </section>
  );
}
