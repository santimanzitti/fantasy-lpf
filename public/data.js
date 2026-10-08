// Catálogo: 30 clubes de la Liga Profesional 2026 (Clausura). Valores iniciales en millones de euros,
// aproximados a las cotizaciones de Transfermarkt; el administrador puede corregirlos desde la app.
// Formato jugador: Nombre|Pos|Valor   (Pos: P=arquero, D=defensor, M=mediocampista, F=delantero)
const TEAMS = [];
function T(id, name, short, c1, c2, txt, style, list) {
  TEAMS.push({ id, name, short, c1, c2, txt, style,
    players: list.trim().split(';').map(s => s.trim()).filter(Boolean).map(s => { const [n, p, v] = s.split('|'); return [n.trim(), p.trim(), parseFloat(v)]; }) });
}
T('riv','River Plate','RIV','#ffffff','#e30613','#e30613','sash',`
Franco Armani|P|0.6;Santiago Beltrán|P|3.5;Jeremías Ledesma|P|0.8;
Lautaro Rivero|D|7;Lucas Martínez Quarta|D|6;Paulo Díaz|D|4;Gonzalo Montiel|D|3;Fabricio Bustos|D|2.2;Marcos Acuña|D|1.2;Matías Viña|D|2;Juan Portillo|D|1.5;
Aníbal Moreno|M|11;Kevin Castaño|M|7;Fausto Vera|M|5;Giuliano Galoppo|M|3.5;Santiago Lencina|M|4;Ian Subiabre|M|6;Tomás Galván|M|2.5;Tobías Andrada|M|2.5;Juan Fernando Quintero|M|1;
Facundo Colidio|F|5;Sebastián Driussi|F|4;Joaquín Freitas|F|2.5;Agustín Ruberto|F|1.5`);
T('boc','Boca Juniors','BOC','#0b3d91','#f5c400','#f5c400','band',`
Agustín Marchesín|P|0.8;Álvaro Montero|P|3.5;Leandro Brey|P|2;
Ayrton Costa|D|4;Lautaro Di Lollo|D|5;Leandro Lozano|D|3;Marco Pellegrino|D|3;Nicolás Figal|D|1.8;Lautaro Blanco|D|3;Luis Advíncula|D|0.8;Dylan Gorosito|D|1;
Milton Delgado|M|8;Leandro Paredes|M|5;Kevin Zenón|M|5;Santiago Ascacibar|M|3.5;Carlos Palacios|M|3;Tomás Aranda|M|5;Tomás Belmonte|M|1.8;Rodrigo Battaglia|M|1.5;Alan Velasco|M|4;
Miguel Merentiel|F|5;Milton Giménez|F|3.5;Sebastián Villa|F|3;Enner Valencia|F|1;Adam Bareiro|F|2.5`);
T('rac','Racing Club','RAC','#6cace4','#ffffff','#0b2a4a','stripes',`
Facundo Cambeses|P|3;Gabriel Arias|P|1.5;
Marco Di Cesare|D|4;Gastón Martirena|D|3.5;Gabriel Rojas|D|2;Agustín García Basso|D|1.2;Marcos Rojo|D|0.6;Alfonso Espino|D|1;Juan Barinaga|D|2.5;Matías Pérez|D|3;Facundo Mura|D|2;
Santiago Sosa|M|9;Juan Nardoni|M|9;Matías Zaracho|M|3.5;Gastón Lodico|M|2.5;Ulises Ortegoza|M|2;Matías Kranevitter|M|1;Leonel Pérez|M|1.5;Bruno Zuculini|M|0.8;Duván Vergara|M|3;Tomás Conechny|M|2.5;
Adrián Martínez|F|4;Lautaro Díaz|F|2.5;Elías Torres|F|2.5;Leandro Córdoba|F|1.2`);
T('ind','Independiente','IND','#d5001c','#d5001c','#ffffff','solid',`
Rodrigo Rey|P|2.5;Santiago Mele|P|3;
Felipe Loyola|D|8;Sebastián Valdez|D|2;Juan Fedorco|D|2;Franco Calderón|D|1.2;Facundo Zabala|D|2;Federico Vera|D|1.5;Leonardo Godoy|D|1;
Santiago Montiel|M|5;Lautaro Millán|M|6;Luciano Cabral|M|3;Matías Abaldo|M|3;Iván Marcone|M|1.5;Maximiliano Meza|M|1;Pablo Galdames|M|1.2;
Ezequiel Ávila|F|1;Iván Morales|F|2;Imanol Machuca|F|2;Diego Tarzia|F|1.5;Matías Giménez Rojas|F|1`);
T('slo','San Lorenzo','SLO','#002f6c','#c8102e','#ffffff','stripes',`
Orlando Gill|P|3;Facundo Altamirano|P|0.8;
Gastón Hernández|D|2.5;Jhohan Romaña|D|2;Elías Báez|D|1.5;Danilo Arboleda|D|0.8;Emiliano Amor|D|0.6;Ezequiel Herrera|D|0.8;Guzmán Corujo|D|1.5;
Nahuel Barrios|M|1.5;Manuel Insaurralde|M|1.2;Matías Reali|M|1.5;Agustín Ladstatter|M|1.5;Malcom Braida|M|1.5;Juan Pablo Álvarez|M|0.8;Ezequiel Cerutti|M|0.5;Gonzalo Luján|M|1.5;
Alexis Cuello|F|3;Facundo Farías|F|2.5;Diego Herazo|F|1;Rodrigo Auzmendi|F|1`);
T('est','Estudiantes LP','EST','#ffffff','#e2001a','#e2001a','stripes',`
Fabricio Iacovich|P|1.2;Rodrigo Borzone|P|0.3;
Eric Meza|D|2.5;Eros Mancuso|D|2;Santiago Núñez|D|2.5;Tomás Palacios|D|2.5;Leandro González Pirez|D|1;Ramiro Funes Mori|D|0.6;Gastón Benedetti|D|1.5;Santiago Arzamendia|D|1.2;
Ezequiel Piovi|M|1.5;Gabriel Neves|M|2.5;Alexis Castro|M|2.5;Baltasar Rodríguez|M|3;Miguel Monsalve|M|2.5;Jalil Elías|M|1;José Sosa|M|0.4;Bautista Kociubinski|M|0.8;
Edwuin Cetré|F|5;Tiago Palacios|F|3;Joaquín Correa|F|2.5;Brian Aguirre|F|2.5;Guido Carrillo|F|1;Lucas Alario|F|1;Adolfo Gaich|F|1.5;Fabricio Pérez|F|1.2`);
T('gim','Gimnasia LP','GIM','#ffffff','#0a2240','#ffffff','band',`
Nelson Insfrán|P|1.2;Harlen Castillo|P|0.8;
Enzo Martínez|D|1;Renzo Giampaoli|D|0.8;Germán Conti|D|0.8;Pedro Silva Torrejón|D|1;Matías Melluso|D|1.2;Alexis Steimbach|D|0.6;Juan Cruz Cortazzo|D|0.8;
Ignacio Miramón|M|1.5;Augusto Max|M|0.8;Facundo Di Biasi|M|0.8;Mateo Seoane|M|0.6;Ignacio Fernández|M|0.8;Nicolás Barros Schelotto|M|0.6;Manuel Panaro|M|1.2;Juan José Pérez|M|0.6;
Agustín Auzmendi|F|1.5;Marcelo Torres|F|1.5;Maximiliano Zalazar|F|1;Lucas Janson|F|0.6;Agustín Colazo|F|0.8;Jeremías Merlo|F|0.5`);
T('tal','Talleres','TAL','#0a2a5c','#ffffff','#ffffff','stripes',`
Guido Herrera|P|0.8;Matías Catalán|D|1.5;Gastón Benavídez|D|1.5;Kevin Mantilla|D|1.5;Miguel Navarro|D|2;Román Riquelme|D|1.5;Blas Riveros|D|1.5;Augusto Schott|D|0.8;
Federico Fattori|M|2;Matías Galarza|M|2;Juan Camilo Portilla|M|1.5;Rick Lima|M|2;Rubén Botta|M|1;Valentín Dávila|M|0.8;
Federico Girotti|F|3;Diego Valoyes|F|2.5;Ronaldo Martínez|F|2.5;Nahuel Bustos|F|1.5;Giovanni Baroni|F|0.5`);
T('bel','Belgrano','BEL','#4fb0e5','#4fb0e5','#0b2a4a','solid',`
Thiago Cardozo|P|1;Juan Espínola|P|0.4;
Alexis Maldonado|D|1.2;Leonardo Morales|D|0.8;Lisandro López|D|0.5;Federico Ricca|D|0.5;Álvaro Ocampo|D|0.5;Agustín Falcón|D|0.8;
Santiago Longo|M|1.5;Lucas Zelarayán|M|2;Francisco González Metilli|M|1;Franco Vázquez|M|0.4;Nicolás Fernández|M|1.2;Ramiro Hernandes|M|0.8;Gonzalo Zelarayán|M|0.5;Marcos Ortiz|M|0.5;
Lucas Passerini|F|1.2;Bryan Reyna|F|1.5;Emiliano Rigoni|F|0.8;Lautaro Gutiérrez|F|0.3`);
T('rco','Rosario Central','RCE','#0a3e8c','#ffd200','#ffd200','stripes',`
Jorge Broun|P|1;Axel Werner|P|0.6;
Facundo Mallo|D|2;Agustín Sández|D|2;Juan Cruz Komar|D|1;Emanuel Coronel|D|1.5;Ignacio Ovando|D|1;Juan Giménez|D|0.6;
Ángel Di María|M|2.5;Federico Navarro|M|2.5;Franco Ibarra|M|2;Jaminton Campaz|M|3.5;Tomás O'Connor|M|1.5;Gaspar Duarte|M|2;
Alejo Véliz|F|3;Enzo Copetti|F|1.5;Tobías Cervera|F|1`);
T('nob',"Newell's Old Boys",'NOB','#d50000','#111111','#ffffff','halves',`
Josué Reinatti|P|0.8;Ramiro Macagno|P|0.5;
Ian Glavinovich|D|1.5;Nicolás Goitea|D|0.8;Martín Luciano|D|1;Fabián Noguera|D|1;Franco Escobar|D|0.8;Lautaro Giannetti|D|0.6;Lucas Carrizo|D|1.2;Alejo Montero|D|0.6;
Luca Regiardo|M|2;Jerónimo Gómez Mattar|M|1;Facundo Guch|M|0.8;Marcelo Esponda|M|1;Valentino Acuña|M|1;Alan Soñora|M|0.8;Lucas Gómez|M|0.6;Martín Ortega|M|0.5;
Matías Cóccaro|F|2;Walter Mazzantti|F|1.5;Santiago Solari|F|2;Juan Ignacio Ramírez|F|1;Walter Núñez|F|0.4`);
T('vel','Vélez Sarsfield','VEL','#ffffff','#0047ab','#0047ab','chevron',`
Tomás Marchiori|P|3;Facundo Sanguinetti|P|0.8;
Joaquín García|D|2;Jano Gordon|D|2;Aarón Quirós|D|1.5;Elías Gómez|D|1.5;Emanuel Mammana|D|1.2;Lisandro Magallán|D|0.6;Damián Fernández|D|0.8;
Maher Carrizo|M|10;Christian Ordóñez|M|1.5;Rodrigo Aliendro|M|1.5;Claudio Baeza|M|1;Agustín Bouzat|M|1;Diego Valdés|M|1.5;Thiago Fernández|M|2;Manuel Lanzini|M|0.6;
Braian Romero|F|1.2;Matías Pellegrini|F|1.5;Florián Monzón|F|1.5;Lenny Lobato|F|1.2;Rodrigo Piola|F|0.3`);
T('lan','Lanús','LAN','#7b1e2b','#7b1e2b','#ffffff','solid',`
Nahuel Losada|P|1;
José Canale|D|2;Carlos Izquierdoz|D|0.6;Gonzalo Pérez|D|1.5;Sasha Marcich|D|1.5;Facundo Sánchez|D|0.8;Felipe Peña Biafore|D|1.5;
Agustín Cardozo|M|2;Marcelino Moreno|M|2;Ramiro Carrera|M|1.5;Raúl Loaiza|M|1.5;Agustín Medina|M|1.5;Thiago Laplace|M|0.4;Eduardo Salvio|M|0.6;
Rodrigo Castillo|F|3;Benjamín Acosta|F|1;Allan Wlk|F|0.8;Yoshan Valois|F|1.2;Franco Watson|F|0.4`);
T('arg','Argentinos Juniors','ARG','#e4002b','#ffffff','#ffffff','sash',`
Gonzalo Siri|P|1;
Francisco Álvarez|D|2;Erik Godoy|D|1.2;Kevin Coronel|D|1;Alan Núñez|D|0.6;Franco Paredes|D|1;Franco Vázquez|D|0.5;Facundo Carrizo|D|0.6;
Alan Lescano|M|5;Kevin Gutiérrez|M|2;Nicolás Oroz|M|2;Hernán López Muñoz|M|2;Emiliano Viveros|M|1.5;Federico Mancuello|M|0.4;Gastón Verón|M|1;Santiago Silveira|M|0.6;
Tomás Molina|F|2;Diego Porcel|F|1.5;Alejandro Alcaraz|F|0.5`);
T('hur','Huracán','HUR','#ffffff','#e2001a','#e2001a','solid',`
Hernán Galíndez|P|0.6;Sebastián Meza|P|0.4;
Fabio Pereyra|D|1.2;César Ibáñez|D|1;Lucas Blondel|D|1;Hugo Nervo|D|0.8;Guillermo Soto|D|1.5;Tomás Guidara|D|0.6;
Emmanuel Ojeda|M|1.2;Leonardo Gil|M|0.8;Facundo Waller|M|1;Rodrigo Echeverría|M|1.5;Rodrigo Fernández Cedrés|M|1;Alejandro Martínez|M|0.4;Agustín Bisanz|M|0.4;
Oscar Cortés|F|1.5;Ignacio Pussetto|F|1;Bruno Barticciotto|F|0.8;Jordy Caicedo|F|0.8;Thaiel Peralta|F|0.3`);
T('dyj','Defensa y Justicia','DYJ','#ffd200','#00843d','#00843d','halves',`
Matías Borgogno|P|0.8;Enrique Bologna|P|0.3;
Fernando Román|D|0.5;Demian Domínguez|D|1;Ezequiel Burdin|D|0.3;Rafael Delgado|D|0.6;Alexis Soto|D|0.6;
Aaron Molinas|M|1.5;Juan Manuel Gutiérrez|M|1;Maximiliano Porcel|M|0.8;Domingo Blanco|M|0.8;Jeremías Lucco|M|1;César Pérez|M|0.4;Emiliano Cantero|M|0.4;
Tiziano Perrotta|F|1.5;Tomás Pérez|F|1;Leandro Fernández|F|0.6;Ramiro Gagliardi|F|0.3`);
T('pla','Platense','PLA','#ffffff','#5b3a1e','#5b3a1e','band',`
Juan Pablo Cozzani|P|0.8;Andrés Desábato|P|0.3;
Ignacio Vázquez|D|1;Juan Saborido|D|0.6;Raúl Lozano|D|0.5;Fabricio López|D|0.4;Iván Gómez|D|0.5;Santiago Quirós|D|0.4;Héctor Bobadilla|D|0.4;
Vicente Taborda|M|1.5;Franco Minerva|M|0.8;Leonel Picco|M|0.8;Maximiliano Amarfil|M|0.4;Manuel Tucker|M|0.8;Mateo Mendía|M|0.5;
Luciano Giménez|F|0.8;Gastón Togni|F|0.8;Nicolás López|F|0.6;Bruno Sepúlveda|F|0.4;Augusto Lotti|F|0.6`);
T('bar','Barracas Central','BAR','#e2001a','#ffffff','#ffffff','stripes',`
Marcelo Miño|P|0.6;Juan Ignacio Bianco|P|0.2;
Yonatthan Rak|D|0.6;Fernando Tobio|D|0.4;Nicolás Capraro|D|0.6;Rafael Barrios|D|0.8;Elías Pereyra|D|0.5;Damián Martínez|D|0.4;Nicolás Demartini|D|0.5;
Iván Tapia|M|1;Rodrigo Insúa|M|0.8;Esteban Rolón|M|0.4;Kevin Jappert|M|0.6;Iván Guaraz|M|0.6;Carlos Arce|M|0.5;Tomás Lavezzi|M|0.3;
Facundo Bruera|F|0.8;Nicolás Orsini|F|0.4;Juan Ignacio Barbieri|F|0.4;Jhonatan Candia|F|0.5`);
T('tig','Tigre','TIG','#0d2c6c','#d50000','#ffffff','band',`
Felipe Zenobio|P|1;Lautaro Morales|P|0.8;
Sebastián Prieto|D|0.8;Ramón Arias|D|0.5;Joaquín Laso|D|0.6;Gonzalo Requena|D|0.8;Martín Garay|D|0.5;Ignacio Rodríguez|D|0.4;
Jabes Saralegui|M|1.5;Federico Álvarez|M|0.4;Héctor Fértoli|M|0.6;Tomás Cardona|M|0.6;Elías Cabrera|M|0.5;
Ignacio Russo|F|2.5;Mauro Méndez|F|1;David Romero|F|0.8;Blas Armoa|F|0.8`);
T('uni','Unión','UNI','#ffffff','#d50000','#d50000','stripes',`
Matías Tagliamonte|P|0.6;
Valentín Fascendini|D|1.2;Lautaro Vargas|D|0.8;Franco Pardo|D|0.8;Claudio Corvalán|D|0.8;Juan de Dios Pintado|D|0.5;Mauricio Martínez|D|0.4;
Mauro Pittón|M|0.8;Julián Palacios|M|1;Mateo Del Blanco|M|1;Ignacio Malcorra|M|0.5;Marcelo Estigarribia|M|0.6;Lionel Verde|M|0.4;
Mauro Luna Diale|F|0.8;Eric Ramírez|F|0.6;Cristian Tarragona|F|0.5;Franco Fragapane|F|0.6`);
T('ins','Instituto','INS','#d50000','#ffffff','#ffffff','stripes',`
Marcos Ledesma|P|0.5;Emanuel Sittaro|P|0.4;
Fernando Alarcón|D|0.6;Giuliano Cerato|D|0.5;Leonel Mosevich|D|0.5;Jonás Acevedo|D|0.4;Juan Franco|D|0.4;Damián Puebla|D|0.4;
Alex Luna|M|1;Wilder Viera|M|0.6;Lucas Sanseviero|M|0.8;Ignacio Méndez|M|0.4;Facundo Suárez|M|0.4;Gustavo Abregú|M|0.3;
John Córdoba|F|1;Nicolás Guerra|F|0.6;Matías Tissera|F|0.5;Diego Sosa|F|0.4;Matías Fonseca|F|0.4`);
T('irv','Independiente Rivadavia','IRV','#002f87','#002f87','#ffffff','solid',`
Ezequiel Centurión|P|1;Gonzalo Marinelli|P|0.3;
Sheyko Studer|D|0.8;Luciano Gómez|D|1;Alex Vigo|D|0.6;Leonard Costa|D|0.6;Iván Villalba|D|0.8;Ezequiel Bonifacio|D|0.4;
Matías Fernández|M|0.8;Tomás Bottari|M|0.6;Alejo Osella|M|0.8;Nicolás Retamar|M|0.5;Gonzalo Ríos|M|0.4;
Alex Arce|F|1.2;Maximiliano Salas|F|1.5;Luis Ángel Díaz|F|1;Fabrizio Sartori|F|0.8;Diego Crego|F|0.3`);
T('atu','Atlético Tucumán','ATU','#6cace4','#ffffff','#0b2a4a','stripes',`
Tomás Durso|P|0.6;Matías Mansilla|P|0.4;
Marcelo Ortiz|D|0.8;Clever Ferreira|D|0.6;Nicolás Romero|D|0.5;Juan Rodríguez|D|0.4;Gabriel Compagnucci|D|0.5;Ignacio Galván|D|0.4;
Kevin Ortiz|M|1.2;Renzo Tesuri|M|0.8;Lautaro Godoy|M|0.6;Maximiliano Villa|M|0.5;Julián Fernández|M|0.5;Adrián Sánchez|M|0.4;
Mateo Coronel|F|0.8;Ramiro Ruiz Rodríguez|F|0.6;Leandro Díaz|F|0.4;Alexis Canelo|F|0.4;Ezequiel Ham|F|0.3`);
T('ban','Banfield','BAN','#006a3e','#ffffff','#ffffff','stripes',`
Diego Rodríguez|P|0.4;
Nehuén Paz|D|0.6;Renzo Malanca|D|0.6;Tomás Adoryán|D|0.6;Lautaro Cano|D|0.4;Marcos López|D|0.4;
Juan Infante|M|0.6;Martín Benítez|M|0.5;Jonathan Gómez|M|0.6;Manuel Arteaga|M|0.4;Lautaro Villegas|M|0.4;Mateo Mendizabal|M|0.2;
Alexander Machado|F|0.8;Adrián Balboa|F|0.5;Matías Hernández|F|0.5;Jeremías Acosta|F|0.2`);
T('sar','Sarmiento','SAR','#00843d','#00843d','#ffffff','solid',`
Lucas Hoyos|P|0.3;Javier Burrai|P|0.2;
Renzo Orihuela|D|0.4;Juan Manuel Insaurralde|D|0.2;Federico Paradela|D|0.3;Gonzalo Abrego|D|0.3;Valentín Burgoa|D|0.3;
Manuel García|M|0.6;Julián Mavilla|M|0.5;Alan Tevez|M|0.4;Carlos Villalba|M|0.3;Gabriel Hachen|M|0.4;
Jonathan Herrera|F|0.4;Ramiro Véliz|F|0.4;Joaquín Gho|F|0.3`);
T('ccb','Central Córdoba','CCB','#111111','#ffffff','#ffffff','stripes',`
Alan Aguerre|P|0.6;Luis Ingolotti|P|0.2;
Fernando Martínez|D|0.4;Felipe Aguilar|D|0.3;Darío Cáceres|D|0.4;Jonathan Galván|D|0.3;Alejandro Maciel|D|0.3;Matías Vera|D|0.5;
Lucas Varaldo|M|0.6;Ezequiel Naya|M|0.5;Diego Barrera|M|0.6;Alan Laprida|M|0.6;Federico Iacobelis|M|0.4;
Michael Santos|F|0.6;Leonardo Sequeira|F|0.4;Horacio Tijanovich|F|0.5`);
T('rie','Deportivo Riestra','RIE','#111111','#ffffff','#ffffff','band',`
Ignacio Arce|P|0.4;Marino Arzamendia|P|0.3;
Carlos Quintana|D|0.2;Ignacio Gariglio|D|0.3;Juan Manuel Randazzo|D|0.3;Mauricio Cuero|D|0.3;Alan Sosa|D|0.3;
Milton Céliz|M|0.4;Benjamín Pérez|M|0.3;Thiago Lauro|M|0.3;Jonathan Goitía|M|0.3;Facundo Miño|M|0.3;
Agustín Graneros|F|0.3;Tomás González|F|0.4;Nicolás Watson|F|0.4;Braian Sánchez|F|0.3;Ángel Almada|F|0.3;Thiago Romero|F|0.3`);
T('ald','Aldosivi','ALD','#008751','#ffd100','#ffd100','stripes',`
Lucas Acosta|P|0.3;Jorge Carranza|P|0.3;
Joaquín Pombo|D|0.4;Leonardo Sigali|D|0.1;Elías López|D|0.3;Braian Cufré|D|0.4;Santiago Laquidaín|D|0.3;Mateo Vales|D|0.2;
Nicolás Linares|M|0.4;Lucas Castro|M|0.3;Francisco Perruzzi|M|0.5;Natanael Guzmán|M|0.3;Pablo Argoytía|M|0.2;
Matías Godoy|F|0.5;Bautista Dadín|F|0.6;Andrés Vombergar|F|0.4;Andrés Chávez|F|0.3;Nicolás Gaitán|F|0.2`);
T('gme','Gimnasia de Mendoza','GME','#ffffff','#111111','#111111','stripes',`
César Rigamonti|P|0.4;Ramiro Martínez|P|0.2;
Germán Guiffrey|D|0.4;Diego Mondino|D|0.3;Luciano Paredes|D|0.3;Imanol González|D|0.3;Ismael Méndez|D|0.3;
Matías Vargas|M|0.8;Fermín Antonini|M|0.4;Santiago Rodríguez|M|0.4;Agustín Módica|M|0.3;Ulises Sánchez|M|0.3;
Nicolás Romano|F|0.3;Ezequiel Muñoz|F|0.3;Valentín Fernández|F|0.3`);
T('erc','Estudiantes Río Cuarto','ERC','#6cace4','#ffffff','#0b2a4a','halves',`
Lucas Bruera|P|0.3;Joaquín Mendive|P|0.2;
Agustín Quiroga|D|0.4;Lucas Baños|D|0.4;Gonzalo González|D|0.3;Fernando Rodríguez|D|0.2;Alejandro Gutiérrez|D|0.3;Bautista Pieroni|D|0.2;
Siro Rosané|M|0.3;Tomás González|M|0.4;Lucas Bertolo|M|0.3;Mateo Bajamich|M|0.4;
Yeison Moreno|F|0.4;Juan Garro|F|0.3;Ibrahim Hesar|F|0.3;Juan Chala|F|0.3;Facundo Gallardo|F|0.2`);
window.TEAMS = TEAMS;
