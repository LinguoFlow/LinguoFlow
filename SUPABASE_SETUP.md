# Configuracion final de Supabase (LinguoFlow)

1. Crea un proyecto en Supabase.
2. Ve a `SQL Editor` y ejecuta completo el archivo `supabase/schema.sql`.
3. En `Authentication > Providers > Email`, deja activo Email/Password.
4. Copia estos valores de `Project Settings > API`:
   - `Project URL`
   - `anon public key`
5. Abre `supabase.config.js` y reemplaza:
   - `TU_SUPABASE_URL`
   - `TU_SUPABASE_ANON_KEY`
6. Ejecuta la web con servidor local (no `file://`), por ejemplo:
   - `python -m http.server 5500`
   - abre `http://localhost:5500/index.html`
7. Prueba:
   - crear cuenta nueva
   - iniciar sesion
   - completar ejercicios en `niveles.html`
   - cerrar sesion e iniciar otra vez para validar que progreso/racha/lecciones perfectas sigan guardados.

## Nota sobre guardado

- Los datos solo se guardan cuando hay usuario autenticado en Supabase.
- Si alguien entra como invitado, no se persiste progreso en base de datos.
