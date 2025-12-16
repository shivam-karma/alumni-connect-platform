// frontend/src/hooks/useAuth.js
// Compatibility wrapper: export both a named `useAuth` and a default export.
// This forwards to the real hook implemented in context/AuthContext.jsx

import { useAuth as useAuthContext } from "../context/AuthContext.jsx";

// named export
export function useAuth() {
  return useAuthContext();
}

// default export (for modules doing `import useAuth from '../hooks/useAuth'`)
export default useAuth;
