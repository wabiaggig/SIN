// Se importa primero que nada en app/_layout.tsx para capturar errores JS
// fatales que de otra forma cierran la app sin dejar rastro en los logs del
// dev server (diagnóstico temporal para el crash en Expo Go nativo).
declare const ErrorUtils: {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
};

if (typeof ErrorUtils !== "undefined") {
  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error("[GLOBAL ERROR]", isFatal ? "FATAL" : "non-fatal", error);
    previousHandler(error, isFatal);
  });
}
