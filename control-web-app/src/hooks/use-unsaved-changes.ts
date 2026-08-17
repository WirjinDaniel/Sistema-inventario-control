import { useEffect, useRef } from "react";

export function useUnsavedChanges(isDirty: boolean, message = "Tienes cambios sin guardar. ¿Seguro que quieres salir?") {
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = message;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [message]);
}
