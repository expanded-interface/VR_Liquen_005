# Modelos GLB/GLTF (opcionales)

Hoy todos los modelos son procedurales (`js/mundo/`). Para reemplazar alguno por un GLB:

| Archivo sugerido | Reemplaza | Dónde se activa |
| --- | --- | --- |
| `liquen.glb` | talo folioso procedural (`js/mundo/liquen.js`) | `MODELOS.liquen.url` en `js/config.js` |
| `roca.glb` | roca madre procedural (`js/mundo/paisaje.js`) | `MODELOS.roca.url` en `js/config.js` |

Indicaciones:

- Origen del liquen en el centro de su base; diámetro real ~34 cm (o usar `escala`).
- Origen de la roca en el suelo; la cara superior debe quedar a ~55 cm (`LUGAR.rocaAltura`).
- Comprimir geometría con Draco o meshopt y texturas con KTX2 cuando sea posible; apuntar a <20 k triángulos por modelo.
- El GLB del liquen crece por escala; pierde el crecimiento radial y el detalle fino del shader procedural.
  Si se quiere conservar ese efecto, conviene aplicar `talo.material` del procedural al GLB.
- La fauna (`js/mundo/fauna.js`) también puede sustituirse por GLB siguiendo el mismo patrón
  (`js/sistemas/modelos.js → modeloOProcedural`).
