SIN — Reglamento funcional y especificación de aplicación móvil

1. Descripción general

SIN es un juego de cartas familiar basado parcialmente en Golpeado, pero con un sistema propio de:

* Puntaje acumulado.
* Eliminación al superar los 69 puntos.
* Reingresos pagados.
* Pozo de apuestas.
* Cruces.
* Victoria con SIN.
* Codillo.
* Royal.
* Acción de cantar la tabla.

Se juega con entre 3 y 8 jugadores.

Una partida está formada por varias rondas.

Cada ronda termina cuando un jugador declara golpe.

La partida termina cuando:

* Solo queda un jugador que no ha volado.
* Un jugador consigue un royal.

El objetivo principal es ser el último jugador cuyo puntaje acumulado no haya superado los 69 puntos.

⸻

2. Conceptos principales

Ronda

Periodo comprendido desde el reparto de cartas hasta que un jugador declara golpe.

Partida

Conjunto de rondas que continúa hasta que existe un ganador.

Volar

Un jugador vuela cuando su puntaje acumulado supera los 69 puntos.

Puntaje acumulado + puntaje de la ronda > 69

Cruzarse

Acción que permite registrar una ronda como cero puntos.

Cada jugador puede cruzarse una sola vez durante la partida, siempre que cumpla las condiciones correspondientes.

SIN

SIN significa sin cruz.

Un jugador conserva su condición SIN mientras:

* Nunca haya usado su cruz.
* Nunca haya volado.

Golpe

Acción que termina una ronda y da inicio al proceso de revelar, bajar, enchufar y sumar cartas.

Bajarse

Colocar sobre la mesa uno o más grupos válidos de cartas.

Enchufar

Agregar una carta propia a un grupo válido que ya está visible sobre la mesa.

Codillo

Penalización que ocurre cuando quien golpeó termina teniendo más puntos que todos los demás, siempre que nadie haya volado en esa ronda.

Royal

Victoria inmediata que ocurre cuando un jugador tiene exactamente siete cartas en la mano formando una escalera válida del mismo palo.

Cantar

Mostrar o anunciar la tabla de puntajes para que todos conozcan la situación de la partida.

⸻

3. Número de jugadores

SIN puede jugarse entre:

* Mínimo: 3 jugadores.
* Máximo: 8 jugadores.

Con dos jugadores se puede jugar una modalidad similar a Golpeado con puntaje, pero la modalidad principal de SIN está diseñada para entre 3 y 8 jugadores.

⸻

4. Barajas

Se utilizan:

* Dos barajas completas.
* Todos los palos.
* Comodines incluidos.

Aunque existan cartas duplicadas por utilizar dos barajas, cada carta debe tener un identificador único dentro de la aplicación.

Ejemplo:

type Card = {
  id: string;
  rank:
    | "A"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "10"
    | "J"
    | "Q"
    | "K"
    | "JOKER";
  suit: "hearts" | "diamonds" | "clubs" | "spades" | null;
  deckIndex: 1 | 2;
};

El comodín no tiene palo.

⸻

5. Sistema de apuestas

Antes de iniciar una partida se configura:

* Moneda.
* Entrada inicial.
* Precio de reingreso cuando todavía existe SIN.
* Precio de reingreso cuando ya no existe SIN.
* Bono adicional por ganar con SIN.

Ejemplo familiar:

Entrada inicial: S/ 1.00
Reingreso cuando existe SIN: S/ 1.00
Reingreso cuando no existe SIN: S/ 0.50
Bono SIN: S/ 1.00 por cada jugador rival

Configuración sugerida:

type BettingConfig = {
  currencyCode: string;
  currencySymbol: string;
  initialEntryAmount: number;
  reentryWithSinAmount: number;
  reentryWithoutSinAmount: number;
  sinBonusAmountPerOpponent: number;
};

Todos los jugadores pagan la entrada al comenzar.

El dinero se acumula en un pozo.

Los reingresos también se agregan al pozo.

El ganador final se lleva el pozo.

Si gana con SIN, recibe además un pago adicional de cada uno de los demás participantes.

La aplicación no necesita procesar dinero real. Puede funcionar como sistema de contabilidad y mostrar:

* Cuánto aportó cada jugador.
* Cuánto contiene el pozo.
* Cuánto debe pagar cada persona.
* Cuánto recibe el ganador.

⸻

6. Preparación de la partida

6.1 Creación de sala

Un jugador crea una sala y se convierte en anfitrión.

La sala debe permitir configurar:

* Nombre de la sala.
* Número máximo de jugadores.
* Moneda.
* Montos de entrada y reingreso.
* Bono SIN.
* Sala privada.
* Código de invitación.
* Tiempo máximo opcional por turno.

6.2 Entrada de jugadores

Los demás jugadores pueden entrar mediante:

* Código de sala.
* Enlace de invitación.
* Invitación directa.

Cada jugador debe tener:

* Nombre visible.
* Avatar.
* Identificador único.
* Asiento dentro de la mesa.

6.3 Pago inicial

Antes de comenzar, todos deben confirmar su entrada.

La aplicación registra el pago como una deuda o aporte virtual.

No es necesario integrar transferencias ni pagos bancarios.

⸻

7. Elección del repartidor

En la primera ronda se elige un repartidor.

Puede hacerse mediante:

* Selección aleatoria.
* Selección del anfitrión.
* Acuerdo manual.

En el juego presencial, el repartidor baraja y otro jugador corta el mazo.

En la aplicación:

1. El servidor baraja las cartas.
2. Otro jugador puede realizar un corte simbólico.
3. El corte puede representarse mediante una animación.
4. El servidor conserva la autoridad sobre el orden real del mazo.

El corte digital no debe permitir manipular las cartas.

⸻

8. Reparto

Se reparten siete cartas a cada jugador.

El jugador que reparte recibe ocho cartas.

El reparto comienza por el jugador situado a la derecha del repartidor y continúa en ese sentido.

Al terminar, el repartidor tiene ocho cartas y todos los demás tienen siete.

El repartidor inicia la ronda descartando una carta.

Después del descarte, todos deben tener siete cartas propias distribuidas entre:

* Cartas en mano.
* Cartas bajadas.
* Cartas enchufadas.

⸻

9. Sentido de juego

Los turnos avanzan hacia la derecha.

En una mesa circular, el siguiente jugador es el situado inmediatamente a la derecha del jugador actual.

Ejemplo de función:

function getNextActivePlayer(
  currentPlayerId: string,
  orderedPlayers: PlayerGameState[]
): PlayerGameState {
  const currentIndex = orderedPlayers.findIndex(
    player => player.playerId === currentPlayerId
  );
  for (let offset = 1; offset <= orderedPlayers.length; offset += 1) {
    const index = (currentIndex + offset) % orderedPlayers.length;
    const candidate = orderedPlayers[index];
    if (candidate.status === "active") {
      return candidate;
    }
  }
  throw new Error("No hay otro jugador activo.");
}

⸻

10. Primera vuelta

Durante la primera vuelta de una ronda no se puede golpear.

Todos los jugadores activos deben haber participado al menos una vez.

El descarte inicial del repartidor no cuenta como un turno completo que le permita golpear inmediatamente.

El golpe queda habilitado cuando todos los jugadores activos han completado su primer turno normal.

Estado sugerido:

type PlayerRoundState = {
  hasCompletedFirstTurn: boolean;
};

⸻

11. Acciones disponibles durante un turno

Al comenzar su turno, un jugador debe elegir una de estas tres acciones principales:

1. Robar una carta del mazo.
2. Tomar la carta superior del descarte para bajarse.
3. Declarar golpe.

Estas acciones son excluyentes.

No se puede:

* Robar y luego golpear.
* Tomar el descarte y luego golpear.
* Golpear y después jugar cartas.

La elección de golpe reemplaza completamente el turno normal.

⸻

12. Robar del mazo

Cuando un jugador roba del mazo:

1. Pasa temporalmente de siete a ocho cartas propias.
2. Puede bajar grupos.
3. Puede enchufar cartas.
4. Debe terminar descartando una carta.
5. Debe volver a quedar con siete cartas propias.

Las siete cartas originales del jugador pueden estar repartidas entre:

* Mano.
* Grupos bajados.
* Cartas enchufadas.

La carta robada es temporalmente la octava carta hasta que se descarte una.

⸻

13. Tomar la carta del descarte

Solo se puede tomar la carta superior del descarte.

No se pueden recoger varias cartas.

No se puede elegir una carta anterior.

La carta recogida:

* No puede guardarse en la mano.
* Debe utilizarse inmediatamente para bajarse.
* Debe formar parte del grupo con el que el jugador se baja.

Ejemplo:

El jugador tiene:
2 de corazones
2 de tréboles
La carta superior del descarte es:
2 de espadas
Puede tomarla y debe bajar inmediatamente el grupo de tres cartas.

Después de usar la carta del descarte para bajarse, el jugador también puede:

* Bajar otros grupos que ya tenía.
* Enchufar cartas.
* Hacer otras jugadas válidas.
* Descartar una carta para finalizar el turno.

Al finalizar, la cantidad total de cartas propias debe volver a ser siete.

⸻

14. Grupos válidos

Todo grupo debe contener al menos tres cartas.

Existen dos clases de grupos:

1. Grupos del mismo valor.
2. Escaleras del mismo palo.

⸻

15. Grupos del mismo valor

Un grupo del mismo valor contiene tres o más cartas con el mismo número o figura.

Ejemplos:

5 de corazones
5 de tréboles
5 de espadas

Como se utilizan dos barajas, pueden repetirse cartas idénticas.

Ejemplo válido:

5 de corazones de la baraja 1
5 de corazones de la baraja 2
5 de tréboles

No existe un máximo especial de cartas para este grupo.

El máximo real está limitado por las cartas disponibles en las dos barajas.

El comodín no puede utilizarse en grupos del mismo número.

Ejemplos válidos:

2, 2, 2
K, K, K
7, 7, 7, 7, 7

Ejemplo inválido:

8, 8, comodín

⸻

16. Escaleras

Una escalera contiene:

* Un mínimo de tres cartas.
* Cartas consecutivas.
* Todas del mismo palo.
* Ningún valor repetido.

Ejemplos válidos:

3, 4, 5 de tréboles
8, 9, 10, J de corazones
Q, K, A de espadas
K, A, 2 de diamantes
A, 2, 3 de tréboles

Aunque existan dos barajas, no se puede repetir un mismo valor en una escalera.

Ejemplo inválido:

4 de corazones
otro 4 de corazones
5 de corazones

Una escalera debe avanzar o retroceder de manera consecutiva.

⸻

17. Funcionamiento circular del as

El as puede utilizarse:

* Antes del 2.
* Después de la K.
* Entre K y 2.

El orden de valores se considera circular:

A → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → J → Q → K → A

Ejemplos válidos:

Q, K, A
K, A, 2
A, 2, 3
10, J, Q, K, A, 2, 3
Q, K, A, 2, 3, 4, 5

Dentro de una misma escalera no puede repetirse un valor.

Aunque el orden sea circular, una escalera no puede dar más de una vuelta completa.

⸻

18. Comodín

El comodín puede utilizarse únicamente en escaleras.

Puede:

* Reemplazar una carta faltante.
* Bajarse como parte de una escalera.
* Enchufarse en una escalera.
* Descartarse.

Ejemplo:

2 de tréboles
comodín como 3 de tréboles
4 de tréboles

Si queda en la mano al final de la ronda, vale 15 puntos.

⸻

19. Movimiento del comodín en grupos visibles

Un comodín visible puede moverse únicamente cuando se encuentra en uno de los extremos de una escalera.

Ejemplo inicial:

comodín, 2, 3

Otro jugador podría enchufar una carta y extender el grupo:

comodín, A, 2, 3

También puede extenderse una escalera como:

2, 3, 4, comodín

El comodín deja de ser movible cuando queda encerrado entre cartas naturales.

Ejemplos:

K, comodín, 2, 3

En este caso el comodín representa el as y está encerrado.

2, 3, comodín, 5

En este caso representa el 4 y también está encerrado.

Un comodín encerrado:

* No puede retirarse.
* No puede cambiarse de posición.
* No puede recuperarse para usarlo en otro grupo.

No se permite desmontar el grupo para liberar el comodín.

⸻

20. Bajarse

Bajarse consiste en colocar sobre la mesa uno o más grupos válidos.

Las cartas bajadas:

* Quedan visibles.
* Ya no cuentan como puntos en la mano.
* Se mantienen asociadas al jugador que las bajó.
* Pueden recibir cartas enchufadas.

Un jugador puede bajarse:

* Después de robar del mazo.
* Al tomar obligatoriamente la carta superior del descarte.
* Durante la resolución posterior a un golpe.

⸻

21. Enchufar

Enchufar consiste en añadir una carta compatible a un grupo visible.

Se puede enchufar en:

* Un grupo propio.
* El grupo de otro jugador.

Ejemplo en grupo de valor:

Grupo visible:
2, 2, 2
Carta enchufada:
otro 2

Ejemplo en escalera:

Grupo visible:
4, 5, 6 de corazones
Cartas posibles:
3 de corazones
7 de corazones

Una carta enchufada:

* Sale de la mano.
* Deja de sumar puntos.
* Sigue asociada al jugador que la aportó.

La aplicación puede mostrar un pequeño indicador de color, avatar o inicial para señalar quién añadió cada carta.

⸻

22. Prohibición de reorganizar grupos

No se pueden desmontar ni reorganizar los grupos visibles.

Ejemplo:

3, 4, 5, 6, 7 de corazones

No se permite separar:

3, 4, 5

para utilizar:

6, 7

en otro grupo.

Solo se permite:

* Extender un grupo.
* Enchufar cartas compatibles.
* Mover un comodín que permanezca en un extremo, según las reglas del comodín.

⸻

23. Finalización de un turno normal

Todo turno normal debe terminar con un descarte.

Excepciones:

* Declarar golpe en lugar de realizar un turno normal.
* Declarar royal.
* Finalización inmediata de la partida por una condición especial.

Un jugador que roba debe descartar.

Un jugador que recoge del descarte para bajarse también debe terminar descartando.

⸻

24. Jugador sin cartas en la mano

Un jugador puede bajar o enchufar todas sus cartas y quedar con cero cartas en la mano.

Sin embargo, no gana inmediatamente.

Debe esperar hasta que vuelva a llegar su turno.

Cuando vuelve a ser su turno:

* Puede declarar golpe directamente.
* No roba.
* No recoge del descarte.
* No descarta.
* Su puntaje de la ronda es cero.

Esto solo es posible si ya terminó la primera vuelta y el golpe está habilitado.

⸻

25. Agotamiento del mazo

Si el mazo se queda sin cartas:

1. Se conserva la carta superior del descarte.
2. Se recogen las demás cartas del descarte.
3. Se barajan nuevamente.
4. Se crea un nuevo mazo.
5. La partida continúa.

El servidor debe realizar este procedimiento automáticamente.

⸻

26. Golpear

Golpear termina la ronda.

Un jugador puede declarar golpe cuando:

* Es su turno.
* La primera vuelta ya terminó.
* No ha robado del mazo durante ese turno.
* No ha tomado una carta del descarte durante ese turno.
* Su puntaje real no hará que supere los 69 puntos.

Golpear es una acción alternativa a robar o tomar el descarte.

⸻

27. Puntaje permitido para golpear

No existe un límite fijo de puntos en la mano.

El máximo permitido depende del puntaje acumulado.

Ejemplo:

Puntaje acumulado: 38
Máximo puntaje permitido en la ronda: 31

Puede golpear con cualquier puntaje entre 0 y 31.

No puede golpear con 32 porque:

38 + 32 = 70

y estaría volando.

Condición:

const canKnock =
  isPlayerTurn &&
  firstRoundCompleted &&
  !hasDrawnThisTurn &&
  !hasTakenDiscardThisTurn &&
  accumulatedPoints + currentHandPoints <= 69;

Solo se cuentan las cartas que permanecen en la mano.

Las cartas bajadas y enchufadas no cuentan.

⸻

28. Resolución después del golpe

Cuando un jugador golpea:

1. Se detiene el flujo normal de turnos.
2. Comienza a resolver el jugador situado a la derecha del golpeador.
3. Cada jugador puede bajar grupos.
4. Cada jugador puede enchufar cartas.
5. Se cuentan las cartas que continúan en su mano.
6. Se determina si puede cruzarse.
7. Se registra su resultado.
8. Continúa el siguiente jugador hacia la derecha.
9. El golpeador resuelve al final.
10. El golpeador no puede cruzarse.

El golpeador puede aprovechar grupos que otros jugadores hayan bajado durante la resolución.

Esto le permite enchufar cartas antes de contar su puntaje final.

⸻

29. Valores de las cartas

Carta	Puntos
A	11
2	2
3	3
4	4
5	5
6	6
7	7
8	8
9	9
10	10
J	10
Q	10
K	10
Comodín	15

Solo se suman las cartas que continúan en la mano al terminar la resolución.

⸻

30. Cruzarse

Cada jugador puede cruzarse una sola vez durante toda la partida.

Cruzarse registra la ronda como cero puntos.

Para cruzarse deben cumplirse todas estas condiciones:

* El jugador no golpeó.
* El jugador todavía tiene su cruz disponible.
* El puntaje real de la ronda es mayor que cero.
* La suma real no supera 69.
* El jugador no ha volado.

Ejemplo válido:

Puntaje acumulado: 60
Puntaje real de la ronda: 9
Total real: 69

El jugador puede cruzarse.

Su acumulado permanece en 60.

Ejemplo inválido:

Puntaje acumulado: 60
Puntaje real de la ronda: 10
Total real: 70

El jugador ya voló y no puede cruzarse.

Ejemplo sin sentido:

Puntaje real: 0

No puede usar la cruz porque no obtendría ningún beneficio.

Condición:

const realTotal = accumulatedPoints + roundPoints;
const canUseCross =
  !isKnocker &&
  crossAvailable &&
  roundPoints > 0 &&
  realTotal <= 69;

En la tabla, una cruz utilizada se representa con:

X

⸻

31. El golpeador y la cruz

El jugador que golpea nunca puede usar su cruz en esa ronda.

Debe registrar obligatoriamente su puntaje real.

Antes de golpear debe calcular que su total no superará 69.

⸻

32. Empates con el golpeador

Si uno o varios jugadores empatan con el golpeador en puntaje, no ocurre nada especial.

Los puntos se registran normalmente.

La partida continúa mientras queden al menos dos jugadores que no hayan volado.

Un empate no produce codillo.

⸻

33. Volar

Un jugador vuela cuando:

Puntaje acumulado + puntaje de la ronda > 69

Ejemplo:

Acumulado: 62
Puntaje de ronda: 10
Resultado: 72

El jugador vuela.

Cuando un jugador vuela:

* No puede usar su cruz.
* Pierde su condición SIN.
* Pierde para siempre la oportunidad de cruzarse.
* Debe decidir inmediatamente si desea reingresar.
* Si no paga, queda eliminado.
* Si paga y el reingreso está permitido, vuelve en la siguiente ronda.

⸻

34. Reingreso

Un jugador puede reingresar varias veces durante la misma partida.

El reingreso solo es posible si, después de resolver la ronda, quedan al menos dos jugadores que no volaron.

Si queda un solo jugador que no voló:

* La partida termina inmediatamente.
* No se permite reingresar.
* Ese jugador gana.

La decisión de reingreso debe tomarse al finalizar la ronda.

No se puede esperar hasta una ronda posterior.

⸻

35. Puntaje del reingreso

Quien reingresa vuelve con el puntaje acumulado más alto de todos los jugadores que no volaron.

Ejemplo:

Jugador	Puntaje
J1	20
J2	Voló
J3	47
J4	Voló
J5	Voló
J6	Voló

Si J2, J4, J5 o J6 reingresan, todos vuelven con:

47 puntos

No importa:

* Cuántos puntos tenían antes.
* Con cuántos puntos volaron.
* Cuántas veces habían reingresado.

Todos los reingresos de una misma ronda deben calcularse usando el mismo puntaje de referencia.

⸻

36. Cruz después del reingreso

Un jugador que voló pierde definitivamente la cruz.

Aunque nunca la hubiera usado antes de volar:

* No recupera la cruz.
* No puede cruzarse después del reingreso.
* Ya no conserva SIN.

Estado sugerido:

type CrossState = "available" | "used" | "lost_by_flying";

⸻

37. Precio del reingreso

El precio depende de si todavía existe al menos un jugador con SIN.

Existe SIN cuando al menos un jugador activo:

* Nunca utilizó su cruz.
* Nunca voló.

Si todavía existe SIN:

Se paga el monto mayor de reingreso.

Si ya no existe ningún jugador con SIN:

Se paga el monto menor de reingreso.

Ejemplo:

Reingreso con SIN presente: S/ 1.00
Reingreso sin SIN presente: S/ 0.50

⸻

38. Final normal de la partida

Después de resolver todos los puntos de una ronda:

1. Se determina qué jugadores volaron.
2. Se cuenta cuántos jugadores siguen sin volar.
3. Si quedan dos o más, puede ofrecerse reingreso.
4. Si queda solo uno, la partida termina inmediatamente.
5. Nadie puede reingresar.
6. El único jugador que no voló gana el pozo.

Normalmente el ganador final será quien golpeó, porque debe haber calculado que no volaría.

Pero la condición real de victoria es:

Ser el único jugador que no voló después de resolver la ronda.

⸻

39. Victoria con SIN

Un jugador gana con SIN si:

* Gana la partida.
* Nunca utilizó su cruz.
* Nunca voló.
* Nunca reingresó.

Cuando gana con SIN:

* Se lleva todo el pozo.
* Cada uno de los demás participantes debe pagarle un monto adicional equivalente al bono SIN configurado.

Ejemplo con tres jugadores:

Entrada inicial:
3 × S/ 1.00 = S/ 3.00
Un reingreso:
S/ 1.00
Pozo:
S/ 4.00
Bono SIN:
2 rivales × S/ 1.00 = S/ 2.00
Premio total:
S/ 6.00

⸻

40. Codillo

Hay codillo cuando se cumplen todas las siguientes condiciones:

1. Un jugador declara golpe.
2. Al terminar la resolución, el golpeador tiene estrictamente más puntos que todos los demás jugadores.
3. Ningún jugador voló durante esa ronda.

Ejemplo:

Jugador	Puntaje de ronda
Golpeador	15
J2	10
J3	3
J4	12

Es codillo porque el golpeador tiene más puntos que todos.

No hay codillo si:

* Otro jugador empata con el golpeador.
* Otro jugador tiene más puntos que el golpeador.
* Algún jugador vuela en esa ronda.

⸻

41. Consecuencias del codillo

Cuando ocurre codillo:

* El golpeador queda expulsado inmediatamente.
* Sus puntos de esa ronda no se anotan.
* Sus puntos anteriores dejan de importar para la partida actual.
* Pierde cualquier derecho sobre el pozo.
* No puede reingresar en la partida actual.
* Debe pagar las entradas de los jugadores que participen en la siguiente partida.

No está obligado a participar en la siguiente partida.

Si desea participar, también debe cubrir su propia entrada.

Ejemplo:

En la siguiente partida participan 4 personas.
Entrada: S/ 1.00.
Si el jugador del codillo no participa:
Paga S/ 4.00 por los cuatro participantes.
Si también participa:
Paga las entradas de los demás y su propia entrada.

El monto depende exclusivamente de quienes participen efectivamente en la siguiente partida.

⸻

42. Repartidor después de un codillo

Normalmente, quien golpeó reparte la siguiente ronda.

Si el golpeador hizo codillo y quedó expulsado, reparte el jugador situado a su derecha.

Si después del codillo queda un único jugador activo:

* La partida termina.
* Ese jugador gana.

Si quedan al menos dos:

* La partida continúa.
* El jugador de la derecha del expulsado reparte.

⸻

43. Royal

Un royal ocurre cuando un jugador tiene exactamente siete cartas en la mano y todas forman una única escalera del mismo palo.

Puede contener uno o más comodines.

Condiciones:

* Exactamente siete cartas.
* Todas deben estar en la mano.
* No puede haber cartas bajadas formando parte del royal.
* No puede utilizar cartas de grupos visibles.
* No puede utilizar cartas enchufadas.
* Las cartas naturales deben ser del mismo palo.
* Los valores deben formar una escalera consecutiva.
* Puede utilizar el orden circular del as.

Ejemplos válidos:

A, 2, 3, 4, 5, 6, 7
8, 9, 10, J, Q, K, A
K, A, 2, 3, 4, 5, 6

También puede haber comodines:

2, 3, comodín, 5, 6, 7, 8

⸻

44. Declaración del royal

El royal se declara en el momento en que el jugador lo consigue.

Debe tener exactamente siete cartas en mano.

No puede tener:

* Seis cartas.
* Ocho cartas.
* Cartas bajadas que completen el royal.

Puede declararse antes o después de una acción, siempre que en el instante de declararlo tenga exactamente siete cartas válidas en la mano.

La aplicación no debe declararlo automáticamente.

Debe existir un botón:

Declarar royal

Cuando se pulse:

1. El servidor valida la mano.
2. Si es correcta, el jugador gana inmediatamente.
3. Si es incorrecta, la aplicación rechaza la declaración.
4. No hay penalización adicional por un intento incorrecto.

Si el jugador no se da cuenta de que tiene royal, la partida continúa.

⸻

45. Victoria mediante royal

Un royal termina inmediatamente toda la partida.

El jugador:

* Gana el pozo.
* No necesita esperar a que los demás vuelen.
* Recibe el bono SIN si todavía conserva SIN.

No puede construirse usando cartas de la mesa.

⸻

46. Cantar la tabla

Cantar significa consultar o anunciar los puntajes actuales.

La aplicación debe incluir una acción visible llamada:

Cantar

Al activarla se muestra:

* Puntaje acumulado de cada jugador.
* Margen restante hasta 69.
* Estado de la cruz.
* Condición SIN.
* Cantidad de reingresos.
* Estado activo o eliminado.
* Aporte económico total.

Ejemplo:

Jugador	Acumulado	Margen	Cruz	SIN	Estado
Vale	38	31	Disponible	Sí	Activa
Ana	60	9	Usada	No	En riesgo
Luis	47	22	Disponible	Sí	Activo
Pedro	—	—	Perdida	No	Eliminado

La acción de cantar no cambia el turno.

Puede generar un mensaje dentro del historial:

Vale cantó la tabla.
Vale: 38
Ana: 60
Luis: 47
Pedro: eliminado

No es necesario implementar audio en el MVP.

⸻

47. Tabla de puntuaciones

La tabla debe registrar cada ronda.

Representaciones sugeridas:

* Número: puntos registrados.
* X: cruz utilizada.
* V: voló.
* R 47: reingresó con 47 puntos.
* —: eliminado definitivamente.
* C: expulsado por codillo.
* 0: obtuvo cero puntos reales.

Ejemplo:

Ronda	J1	J2	J3	J4
1	10	26	3	18
2	1	X	X	20
Acumulado	11	26	3	38
3	15	22	13	4
Acumulado	26	48	16	42
4	V	10	V	0
Estado	R 58	58	—	42
5	V	V	—	10
Final	—	—	—	52

El historial debe diferenciar claramente entre:

* Volar.
* Reingresar.
* Usar cruz.
* Ser eliminado.
* Ser expulsado por codillo.

⸻

48. Flujo completo de una ronda

1. Se elige al repartidor.
2. El servidor baraja.
3. Otro jugador realiza el corte simbólico.
4. Se reparten siete cartas a cada jugador.
5. El repartidor recibe una octava carta.
6. El repartidor descarta una carta.
7. Los turnos continúan hacia la derecha.
8. Durante la primera vuelta no se puede golpear.
9. Cada jugador elige entre:
   - Robar del mazo.
   - Tomar el descarte para bajarse.
   - Golpear, cuando esté habilitado.
10. Después de robar o tomar el descarte puede:
    - Bajar.
    - Enchufar.
    - Descartar.
11. Si el mazo se acaba, se recicla el descarte.
12. Cuando alguien golpea, se detienen los turnos normales.
13. Comienza a resolver el jugador a su derecha.
14. Cada jugador baja y enchufa lo que pueda.
15. Se calcula el puntaje en mano.
16. Se ofrece la cruz cuando corresponde.
17. El golpeador resuelve al final y no puede cruzarse.
18. Se calculan los resultados reales.
19. Se valida si existe codillo.
20. Se determinan los jugadores que volaron.
21. Si queda uno solo sin volar, gana.
22. Si quedan al menos dos, se ofrecen reingresos.
23. Los reingresados reciben el puntaje máximo de los no volados.
24. Se suma el dinero al pozo.
25. Quien golpeó reparte la siguiente ronda.
26. Si hizo codillo, reparte el jugador de su derecha.

⸻

49. Flujo completo de la partida

1. Se crea una sala.
2. Entran entre 3 y 8 jugadores.
3. Se configura la apuesta.
4. Todos confirman su entrada.
5. Se elige el primer repartidor.
6. Se juegan rondas sucesivas.
7. Los puntajes se acumulan.
8. Los jugadores pueden usar una cruz.
9. Los jugadores vuelan al superar 69.
10. Los jugadores volados pueden reingresar si quedan al menos dos no volados.
11. La partida continúa hasta que:
    - Solo queda un jugador sin volar.
    - Un jugador consigue royal.
12. Se calcula el ganador.
13. Se calcula si ganó con SIN.
14. Se muestran el pozo, los bonos y las deudas.
15. Se registra el historial.
16. Se prepara una posible siguiente partida.
17. Si hubo codillo, se registra la deuda de entradas correspondiente.

⸻

50. Estados del jugador

Modelo sugerido:

type PlayerStatus =
  | "waiting"
  | "active"
  | "resolving_after_knock"
  | "flown_pending_reentry"
  | "reentering"
  | "eliminated"
  | "codillo_eliminated"
  | "winner";
type CrossState =
  | "available"
  | "used"
  | "lost_by_flying";
type PlayerGameState = {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  seatIndex: number;
  status: PlayerStatus;
  accumulatedPoints: number;
  currentRoundPoints: number | null;
  hand: Card[];
  crossState: CrossState;
  hasEverFlown: boolean;
  reentryCount: number;
  totalPaid: number;
  totalWon: number;
  hasCompletedFirstTurn: boolean;
};

La condición SIN puede calcularse:

function hasSin(player: PlayerGameState): boolean {
  return (
    player.crossState === "available" &&
    !player.hasEverFlown
  );
}

⸻

51. Estados de la partida

type GamePhase =
  | "lobby"
  | "waiting_for_entries"
  | "shuffling"
  | "cutting"
  | "dealing"
  | "playing"
  | "resolving_knock"
  | "checking_codillo"
  | "checking_flown_players"
  | "waiting_for_reentry_decisions"
  | "starting_next_round"
  | "finished";
type GameState = {
  gameId: string;
  roomCode: string;
  phase: GamePhase;
  players: PlayerGameState[];
  activePlayerId: string | null;
  dealerPlayerId: string;
  knockerPlayerId: string | null;
  drawPile: Card[];
  discardPile: Card[];
  tableGroups: TableGroup[];
  roundNumber: number;
  potAmount: number;
  bettingConfig: BettingConfig;
  winnerPlayerId: string | null;
  winType: "normal" | "sin" | "royal" | "royal_with_sin" | null;
};

⸻

52. Grupos de la mesa

type TableGroupType = "same_rank" | "straight";
type TableCard = {
  card: Card;
  ownerPlayerId: string;
  jokerRepresentsRank?: Card["rank"];
};
type TableGroup = {
  id: string;
  type: TableGroupType;
  cards: TableCard[];
  createdByPlayerId: string;
  locked: boolean;
};

locked puede utilizarse para impedir reorganizaciones no permitidas.

⸻

53. Eventos del juego

La aplicación debería manejar el juego mediante eventos controlados por el servidor.

type GameEvent =
  | { type: "PLAYER_JOINED"; playerId: string }
  | { type: "PLAYER_CONFIRMED_ENTRY"; playerId: string }
  | { type: "DECK_SHUFFLED" }
  | { type: "DECK_CUT"; playerId: string }
  | { type: "CARDS_DEALT" }
  | { type: "CARD_DRAWN"; playerId: string }
  | { type: "DISCARD_TAKEN"; playerId: string }
  | { type: "GROUP_LAID_DOWN"; playerId: string; groupId: string }
  | { type: "CARD_ATTACHED"; playerId: string; groupId: string }
  | { type: "CARD_DISCARDED"; playerId: string }
  | { type: "KNOCK_DECLARED"; playerId: string }
  | { type: "CROSS_USED"; playerId: string }
  | { type: "PLAYER_FLEW"; playerId: string }
  | { type: "PLAYER_REENTERED"; playerId: string; score: number }
  | { type: "PLAYER_ELIMINATED"; playerId: string }
  | { type: "CODILLO_DECLARED"; playerId: string }
  | { type: "ROYAL_DECLARED"; playerId: string }
  | { type: "SCOREBOARD_SUNG"; playerId: string }
  | { type: "GAME_FINISHED"; winnerPlayerId: string };

⸻

54. Autoridad del servidor

El servidor debe ser la única fuente de verdad.

El cliente nunca debe decidir por sí solo:

* Qué carta se roba.
* Si un grupo es válido.
* Si una escalera es válida.
* Si una cruz puede utilizarse.
* Si un jugador voló.
* Si existe codillo.
* Si existe royal.
* Cuánto cuesta el reingreso.
* Cuál es el puntaje de reingreso.
* Quién gana.
* Cuánto dinero corresponde a cada jugador.

El cliente solo solicita acciones.

El servidor las valida y emite el nuevo estado.

⸻

55. Sincronización online

La aplicación debe ser en tiempo real.

Todos los jugadores deben recibir inmediatamente:

* Cambio de turno.
* Descartes.
* Grupos bajados.
* Cartas enchufadas.
* Golpe.
* Cierre de ronda.
* Puntajes.
* Cruces.
* Reingresos.
* Cantar.
* Royal.
* Codillo.
* Victoria.

Las cartas privadas de cada jugador solo deben enviarse a su propietario.

Los demás jugadores solo deben ver:

* Cantidad de cartas.
* Reverso de las cartas.
* Cartas visibles sobre la mesa.

⸻

56. Desconexiones

Si un jugador se desconecta:

* Su asiento debe mantenerse reservado.
* Debe poder reconectarse.
* La partida debe recuperar su estado.
* Sus cartas deben seguir protegidas.
* Puede establecerse un tiempo máximo de espera.

Para el MVP se recomienda:

Esperar hasta 60 segundos.

Después, el anfitrión podría:

* Pausar la partida.
* Esperar.
* Expulsar al jugador.
* Reemplazarlo por un bot en una versión futura.

Los bots no son necesarios en la primera versión.

⸻

57. Pantallas principales

57.1 Pantalla de inicio

Debe incluir:

* Crear sala.
* Unirse a sala.
* Historial.
* Perfil.
* Cómo jugar.

57.2 Crear sala

Campos:

* Nombre de sala.
* Número máximo de jugadores.
* Moneda.
* Entrada inicial.
* Reingreso con SIN.
* Reingreso sin SIN.
* Bono SIN.
* Tiempo por turno.
* Sala privada.

57.3 Lobby

Debe mostrar:

* Código de sala.
* Jugadores conectados.
* Avatares.
* Confirmación de entrada.
* Configuración de apuestas.
* Botón iniciar.
* Chat o reacciones.

57.4 Mesa de juego

Debe mostrar:

* Mano del jugador.
* Mazo.
* Descarte.
* Grupos visibles.
* Jugadores alrededor de la mesa.
* Puntaje acumulado.
* Margen hasta 69.
* Estado de cruz.
* Estado SIN.
* Turno actual.
* Pozo.
* Botón robar.
* Botón tomar descarte.
* Botón golpear.
* Botón cantar.
* Botón declarar royal.
* Historial breve.

57.5 Resolución del golpe

Debe guiar a cada jugador de forma secuencial.

Acciones:

* Bajar grupo.
* Enchufar.
* Confirmar cartas restantes.
* Ver puntaje.
* Usar cruz, cuando esté disponible.
* Confirmar resultado.

57.6 Reingreso

Debe mostrar:

* Que el jugador voló.
* Su puntaje real.
* Precio de reingreso.
* Si todavía existe SIN.
* Puntaje con el que volvería.
* Botón reingresar.
* Botón retirarse.

57.7 Final de partida

Debe mostrar:

* Ganador.
* Tipo de victoria.
* Puntaje final.
* Pozo.
* Bono SIN.
* Pagos pendientes.
* Reingresos.
* Historial.
* Nueva partida.
* Salir.

⸻

58. Experiencia visual

La interfaz debe sentirse:

* Familiar.
* Moderna.
* Divertida.
* Competitiva.
* Clara.
* Fácil de entender.

No debe parecer una aplicación de apuestas o casino agresivo.

El dinero debe mostrarse como contabilidad familiar, no como incentivo de juego monetario.

Estilo sugerido:

* Mesa de cartas elegante.
* Colores vivos pero no saturados.
* Avatares familiares.
* Animaciones suaves.
* Cartas grandes y legibles.
* Indicadores claros de turno.
* Reacciones rápidas.
* Sonidos opcionales.

⸻

59. Accesibilidad

La aplicación debe incluir:

* Tamaños de texto escalables.
* Buen contraste.
* No depender solo del color.
* Etiquetas para lectores de pantalla.
* Vibración opcional.
* Sonido opcional.
* Reducción de animaciones.
* Confirmaciones en acciones importantes.
* Botones táctiles amplios.

⸻

60. Arquitectura recomendada

Aplicación móvil

* React Native.
* Expo.
* TypeScript.
* Expo Router.
* React Native Reanimated.
* React Native Gesture Handler.
* Zustand para estado local de interfaz.
* TanStack Query para datos remotos.
* Zod para validaciones.

Backend

Opción recomendada para MVP:

* Supabase Auth.
* Supabase PostgreSQL.
* Supabase Realtime.
* Edge Functions para validaciones simples.

Para una versión más robusta del juego:

* Node.js.
* NestJS o Fastify.
* WebSockets con Socket.IO.
* PostgreSQL.
* Redis para sesiones de partida.
* Supabase únicamente para autenticación y persistencia.

Pruebas

* Vitest.
* React Native Testing Library.
* Pruebas unitarias del motor de reglas.
* Pruebas de integración de rondas.
* Pruebas E2E con Maestro o Detox.

⸻

61. Separación del motor de juego

Las reglas deben estar en un paquete independiente de React Native.

Estructura sugerida:

apps/
  mobile/
packages/
  game-engine/
  shared-types/
  validation/
  ui/

El paquete game-engine no debe depender de:

* React.
* React Native.
* Expo.
* Base de datos.
* WebSockets.

Debe contener funciones puras para:

* Calcular puntos.
* Validar grupos.
* Validar escaleras.
* Validar comodines.
* Validar royal.
* Validar golpe.
* Validar cruz.
* Detectar vuelos.
* Calcular reingresos.
* Detectar codillo.
* Determinar ganador.
* Calcular pagos.

⸻

62. Funciones esenciales del motor

calculateCardPoints(card: Card): number;
calculateHandPoints(cards: Card[]): number;
validateSameRankGroup(cards: Card[]): ValidationResult;
validateStraightGroup(cards: Card[]): ValidationResult;
validateGroup(cards: Card[]): ValidationResult;
validateRoyal(cards: Card[]): ValidationResult;
canTakeDiscard(
  hand: Card[],
  topDiscard: Card,
  proposedGroup: Card[]
): ValidationResult;
canKnock(
  player: PlayerGameState,
  handPoints: number,
  roundState: RoundState
): ValidationResult;
canUseCross(
  player: PlayerGameState,
  roundPoints: number
): ValidationResult;
detectFlownPlayers(
  players: PlayerGameState[],
  roundResults: RoundResult[]
): string[];
detectCodillo(
  knockerId: string,
  results: RoundResult[],
  flownPlayerIds: string[]
): boolean;
calculateReentryScore(
  nonFlownPlayers: PlayerGameState[]
): number;
calculateReentryPrice(
  players: PlayerGameState[],
  config: BettingConfig
): number;
determineWinner(
  players: PlayerGameState[]
): string | null;
calculateGameSettlement(
  game: GameState
): GameSettlement;

⸻

63. Casos de prueba mínimos

Grupos del mismo número

[2♥, 2♣, 2♠] → válido
[2♥, 2♥, 2♠] → válido
[2♥, 2♣] → inválido
[2♥, 2♣, joker] → inválido

Escaleras

[A♥, 2♥, 3♥] → válida
[Q♥, K♥, A♥] → válida
[K♥, A♥, 2♥] → válida
[10♥, J♥, Q♥, K♥, A♥, 2♥, 3♥] → válida
[4♥, 4♥, 5♥] → inválida
[4♥, 5♣, 6♥] → inválida

Comodines

[2♥, joker, 4♥] → válida
[2♥, joker, 4♣] → inválida
[8♥, 8♣, joker] → inválida

Golpe

Acumulado 38 + mano 31 → puede golpear
Acumulado 38 + mano 32 → no puede golpear
Primera vuelta sin completar → no puede golpear
Después de robar → no puede golpear

Cruz

Acumulado 60 + ronda 9 → puede cruzarse
Acumulado 60 + ronda 10 → no puede cruzarse
Ronda 0 → no puede cruzarse
Golpeador → no puede cruzarse
Cruz ya utilizada → no puede cruzarse
Jugador que ya voló → no puede cruzarse

Reingreso

Activos con 20, 47 y 35 → reingreso en 47
Solo queda un jugador sin volar → no se permite reingreso
Jugador reingresado → sin cruz

Codillo

Golpeador 15, otros 10, 12 y 3, nadie vuela → codillo
Golpeador 15, otro 15 → no codillo
Golpeador 15, otro 16 → no codillo
Golpeador 15, todos menores, alguien vuela → no codillo

Royal

7 cartas del mismo palo en escalera → royal
7 cartas con comodines válidos → royal
8 cartas → no royal
6 cartas → no royal
7 cartas de diferentes palos → no royal
Cartas bajadas + cartas en mano → no royal

⸻

64. MVP recomendado

La primera versión debe incluir:

* Registro simple.
* Crear sala.
* Unirse con código.
* Entre 3 y 8 jugadores.
* Juego en tiempo real.
* Dos barajas y comodines.
* Reparto.
* Robar.
* Tomar descarte.
* Bajar grupos.
* Enchufar.
* Descartar.
* Golpear.
* Resolución de ronda.
* Puntajes.
* Cruz.
* Volar.
* Reingresar.
* SIN.
* Codillo.
* Royal.
* Cantar.
* Pozo virtual.
* Historial básico.
* Reconexión.

No incluir inicialmente:

* Dinero real.
* Videollamada.
* Bots avanzados.
* Ranking público.
* Matchmaking con desconocidos.
* Torneos.
* Mercado de objetos.
* Publicidad.
* Compras dentro de la aplicación.

⸻

65. Prompt maestro para crear la aplicación

Instrucciones generales

Actúa como un equipo senior compuesto por:

* Product designer.
* Diseñador UX/UI de juegos móviles.
* Arquitecto de software.
* Desarrollador React Native senior.
* Desarrollador backend especializado en tiempo real.
* Ingeniero de pruebas.
* Especialista en seguridad.

Quiero crear una aplicación móvil llamada SIN, basada en un juego de cartas familiar.

La aplicación debe permitir jugar online en tiempo real con familiares y amigos.

Utiliza:

* React Native.
* Expo.
* TypeScript estricto.
* Expo Router.
* React Native Reanimated.
* React Native Gesture Handler.
* Zustand para estado local.
* TanStack Query para estado remoto.
* Zod para validación.
* Supabase para autenticación, PostgreSQL y persistencia.
* WebSockets o Supabase Realtime para sincronización.
* Vitest para el motor del juego.
* React Native Testing Library para componentes.

El motor de reglas debe implementarse en un paquete TypeScript independiente y no debe depender de React Native.

No generes una aplicación monolítica.

No mezcles las reglas del juego con los componentes visuales.

No confíes en el cliente para validar acciones.

El servidor debe ser la única fuente de verdad.

Antes de escribir código:

1. Analiza el reglamento completo.
2. Identifica estados, entidades y eventos.
3. Diseña la máquina de estados.
4. Propón la arquitectura.
5. Propón el modelo de datos.
6. Divide el desarrollo por fases.
7. Enumera riesgos y casos límite.
8. No inventes reglas que no estén documentadas.
9. Si una regla presenta una contradicción, señala el conflicto antes de implementarla.

⸻

Reglas completas del juego

SIN se juega entre 3 y 8 jugadores.

Se utilizan dos barajas completas con comodines.

Cada jugador recibe siete cartas.

El repartidor recibe ocho y empieza descartando una.

Los turnos avanzan hacia la derecha.

Durante la primera vuelta no se puede golpear.

En su turno un jugador debe elegir exclusivamente entre:

* Robar una carta del mazo.
* Tomar la carta superior del descarte para bajarse.
* Declarar golpe.

Si roba o toma el descarte, no puede golpear en ese mismo turno.

Si toma la carta superior del descarte:

* No puede guardarla en su mano.
* Debe utilizarla inmediatamente dentro del grupo con el que se baja.
* Solo puede tomar la carta superior.
* Después puede bajar otros grupos o enchufar.
* Debe terminar descartando.

Los grupos válidos tienen un mínimo de tres cartas.

Un grupo del mismo valor puede contener cartas duplicadas exactas porque existen dos barajas.

No tiene un máximo especial.

El comodín no puede usarse en grupos del mismo valor.

Una escalera debe:

* Tener al menos tres cartas.
* Ser del mismo palo.
* Tener valores consecutivos.
* No repetir valores.

El as funciona circularmente.

Son válidas:

* Q-K-A.
* K-A-2.
* A-2-3.
* 10-J-Q-K-A-2-3.

Una escalera no puede repetir valores ni completar más de una vuelta completa.

El comodín puede utilizarse en escaleras.

Puede sustituir cartas faltantes.

Si permanece en la mano vale 15 puntos.

Un comodín visible solo puede moverse mientras esté en un extremo.

Cuando queda encerrado entre cartas naturales, ya no puede moverse.

No se permite desmontar ni reorganizar grupos.

Solo se permite extenderlos o enchufar cartas.

Un jugador puede quedarse sin cartas en la mano al bajar o enchufar sus siete cartas.

No gana inmediatamente.

Debe esperar hasta su siguiente turno y declarar golpe.

En ese caso obtiene cero puntos.

Si el mazo se agota:

* Se conserva la carta superior del descarte.
* Se baraja el resto del descarte.
* Se convierte en el nuevo mazo.

Golpear termina la ronda.

Solo se puede golpear:

* En el turno propio.
* Después de la primera vuelta.
* Sin haber robado.
* Sin haber tomado el descarte.
* Cuando el puntaje acumulado más el puntaje de la mano no supera 69.

Después de un golpe:

* Resuelve primero el jugador a la derecha del golpeador.
* Continúan todos hacia la derecha.
* El golpeador resuelve al final.
* Los jugadores pueden bajar y enchufar.
* Se cuentan las cartas restantes.
* El golpeador no puede cruzarse.

Puntajes:

* A = 11.
* 2 a 9 = valor numérico.
* 10 = 10.
* J = 10.
* Q = 10.
* K = 10.
* Comodín = 15.

Cada jugador puede cruzarse una sola vez.

La cruz registra la ronda como cero.

Solo puede cruzarse cuando:

* No fue quien golpeó.
* Conserva su cruz.
* Su puntaje real es mayor que cero.
* Su acumulado más el puntaje real no supera 69.
* Nunca ha volado.

Si supera 69, vuela antes de poder cruzarse.

Cuando un jugador vuela:

* Pierde la cruz.
* Pierde SIN.
* Decide inmediatamente si reingresa.
* Puede reingresar varias veces.
* Solo puede reingresar si quedan al menos dos jugadores que no volaron.

Si queda un solo jugador sin volar:

* La partida termina.
* Nadie puede reingresar.

El jugador que reingresa vuelve con el puntaje acumulado más alto de los jugadores que no volaron.

Todos los jugadores que reingresan en una misma ronda vuelven con el mismo puntaje.

Quien reingresa nunca recupera la cruz.

El precio del reingreso depende de si existe SIN.

Existe SIN si al menos un jugador activo:

* Nunca usó su cruz.
* Nunca voló.

Si existe SIN, se paga el reingreso mayor.

Si no existe SIN, se paga el reingreso menor.

La partida termina cuando queda un solo jugador que no voló.

El ganador se lleva el pozo.

Si nunca usó su cruz y nunca voló, gana con SIN.

Cuando gana con SIN, cada rival le paga un bono adicional.

Existe codillo cuando:

* Un jugador golpea.
* Tiene estrictamente más puntos que todos los demás.
* Nadie vuela en esa ronda.

En caso de codillo:

* El golpeador queda expulsado.
* Sus puntos de la ronda no se anotan.
* Pierde derecho al pozo.
* No puede reingresar en esa partida.
* Debe pagar las entradas de las personas que participen en la siguiente partida.
* No está obligado a participar.
* Si participa, también cubre su propia entrada.

Después de un codillo reparte el jugador situado a la derecha del expulsado.

Si solo queda un jugador activo, ese jugador gana.

Existe royal cuando un jugador tiene exactamente siete cartas en la mano formando una escalera del mismo palo.

Puede contener comodines.

No puede construirse usando cartas bajadas ni cartas de la mesa.

Se declara mediante una acción explícita.

El servidor debe validar la mano.

Si es válido:

* Gana inmediatamente la partida.
* Recibe el pozo.
* Recibe bono SIN si corresponde.

Si es inválido:

* La aplicación rechaza la declaración.
* No aplica penalización.

La acción cantar muestra:

* Puntaje acumulado.
* Margen hasta 69.
* Estado de cruz.
* Condición SIN.
* Estado activo o eliminado.
* Reingresos.
* Aportes al pozo.

⸻

Sistema de apuestas

La aplicación no debe procesar dinero real.

Debe funcionar como registro de pagos y deudas.

Configuración:

type BettingConfig = {
  currencyCode: string;
  currencySymbol: string;
  initialEntryAmount: number;
  reentryWithSinAmount: number;
  reentryWithoutSinAmount: number;
  sinBonusAmountPerOpponent: number;
};

Debe mostrar:

* Aporte inicial.
* Aportes por reingreso.
* Pozo acumulado.
* Bono SIN.
* Penalización futura por codillo.
* Balance final por jugador.

⸻

Entregables solicitados

Genera los entregables en este orden:

Fase 1: análisis funcional

* Resumen del producto.
* Actores.
* Casos de uso.
* Reglas.
* Casos límite.
* Máquina de estados.
* Diagrama textual del flujo.
* Criterios de aceptación.

Fase 2: arquitectura

* Estructura del monorepo.
* Separación frontend, backend y motor.
* Modelo de datos.
* Contratos TypeScript.
* Eventos de WebSocket.
* Estrategia de reconexión.
* Seguridad.
* Control de concurrencia.

Fase 3: UX/UI

* Sitemap.
* Flujos de usuario.
* Wireframes textuales.
* Diseño de la mesa.
* Diseño de la mano.
* Estados de botones.
* Resolución del golpe.
* Reingreso.
* Codillo.
* Royal.
* Cantar.
* Final de partida.
* Accesibilidad.

Fase 4: motor del juego

Implementa primero:

* Tipos.
* Puntajes.
* Validación de grupos.
* Validación de escaleras circulares.
* Comodines.
* Royal.
* Golpe.
* Cruz.
* Vuelo.
* Reingreso.
* SIN.
* Codillo.
* Ganador.
* Liquidación de pagos.

Incluye pruebas exhaustivas.

Fase 5: backend

Implementa:

* Autenticación.
* Salas.
* Jugadores.
* Estado de partida.
* Acciones validadas.
* Sincronización.
* Persistencia.
* Reconexión.
* Protección de manos privadas.
* Historial.

Fase 6: aplicación móvil

Implementa:

* Inicio.
* Crear sala.
* Unirse.
* Lobby.
* Mesa.
* Mano.
* Grupos.
* Acciones.
* Tabla.
* Cantar.
* Resolución.
* Reingreso.
* Final.
* Historial.

Fase 7: calidad

Incluye:

* Pruebas unitarias.
* Pruebas de integración.
* Pruebas E2E.
* Manejo de errores.
* Logging.
* Analítica.
* Accesibilidad.
* Rendimiento.

No intentes construir todas las fases a la vez.

Empieza por el análisis funcional y la arquitectura.

Espera a que cada fase sea revisada antes de continuar con la siguiente.

⸻

66. Prompt para generar solamente el motor del juego

Actúa como un ingeniero senior de TypeScript especializado en motores de juegos deterministas.

Crea un paquete llamado:

@sin/game-engine

El paquete debe:

* Usar TypeScript estricto.
* No depender de React.
* No depender de React Native.
* No depender de una base de datos.
* No depender de WebSockets.
* Utilizar funciones puras.
* Ser completamente testeable con Vitest.
* No mutar el estado recibido.
* Devolver errores tipados.
* Mantener un historial de eventos.
* Ser determinista excepto en la función de barajado.

Implementa:

1. Tipos de cartas.
2. Creación de dos barajas.
3. Barajado con semilla opcional.
4. Reparto.
5. Puntaje.
6. Grupos del mismo valor.
7. Escaleras circulares.
8. Comodines.
9. Movimiento permitido del comodín.
10. Bajadas.
11. Enchufes.
12. Descartes.
13. Reciclaje del descarte.
14. Primera vuelta.
15. Golpe.
16. Resolución.
17. Cruz.
18. Vuelo.
19. Reingreso.
20. SIN.
21. Codillo.
22. Royal.
23. Cantar.
24. Ganador.
25. Pagos.

Incluye pruebas de todos los casos documentados.

No inventes reglas.

Cuando una acción sea inválida, devuelve:

type GameRuleError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

Utiliza un resultado tipado:

type Result<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: GameRuleError;
    };

El motor debe procesar comandos:

type GameCommand =
  | DrawCardCommand
  | TakeDiscardCommand
  | LayDownGroupCommand
  | AttachCardCommand
  | DiscardCardCommand
  | KnockCommand
  | UseCrossCommand
  | ReenterCommand
  | DeclareRoyalCommand
  | SingScoreboardCommand;

Cada comando debe devolver:

* Nuevo estado.
* Eventos generados.
* Error si la acción no es válida.

Incluye ejemplos de uso y documentación técnica.

⸻

67. Prompt para diseñar la experiencia UX/UI

Actúa como un diseñador UX/UI senior especializado en juegos móviles multijugador.

Diseña la aplicación móvil SIN.

El juego es familiar, competitivo y tiene un sistema de puntos, cruces, reingresos y apuestas virtuales.

La experiencia debe ser clara incluso para familiares que no estén acostumbrados a aplicaciones complejas.

Diseña:

* Pantalla de inicio.
* Crear sala.
* Unirse con código.
* Lobby.
* Mesa de juego.
* Mano del jugador.
* Mazo.
* Descarte.
* Grupos visibles.
* Enchufar cartas.
* Golpear.
* Cantar.
* Declarar royal.
* Resolución de ronda.
* Uso de cruz.
* Pantalla de vuelo.
* Reingreso.
* Codillo.
* Victoria normal.
* Victoria SIN.
* Victoria royal.
* Historial.
* Pagos pendientes.

Requisitos:

* React Native.
* Orientación vertical como prioridad.
* Adaptable a tablets.
* Una sola mano visible.
* Los rivales muestran cartas boca abajo.
* Las cartas deben ser legibles.
* Las acciones principales deben estar al alcance del pulgar.
* Debe quedar claro cuándo es el turno del usuario.
* Debe mostrar el margen restante hasta 69.
* No debe revelar cartas privadas.
* Debe permitir seleccionar varias cartas.
* Debe permitir bajar y enchufar sin gestos demasiado complejos.
* Debe existir una alternativa a arrastrar cartas.
* Debe haber confirmación para golpe, cruz, reingreso y royal.
* Debe existir modo con animaciones reducidas.
* No debe tener estética agresiva de casino.

Entrega:

* Principios de diseño.
* Arquitectura de información.
* Flujos.
* Wireframes textuales.
* Componentes.
* Estados vacíos.
* Estados de error.
* Microcopys.
* Accesibilidad.
* Sistema visual.
* Tokens de diseño.
* Propuesta para móvil pequeño y tablet.

⸻

68. Prompt para generar el backend en tiempo real

Actúa como un arquitecto backend senior especializado en juegos multijugador por turnos.

Diseña e implementa el backend de SIN.

Tecnologías sugeridas:

* Node.js.
* TypeScript.
* Fastify o NestJS.
* Socket.IO.
* PostgreSQL.
* Redis.
* Supabase Auth.

Requisitos:

* Servidor autoritativo.
* Todas las reglas validadas en backend.
* Ninguna carta privada enviada a otros jugadores.
* Control de versiones del estado.
* Prevención de acciones duplicadas.
* Idempotencia.
* Reconexión.
* Historial de eventos.
* Persistencia.
* Recuperación después de caída.
* Transacciones.
* Bloqueo optimista o pesimista.
* Control de turno.
* Validación con Zod.
* Logs estructurados.
* Pruebas de integración.

Diseña:

* Entidades.
* Tablas.
* Eventos.
* Comandos.
* Protocolo de sincronización.
* Snapshots.
* Event log.
* Reintentos.
* Sala.
* Partida.
* Ronda.
* Mano privada.
* Grupos.
* Descarte.
* Puntajes.
* Cruz.
* Vuelos.
* Reingresos.
* Pozo.
* Codillo.
* Royal.
* Cantar.
* Liquidación final.

No implementes la lógica del juego directamente en el controlador.

Utiliza el paquete independiente:

@sin/game-engine

El backend recibe comandos, valida autorización, ejecuta el motor, persiste el resultado y publica eventos.

⸻

69. Criterios de aceptación del MVP

La aplicación se considera funcional cuando:

1. Pueden entrar entre 3 y 8 jugadores.
2. Todos ven el mismo estado de la mesa.
3. Cada jugador solo ve su propia mano.
4. Se reparten correctamente las cartas.
5. El repartidor recibe ocho.
6. El repartidor descarta primero.
7. No se puede golpear durante la primera vuelta.
8. Solo puede actuar el jugador en turno.
9. El descarte solo puede recogerse para bajarse.
10. Los grupos se validan correctamente.
11. Las cartas duplicadas se permiten en grupos del mismo valor.
12. No se permiten valores repetidos en escaleras.
13. El as funciona circularmente.
14. Los comodines funcionan correctamente.
15. No se pueden desmontar grupos.
16. Se puede enchufar.
17. Se puede quedar sin cartas y golpear al siguiente turno.
18. El mazo se recicla.
19. El golpe inicia la resolución.
20. El golpeador resuelve al final.
21. El golpeador no puede cruzarse.
22. La cruz solo puede utilizarse si no se vuela.
23. El puntaje se acumula.
24. Se detectan vuelos.
25. Se ofrecen reingresos correctamente.
26. Los reingresados reciben el puntaje máximo.
27. Los reingresados pierden la cruz.
28. Se calcula correctamente el precio del reingreso.
29. Se detecta SIN.
30. Se detecta codillo.
31. Se aplica la expulsión por codillo.
32. Se registra la deuda para la siguiente partida.
33. Se valida royal.
34. Royal termina la partida.
35. Cantar muestra la tabla.
36. Se detecta correctamente al ganador.
37. Se calcula el pozo.
38. Se calcula el bono SIN.
39. La partida puede recuperarse después de una desconexión.
40. Existe un historial completo de acciones.
