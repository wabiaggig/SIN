# SIN — Fase 1: Análisis funcional

Basado en `PROMPT.md` (reglamento completo). Este documento no inventa reglas nuevas; donde el reglamento es ambiguo o contradictorio, se marca explícitamente en la sección 7.

## 1. Resumen del producto

SIN es una app móvil (React Native/Expo) para jugar en tiempo real, con familiares/amigos, una variante propia del juego de cartas Golpeado. Incorpora puntaje acumulado con eliminación a 69 puntos, cruces, reingresos pagados, pozo de apuestas virtual (sin dinero real), codillo y royal. 3 a 8 jugadores por partida.

## 2. Actores

| Actor | Descripción |
|---|---|
| Jugador | Participa en una partida, tiene mano privada, puntaje, estado de cruz. |
| Anfitrión (host) | Jugador que crea la sala; configura apuestas, sala privada, invitaciones; puede iniciar la partida. |
| Servidor (autoridad de juego) | Única fuente de verdad: baraja, valida acciones, calcula puntajes, determina ganador. No es un actor humano pero es central a todo caso de uso. |
| Espectador (no confirmado en el reglamento) | Ver sección 7 — no se especifica si existe modo espectador. |

## 3. Casos de uso principales

### 3.1 Gestión de sala
- Crear sala (config: nombre, máx. jugadores, moneda, montos, bono SIN, privacidad, código, tiempo por turno).
- Unirse a sala (código, enlace, invitación directa).
- Confirmar entrada (pago virtual).
- Elegir repartidor inicial (aleatorio / anfitrión / manual).

### 3.2 Ronda de juego
- Barajar y repartir (7 cartas c/u, 8 al repartidor).
- Descarte inicial del repartidor.
- Turno: robar del mazo | tomar descarte para bajarse | golpear (mutuamente excluyentes).
- Bajar grupos (mismo valor / escalera).
- Enchufar cartas a grupos propios o ajenos.
- Mover comodín en extremo de escalera.
- Descartar para cerrar turno normal.
- Reciclar mazo cuando se agota.
- Declarar golpe (termina la ronda, dispara resolución).
- Resolución post-golpe: bajar/enchufar final, conteo de puntaje en mano, oferta de cruz, cálculo de codillo.
- Declarar royal (termina la partida inmediatamente).
- Cantar la tabla (consulta de estado, no consume turno).

### 3.3 Progresión de partida
- Registrar puntaje acumulado por ronda.
- Detectar vuelo (>69).
- Ofrecer y procesar reingreso.
- Detectar pérdida de condición SIN.
- Detectar codillo y aplicar expulsión + deuda de entradas futuras.
- Determinar ganador (normal, SIN, royal, royal+SIN).
- Calcular liquidación del pozo y bonos.

### 3.4 Sesión / conectividad
- Reconexión tras desconexión (mantener asiento, estado, mano privada).
- Manejo de espera/expulsión/pausa por el anfitrión ante desconexión prolongada.

## 4. Reglas de negocio (resumen normativo)

Todas están descritas en detalle en `PROMPT.md` secciones 2–47. Resumen operativo:

- **Elegibilidad de golpe:** `isPlayerTurn && firstRoundCompleted && !hasDrawnThisTurn && !hasTakenDiscardThisTurn && accumulatedPoints + currentHandPoints <= 69`.
- **Elegibilidad de cruz:** `!isKnocker && crossAvailable && roundPoints > 0 && accumulatedPoints + roundPoints <= 69`. Se consume una única vez por partida.
- **Vuelo:** `accumulatedPoints + roundPoints > 69`. Pierde cruz y SIN de forma permanente.
- **Reingreso:** solo si tras resolver la ronda quedan ≥2 jugadores sin volar; puntaje de reingreso = máximo acumulado entre los jugadores no volados; precio depende de si existe SIN activo en la mesa.
- **Codillo:** golpeador termina con estrictamente más puntos que todos los demás Y nadie voló esa ronda → expulsión, pérdida del pozo, deuda de entradas de la siguiente partida.
- **Royal:** exactamente 7 cartas en mano formando escalera de un solo palo (comodines permitidos), declarado explícitamente, validado por servidor, termina la partida al instante.
- **Victoria SIN:** ganar sin haber usado cruz, sin haber volado, sin haber reingresado nunca → bono adicional de cada rival.

## 5. Máquina de estados

### 5.1 Partida (`GamePhase`)

```
lobby
  → waiting_for_entries
  → shuffling
  → cutting
  → dealing
  → playing
      → resolving_knock
          → checking_codillo
          → checking_flown_players
          → waiting_for_reentry_decisions
      → starting_next_round → playing (nueva ronda)
  → finished
```

Transición a `finished` puede ocurrir desde `checking_flown_players` (queda 1 solo jugador sin volar) o desde cualquier punto de `playing`/`resolving_knock` si se declara y valida un royal.

### 5.2 Jugador (`PlayerStatus`)

```
waiting → active
active → resolving_after_knock → active (ronda siguiente)
active → flown_pending_reentry → reentering → active
active → flown_pending_reentry → eliminated (si no reingresa o no puede)
active (golpeador) → codillo_eliminated (si aplica codillo)
active → winner
```

### 5.3 Cruz (`CrossState`)

```
available → used        (jugador se cruza)
available → lost_by_flying  (jugador vuela sin haber usado la cruz)
used → (terminal, no cambia más en la partida)
lost_by_flying → (terminal)
```

### 5.4 Turno dentro de una ronda

```
turn_start
  → drawing (robó del mazo) → laying_down/attaching (opcional) → must_discard → turn_end
  → taking_discard (tomó descarte, debe usarlo en un grupo inmediato) → laying_down/attaching (opcional) → must_discard → turn_end
  → knocking (solo si canKnock) → ronda pasa a resolving_knock
```

## 6. Diagrama textual de flujo de ronda

```
[Elegir repartidor] → [Barajar] → [Corte simbólico] → [Repartir 7/8]
   → [Repartidor descarta] → [Turnos hacia la derecha, primera vuelta sin golpe habilitado]
   → LOOP: jugador activo elige {robar | tomar descarte | golpear (si habilitado)}
        - robar/tomar descarte → bajar/enchufar opcional → descartar → siguiente jugador
        - golpear → sale del loop
   → [Resolución]: jugador a la derecha del golpeador resuelve primero,
       sigue hacia la derecha, golpeador resuelve último (sin cruz)
   → [Calcular codillo] → [Detectar vuelos] → [¿queda 1 sin volar?]
        - sí → [fin de partida, gana ese jugador]
        - no → [ofrecer reingresos] → [sumar pozo] → [determinar próximo repartidor]
            (golpeador reparte; si hizo codillo, reparte quien está a su derecha)
   → nueva ronda
```

## 7. Casos límite y contradicciones detectadas

Estas ambigüedades fueron identificadas en `PROMPT.md` y **ya fueron resueltas junto con el usuario** (2026-07-22). Se conserva el texto original tachado para trazabilidad, seguido de la resolución adoptada:

1. **Modo espectador**: ~~no se menciona~~. **Resuelto:** fuera del MVP. No existe rol de espectador; todo participante de una sala es jugador.
2. **Tiempo máximo por turno** (§6.1, campo `Tiempo máximo opcional por turno`): ~~el reglamento no especifica qué ocurre si un jugador no actúa a tiempo~~. **Resuelto:** no se implementa límite de tiempo en el MVP; el campo queda como configuración reservada para una versión futura. Los turnos no expiran automáticamente.
3. **Corte simbólico del mazo** (§7): ~~confirmar interpretación~~. **Resuelto:** el corte es puramente cosmético/animación; el servidor baraja con RNG seguro y fija el orden real sin que el corte del jugador lo modifique.
4. **Empate en el número de jugadores para reingreso** (§34): ~~no aclara si cuenta jugadores eliminados por codillo~~. **Resuelto:** el jugador expulsado por codillo NO cuenta en el conteo de "jugadores que no volaron"; el conteo se hace solo sobre jugadores que permanecen activos en la partida tras la expulsión.
5. **Codillo y reingreso simultáneos en la misma ronda**: ~~orden de evaluación no explícito~~. **Resuelto:** se evalúa primero el codillo (expulsión inmediata del golpeador si aplica), luego se detectan los vuelos del resto de jugadores de esa ronda, y por último se ofrecen los reingresos.
6. **Dos jugadores (modalidad reducida)** (§3): se menciona una modalidad tipo "Golpeado con puntaje" para 2 jugadores pero sin reglas propias. **Resuelto:** excluida del MVP. Las salas se configuran con mínimo 3 jugadores.
7. **Bots** (§56): declarados explícitamente fuera del MVP, pero se menciona como posibilidad futura para reemplazar jugadores desconectados. No requiere definición ahora.
8. **Royal con comodín en mano vacía de cartas naturales** (§18, §43): ~~límite de comodines no explícito~~. **Resuelto:** sin límite artificial de comodines dentro del royal; se valida únicamente que las cartas naturales presentes sean consistentes con una única escalera de 7 posiciones del mismo palo (los comodines cubren el resto).
9. **Reconexión — límite de espera** (§56): ~~es una recomendación, no una regla obligatoria~~. **Resuelto:** configurable por el anfitrión al crear la sala, con 60 segundos como valor por defecto.
10. **Cruz vs. codillo** (§30, §40, descubierta al implementar `@sin/game-engine`): la cruz "registra la ronda como cero" (§30), pero el reglamento no aclara si ese cero cuenta para la comparación de codillo (§40, "el golpeador tiene más puntos que todos los demás"). Tomado literalmente, un jugador cruzado con puntaje real >0 podría gatillar o evitar un codillo artificialmente. **Resuelto (2026-07-22):** la comparación de codillo usa el puntaje REAL de la mano de cada jugador, no el registrado tras la cruz — la cruz no puede generar ni evitar un codillo. Implementado en `packages/game-engine/src/codillo.ts` vía el campo `RoundResult.realPoints`.

## 8. Criterios de aceptación

Ver `PROMPT.md` sección 69 (40 criterios) — se adoptan tal cual sin modificaciones, ya que están completos y no presentan contradicciones con el resto del documento.
