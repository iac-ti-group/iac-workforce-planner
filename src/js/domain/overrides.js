/** Ajustes manuais da escala: trabalho/folga forçados por pessoa, semana e dia. */

/** Contratações usam o id estável ("novo1"); a equipe usa a posição na lista. */
export const overrideKey = (person, personIndex, week, day) => `${person.id || personIndex}-${week}-${day}`;

export const hasOverrides = (state) => Object.keys(state.overrides).length > 0;
